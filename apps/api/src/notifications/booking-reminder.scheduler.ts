import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, In, IsNull, Repository } from "typeorm";
import {
  CourtBooking,
  CourtBookingStatus,
} from "../bookings/entities/court-booking.entity";
import { BookingMailService } from "./booking-mail.service";

/**
 * Sends "30 minutes before start" emails using {@link CourtBooking.bookingStartAt} (UTC).
 * Eligibility window: 28–32 minutes from now so a one-minute cron can retry once if send fails.
 */
@Injectable()
export class BookingReminderScheduler {
  private readonly logger = new Logger(BookingReminderScheduler.name);

  constructor(
    @InjectRepository(CourtBooking)
    private readonly courtBookingRepo: Repository<CourtBooking>,
    private readonly bookingMail: BookingMailService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDueReminders(): Promise<void> {
    const now = Date.now();
    const winLo = new Date(now + 28 * 60 * 1000);
    const winHi = new Date(now + 32 * 60 * 1000);

    const bookings = await this.courtBookingRepo.find({
      where: {
        bookingStatus: In([
          CourtBookingStatus.PENDING,
          CourtBookingStatus.CONFIRMED,
        ]),
        reminder30EmailSentAt: IsNull(),
        bookingStartAt: Between(winLo, winHi),
      },
      relations: { user: true, court: true, location: true },
    });

    for (const b of bookings) {
      const ok = await this.bookingMail.sendBookingReminder30m(b);
      if (ok) {
        b.reminder30EmailSentAt = new Date();
        await this.courtBookingRepo.save(b);
      }
    }

    if (bookings.length > 0) {
      this.logger.log(
        `Reminder cron: ${bookings.length} candidate(s), window ${winLo.toISOString()} – ${winHi.toISOString()}`,
      );
    }
  }
}
