import { MigrationInterface, QueryRunner } from "typeorm";

export class CourtBookingAdminCalendarSeries1711560000000
  implements MigrationInterface
{
  name = "CourtBookingAdminCalendarSeries1711560000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "court_bookings"
      ADD COLUMN IF NOT EXISTS "adminCalendarSeriesId" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_court_bookings_adminCalendarSeriesId"
      ON "court_bookings" ("adminCalendarSeriesId")
      WHERE "adminCalendarSeriesId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_court_bookings_adminCalendarSeriesId"
    `);
    await queryRunner.query(`
      ALTER TABLE "court_bookings"
      DROP COLUMN IF EXISTS "adminCalendarSeriesId"
    `);
  }
}
