import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase2HierarchyAndUserFields1711540000000
  implements MigrationInterface
{
  name = "Phase2HierarchyAndUserFields1711540000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "court_bookings"
      ADD COLUMN IF NOT EXISTS "reminder30EmailSentAt" TIMESTAMPTZ NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "firstName" VARCHAR NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "lastName" VARCHAR NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "mustChangePasswordOnFirstLogin" BOOLEAN NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "locations"
      ADD COLUMN IF NOT EXISTS "parentLocationId" UUID NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "locations"
      ADD COLUMN IF NOT EXISTS "kind" VARCHAR NOT NULL DEFAULT 'child'
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_locations_parentLocationId_locations_id'
            AND table_name = 'locations'
        ) THEN
          ALTER TABLE "locations"
          ADD CONSTRAINT "FK_locations_parentLocationId_locations_id"
          FOREIGN KEY ("parentLocationId") REFERENCES "locations"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "areas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "locationId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "visibility" character varying NOT NULL DEFAULT 'public',
        "status" character varying NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_areas_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_areas_locationId_locations_id'
            AND table_name = 'areas'
        ) THEN
          ALTER TABLE "areas"
          ADD CONSTRAINT "FK_areas_locationId_locations_id"
          FOREIGN KEY ("locationId") REFERENCES "locations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      ALTER TABLE "areas"
      ADD COLUMN IF NOT EXISTS "visibility" character varying NOT NULL DEFAULT 'public'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_areas_locationId"
      ON "areas" ("locationId")
    `);

    await queryRunner.query(`
      ALTER TABLE "courts"
      ADD COLUMN IF NOT EXISTS "areaId" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "courts"
      ADD COLUMN IF NOT EXISTS "sportId" uuid NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_courts_areaId_areas_id'
            AND table_name = 'courts'
        ) THEN
          ALTER TABLE "courts"
          ADD CONSTRAINT "FK_courts_areaId_areas_id"
          FOREIGN KEY ("areaId") REFERENCES "areas"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_courts_sportId_sports_id'
            AND table_name = 'courts'
        ) THEN
          ALTER TABLE "courts"
          ADD CONSTRAINT "FK_courts_sportId_sports_id"
          FOREIGN KEY ("sportId") REFERENCES "sports"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_courts_sportId"
      ON "courts" ("sportId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_courts_areaId"
      ON "courts" ("areaId")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'courts' AND column_name = 'sport'
        ) THEN
          UPDATE "courts" c
          SET "sportId" = s.id
          FROM "sports" s
          WHERE c."sportId" IS NULL
            AND c."sport" IS NOT NULL
            AND TRIM(c."sport") <> ''
            AND s."code" = c."sport";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'courts' AND column_name = 'sports'
        ) THEN
          UPDATE "courts" c
          SET "sportId" = x.sid
          FROM (
            SELECT DISTINCT ON (c2.id) c2.id AS cid, s.id AS sid
            FROM "courts" c2
            INNER JOIN "sports" s ON s."code" = ANY (c2."sports")
            WHERE c2."sportId" IS NULL
              AND c2."sports" IS NOT NULL
              AND cardinality(c2."sports") > 0
            ORDER BY c2.id, s.id
          ) x
          WHERE c.id = x.cid;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      UPDATE "users"
      SET "firstName" = split_part("fullName", ' ', 1),
          "lastName" = NULLIF(substr("fullName", length(split_part("fullName", ' ', 1)) + 2), '')
      WHERE "fullName" IS NOT NULL
        AND ("firstName" IS NULL OR "lastName" IS NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_courts_areaId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_courts_sportId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "courts" DROP CONSTRAINT IF EXISTS "FK_courts_sportId_sports_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "courts" DROP CONSTRAINT IF EXISTS "FK_courts_areaId_areas_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "courts" DROP COLUMN IF EXISTS "sportId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "courts" DROP COLUMN IF EXISTS "areaId"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_areas_locationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "areas" DROP CONSTRAINT IF EXISTS "FK_areas_locationId_locations_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "areas"`);

    await queryRunner.query(
      `ALTER TABLE "locations" DROP CONSTRAINT IF EXISTS "FK_locations_parentLocationId_locations_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "locations" DROP COLUMN IF EXISTS "kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "locations" DROP COLUMN IF EXISTS "parentLocationId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "mustChangePasswordOnFirstLogin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "lastName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "firstName"`,
    );

    await queryRunner.query(
      `ALTER TABLE "court_bookings" DROP COLUMN IF EXISTS "reminder30EmailSentAt"`,
    );
  }
}
