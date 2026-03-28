import { MigrationInterface, QueryRunner } from "typeorm";

/** Allow locations without a branch (standalone roots / venues). */
export class LocationBranchNullable1711543000000 implements MigrationInterface {
  name = "LocationBranchNullable1711543000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locations" ALTER COLUMN "branchId" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "locations" SET "branchId" = (
        SELECT b.id FROM "branches" b ORDER BY b."createdAt" ASC NULLS LAST LIMIT 1
      )
      WHERE "branchId" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "locations" ALTER COLUMN "branchId" SET NOT NULL
    `);
  }
}
