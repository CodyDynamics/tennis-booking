import { MigrationInterface, QueryRunner } from "typeorm";

export class AllowNullRoleOnRegister1711541000000
  implements MigrationInterface
{
  name = "AllowNullRoleOnRegister1711541000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "roleId" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Backfill missing roleId before restoring NOT NULL.
    await queryRunner.query(`
      UPDATE "users"
      SET "roleId" = (
        SELECT r.id
        FROM "roles" r
        WHERE r.name = 'player'
        LIMIT 1
      )
      WHERE "roleId" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "roleId" SET NOT NULL
    `);
  }
}
