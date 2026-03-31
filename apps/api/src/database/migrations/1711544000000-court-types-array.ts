import { MigrationInterface, QueryRunner } from "typeorm";

export class CourtTypesArray1711544000000 implements MigrationInterface {
  name = "CourtTypesArray1711544000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courts"
      ADD COLUMN IF NOT EXISTS "courtTypes" character varying[] NOT NULL DEFAULT ARRAY['outdoor']::varchar[];
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'courts' AND column_name = 'type'
        ) THEN
          UPDATE "courts"
          SET "courtTypes" = CASE
            WHEN "type" IS NOT NULL AND TRIM("type") <> ''
              THEN ARRAY[LOWER(TRIM("type"))]::varchar[]
            ELSE ARRAY['outdoor']::varchar[]
          END;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      ALTER TABLE "courts" DROP COLUMN IF EXISTS "type";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courts"
      ADD COLUMN IF NOT EXISTS "type" character varying NOT NULL DEFAULT 'outdoor';
    `);
    await queryRunner.query(`
      UPDATE "courts"
      SET "type" = COALESCE("courtTypes"[1], 'outdoor');
    `);
    await queryRunner.query(`
      ALTER TABLE "courts" DROP COLUMN IF EXISTS "courtTypes";
    `);
  }
}
