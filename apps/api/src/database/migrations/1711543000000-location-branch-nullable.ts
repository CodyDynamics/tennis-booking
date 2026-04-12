import { MigrationInterface, QueryRunner } from "typeorm";

/** Allow locations without a branch (standalone roots / venues). */
export class LocationBranchNullable1711543000000 implements MigrationInterface {
  name = "LocationBranchNullable1711543000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'branchId'
        ) THEN
          ALTER TABLE "locations" ALTER COLUMN "branchId" DROP NOT NULL;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'branchId'
        ) THEN
          UPDATE "locations" SET "branchId" = (
            SELECT b.id FROM "branches" b ORDER BY b."createdAt" ASC NULLS LAST LIMIT 1
          )
          WHERE "branchId" IS NULL;
          ALTER TABLE "locations" ALTER COLUMN "branchId" SET NOT NULL;
        END IF;
      END$$;
    `);
  }
}
