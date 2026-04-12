import { MigrationInterface, QueryRunner } from "typeorm";

export class PlatformMobileSuite1711570000000 implements MigrationInterface {
  name = "PlatformMobileSuite1711570000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "appPersona" varchar(16) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMPTZ NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "parent_guardian_links" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "parentUserId" uuid NOT NULL,
        "childUserId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_parent_guardian_links" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_parent_guardian_parent_child" UNIQUE ("parentUserId", "childUserId"),
        CONSTRAINT "FK_pgl_parent" FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pgl_child" FOREIGN KEY ("childUserId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coach_roster_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "coachId" uuid NOT NULL,
        "studentUserId" uuid NOT NULL,
        "skillLevel" varchar(64) NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coach_roster_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coach_roster_coach_student" UNIQUE ("coachId", "studentUserId"),
        CONSTRAINT "FK_cr_coach" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cr_student" FOREIGN KEY ("studentUserId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "player_metric_snapshots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "playerUserId" uuid NOT NULL,
        "coachId" uuid NULL,
        "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "scores" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_player_metric_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pms_player" FOREIGN KEY ("playerUserId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pms_coach" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pms_player_recorded"
      ON "player_metric_snapshots" ("playerUserId", "recordedAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "training_plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "coachId" uuid NOT NULL,
        "playerUserId" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_training_plans" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tp_coach" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tp_player" FOREIGN KEY ("playerUserId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "training_plan_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "planId" uuid NOT NULL,
        "title" text NOT NULL,
        "sortOrder" int NOT NULL DEFAULT 0,
        "dueDate" date NULL,
        CONSTRAINT "PK_training_plan_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tpi_plan" FOREIGN KEY ("planId") REFERENCES "training_plans"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "training_plan_completions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "itemId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "completedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_training_plan_completions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tpc_item_user" UNIQUE ("itemId", "userId"),
        CONSTRAINT "FK_tpc_item" FOREIGN KEY ("itemId") REFERENCES "training_plan_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tpc_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "session_feedback_notes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "coachSessionId" uuid NULL,
        "courtBookingId" uuid NULL,
        "authorUserId" uuid NOT NULL,
        "body" text NOT NULL,
        "visibility" varchar(32) NOT NULL DEFAULT 'coach_player',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_session_feedback_notes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sfn_author" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sfn_coach_session" FOREIGN KEY ("coachSessionId") REFERENCES "coach_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sfn_court_booking" FOREIGN KEY ("courtBookingId") REFERENCES "court_bookings"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sfn_coach_session" ON "session_feedback_notes" ("coachSessionId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sfn_court_booking" ON "session_feedback_notes" ("courtBookingId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "training_videos" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "uploaderUserId" uuid NOT NULL,
        "playerUserId" uuid NOT NULL,
        "storageKey" varchar(512) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'pending_review',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_training_videos" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tv_uploader" FOREIGN KEY ("uploaderUserId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tv_player" FOREIGN KEY ("playerUserId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "parent_payment_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "parentUserId" uuid NOT NULL,
        "childUserId" uuid NOT NULL,
        "amountCents" int NOT NULL,
        "currency" varchar(8) NOT NULL DEFAULT 'USD',
        "description" text NULL,
        "status" varchar(32) NOT NULL DEFAULT 'pending',
        "externalPaymentRef" varchar(255) NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_parent_payment_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ppr_parent" FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ppr_child" FOREIGN KEY ("childUserId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "achievements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(64) NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text NULL,
        CONSTRAINT "PK_achievements" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_achievements_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_achievements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "achievementId" uuid NOT NULL,
        "earnedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_achievements" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_achievement" UNIQUE ("userId", "achievementId"),
        CONSTRAINT "FK_ua_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ua_achievement" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_achievements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "achievements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "parent_payment_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "training_videos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "session_feedback_notes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "training_plan_completions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "training_plan_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "training_plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "player_metric_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coach_roster_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "parent_guardian_links"`);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "onboardingCompletedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "appPersona"
    `);
  }
}
