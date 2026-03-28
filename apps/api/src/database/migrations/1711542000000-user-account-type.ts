import { MigrationInterface, QueryRunner } from "typeorm";

export class UserAccountType1711542000000 implements MigrationInterface {
  name = "UserAccountType1711542000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "accountType" VARCHAR(32) NOT NULL DEFAULT 'normal'
    `);
    await queryRunner.query(`
      UPDATE "users" u
      SET "accountType" = 'system'
      FROM "roles" r
      WHERE u."roleId" = r.id
        AND r.name IN ('super_admin', 'admin', 'super_user', 'coach')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "accountType"
    `);
  }
}
