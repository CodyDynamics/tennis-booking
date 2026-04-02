import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Per-court booking windows are keyed by court + environment only; `sport` is legacy.
 * Dedupe rows that were created per activity; keep oldest row per (courtId, locationId, courtType).
 */
export class BookingWindowsDedupeSportShared1711550000000
  implements MigrationInterface
{
  name = "BookingWindowsDedupeSportShared1711550000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "location_booking_windows" w
      WHERE w."courtId" IS NOT NULL
        AND w.id NOT IN (
          SELECT id FROM (
            SELECT DISTINCT ON (w2."courtId", w2."locationId", w2."courtType") w2.id
            FROM "location_booking_windows" w2
            WHERE w2."courtId" IS NOT NULL
            ORDER BY w2."courtId", w2."locationId", w2."courtType", w2."createdAt" ASC, w2.id ASC
          ) sub
        )
    `);
    await queryRunner.query(`
      UPDATE "location_booking_windows"
      SET sport = '*'
      WHERE "courtId" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Cannot restore deleted duplicate windows.
  }
}
