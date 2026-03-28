import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import {
  CourtBooking,
  CourtBookingStatus,
} from "../bookings/entities/court-booking.entity";
import { MailSenderService } from "./mail-sender.service";
import {
  formatBookingTimeRangeShort,
  renderBookingConfirmationEmail,
  renderBookingCancelledEmail,
  renderBookingReminder30mEmail,
} from "./mail-templates";

@Injectable()
export class BookingMailService {
  private readonly logger = new Logger(BookingMailService.name);

  constructor(
    private readonly mailSender: MailSenderService,
    private readonly config: ConfigService,
    @InjectRepository(CourtBooking)
    private readonly courtBookingRepo: Repository<CourtBooking>,
  ) {}

  private frontendBase(): string {
    return (
      this.config.get<string>("frontendUrl") || "http://localhost:3000"
    ).replace(/\/$/, "");
  }

  private bookingHistoryUrl(): string {
    return `${this.frontendBase()}/booking-history`;
  }

  /**
   * Same path as the app: /locations/:locationId/courts?areaId=… when court has an area.
   * Set FRONTEND_URL in .env (e.g. https://app.yourdomain.com) so links are not localhost.
   */
  private venueCourtsUrl(booking: CourtBooking): string {
    const base = this.frontendBase();
    const locationId = booking.locationId ?? booking.court?.locationId ?? null;
    if (!locationId) {
      return this.bookingHistoryUrl();
    }
    const areaId = booking.court?.areaId;
    const path = areaId
      ? `/locations/${locationId}/courts?areaId=${encodeURIComponent(areaId)}`
      : `/locations/${locationId}/courts`;
    return `${base}${path}`;
  }

  /**
   * Fire-and-forget friendly: loads booking and sends confirmation; logs on failure.
   */
  async sendBookingConfirmation(
    bookingId: string,
    variant: "created" | "rescheduled",
  ): Promise<void> {
    try {
      const booking = await this.courtBookingRepo.findOne({
        where: { id: bookingId },
        relations: { user: true, court: true, location: true },
      });
      if (!booking?.user?.email) {
        this.logger.warn(`No user email for booking ${bookingId}; skip mail`);
        return;
      }
      if (
        booking.bookingStatus === CourtBookingStatus.CANCELLED ||
        booking.bookingStatus === CourtBookingStatus.COMPLETED
      ) {
        return;
      }
      const startAt = booking.bookingStartAt;
      const endAt = booking.bookingEndAt;
      if (!startAt || !endAt) {
        this.logger.warn(`Booking ${bookingId} missing UTC range; skip mail`);
        return;
      }
      const tz = booking.location?.timezone || "UTC";
      const dateTimeRangeLabel = formatBookingTimeRangeShort(startAt, endAt, tz);
      const { subject, html } = renderBookingConfirmationEmail({
        variant,
        userDisplayName: booking.user.fullName || "there",
        locationName: booking.location?.name || "Venue",
        courtName: booking.court?.name || "Court",
        dateTimeRangeLabel,
        venueCourtsUrl: this.venueCourtsUrl(booking),
        bookingHistoryUrl: this.bookingHistoryUrl(),
      });
      await this.mailSender.sendHtml({
        to: booking.user.email,
        subject,
        html,
      });
    } catch (e) {
      this.logger.error(`sendBookingConfirmation failed for ${bookingId}`, e);
    }
  }

  /** After status is set to cancelled; fire-and-forget from cancel handler. */
  async sendBookingCancellation(bookingId: string): Promise<void> {
    try {
      const booking = await this.courtBookingRepo.findOne({
        where: { id: bookingId },
        relations: { user: true, court: true, location: true },
      });
      if (!booking?.user?.email) {
        this.logger.warn(`No user email for cancelled booking ${bookingId}; skip mail`);
        return;
      }
      if (booking.bookingStatus !== CourtBookingStatus.CANCELLED) {
        this.logger.warn(`Booking ${bookingId} not cancelled; skip cancellation mail`);
        return;
      }
      const startAt = booking.bookingStartAt;
      const endAt = booking.bookingEndAt;
      if (!startAt || !endAt) {
        this.logger.warn(`Cancelled booking ${bookingId} missing UTC range; skip mail`);
        return;
      }
      const tz = booking.location?.timezone || "UTC";
      const dateTimeRangeLabel = formatBookingTimeRangeShort(startAt, endAt, tz);
      const { subject, html } = renderBookingCancelledEmail({
        userDisplayName: booking.user.fullName || "there",
        locationName: booking.location?.name || "Venue",
        courtName: booking.court?.name || "Court",
        dateTimeRangeLabel,
        venueCourtsUrl: this.venueCourtsUrl(booking),
        bookingHistoryUrl: this.bookingHistoryUrl(),
      });
      await this.mailSender.sendHtml({
        to: booking.user.email,
        subject,
        html,
      });
    } catch (e) {
      this.logger.error(`sendBookingCancellation failed for ${bookingId}`, e);
    }
  }

  async sendBookingReminder30m(booking: CourtBooking): Promise<boolean> {
    const user = booking.user;
    if (!user?.email) {
      this.logger.warn(`Reminder: no email for booking ${booking.id}`);
      return false;
    }
    const startAt = booking.bookingStartAt;
    const endAt = booking.bookingEndAt;
    if (!startAt || !endAt) return false;
    const tz = booking.location?.timezone || "UTC";
    const dateTimeRangeLabel = formatBookingTimeRangeShort(startAt, endAt, tz);
    const { subject, html } = renderBookingReminder30mEmail({
      userDisplayName: user.fullName || "there",
      locationName: booking.location?.name || "Venue",
      courtName: booking.court?.name || "Court",
      dateTimeRangeLabel,
      venueCourtsUrl: this.venueCourtsUrl(booking),
      bookingHistoryUrl: this.bookingHistoryUrl(),
    });
    return this.mailSender.sendHtml({
      to: user.email,
      subject,
      html,
    });
  }
}
