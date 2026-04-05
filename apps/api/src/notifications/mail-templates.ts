import { escapeHtml, renderMailLayout } from "./mail-layout";

/** Named templates for logging / future i18n or admin previews. */
export const MailTemplateId = {
  BOOKING_CONFIRMATION: "booking_confirmation",
  BOOKING_REMINDER_30M: "booking_reminder_30m",
  BOOKING_CANCELLED: "booking_cancelled",
} as const;

export type MailTemplateIdType =
  (typeof MailTemplateId)[keyof typeof MailTemplateId];

export interface BookingConfirmationTemplateInput {
  variant: "created" | "rescheduled";
  userDisplayName: string;
  locationName: string;
  courtName: string;
  /** Local time range at venue, e.g. "19:30 - 21:00" */
  dateTimeRangeLabel: string;
  /** Deep link to courts for this location (and area when known). Uses FRONTEND_URL on the server. */
  venueCourtsUrl: string;
  /** Optional link to booking history on the same frontend. */
  bookingHistoryUrl?: string;
  /** Optional extra HTML appended inside body (trusted). */
  extraBodyHtml?: string;
  footerHtml?: string;
}

export interface BookingReminderTemplateInput {
  userDisplayName: string;
  locationName: string;
  courtName: string;
  dateTimeRangeLabel: string;
  venueCourtsUrl: string;
  bookingHistoryUrl?: string;
  footerHtml?: string;
}

export interface BookingCancelledTemplateInput {
  userDisplayName: string;
  locationName: string;
  courtName: string;
  dateTimeRangeLabel: string;
  venueCourtsUrl: string;
  bookingHistoryUrl?: string;
  footerHtml?: string;
}

function formatSubjectConfirmation(variant: "created" | "rescheduled"): string {
  return variant === "rescheduled"
    ? "Your court booking was updated"
    : "Your court booking is confirmed";
}

function formatTitleConfirmation(variant: "created" | "rescheduled"): string {
  return variant === "rescheduled"
    ? "Booking rescheduled"
    : "Booking confirmed";
}

function leadConfirmation(variant: "created" | "rescheduled"): string {
  return variant === "rescheduled"
    ? "Your booking has been successfully updated. Here are the new details:"
    : "Thanks for booking with us. Here are your details:";
}

export function renderBookingConfirmationEmail(
  input: BookingConfirmationTemplateInput,
): {
  templateId: typeof MailTemplateId.BOOKING_CONFIRMATION;
  subject: string;
  html: string;
} {
  const title = formatTitleConfirmation(input.variant);
  const lead = leadConfirmation(input.variant);
  const extra = input.extraBodyHtml ?? "";
  const bodyHtml = `
    <p style="margin:0 0 12px;">${escapeHtml(lead)}</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#334155;">
      <li><strong>Venue:</strong> ${escapeHtml(input.locationName)}</li>
      <li><strong>Court:</strong> ${escapeHtml(input.courtName)}</li>
      <li><strong>Date/Time:</strong> ${escapeHtml(input.dateTimeRangeLabel)}</li>
    </ul>
    ${extra}
    <p style="margin:16px 0 0;">
      <a href="${escapeHtml(input.venueCourtsUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Open this venue &amp; courts</a>
    </p>
    <p style="margin:16px 0 0;font-size:14px;color:#64748b;">If the button does not work, copy this link:<br /><span style="word-break:break-all;">${escapeHtml(input.venueCourtsUrl)}</span></p>
    ${
      input.bookingHistoryUrl
        ? `<p style="margin:12px 0 0;font-size:14px;color:#64748b;"><a href="${escapeHtml(input.bookingHistoryUrl)}" style="color:#0f766e;font-weight:600;">View your bookings</a></p>`
        : ""
    }
  `;
  return {
    templateId: MailTemplateId.BOOKING_CONFIRMATION,
    subject: formatSubjectConfirmation(input.variant),
    html: renderMailLayout({
      title,
      bodyHtml,
      footerHtml: input.footerHtml,
    }),
  };
}

export function renderBookingCancelledEmail(
  input: BookingCancelledTemplateInput,
): {
  templateId: typeof MailTemplateId.BOOKING_CANCELLED;
  subject: string;
  html: string;
} {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(input.userDisplayName)},</p>
    <p style="margin:0 0 12px;">Your court booking has been <strong>cancelled</strong>.</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#334155;">
      <li><strong>Venue:</strong> ${escapeHtml(input.locationName)}</li>
      <li><strong>Court:</strong> ${escapeHtml(input.courtName)}</li>
      <li><strong>Date/Time:</strong> ${escapeHtml(input.dateTimeRangeLabel)}</li>
    </ul>
    <p style="margin:16px 0 0;">
      <a href="${escapeHtml(input.venueCourtsUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Book another time</a>
    </p>
    ${
      input.bookingHistoryUrl
        ? `<p style="margin:12px 0 0;font-size:14px;color:#64748b;"><a href="${escapeHtml(input.bookingHistoryUrl)}" style="color:#0f766e;font-weight:600;">View your bookings</a></p>`
        : ""
    }
  `;
  return {
    templateId: MailTemplateId.BOOKING_CANCELLED,
    subject: "Your court booking was cancelled",
    html: renderMailLayout({
      title: "Booking cancelled",
      bodyHtml,
      footerHtml: input.footerHtml,
    }),
  };
}

export function renderBookingReminder30mEmail(
  input: BookingReminderTemplateInput,
): {
  templateId: typeof MailTemplateId.BOOKING_REMINDER_30M;
  subject: string;
  html: string;
} {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(input.userDisplayName)},</p>
    <p style="margin:0 0 12px;">Your court session starts in about <strong>30 minutes</strong>.</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#334155;">
      <li><strong>Venue:</strong> ${escapeHtml(input.locationName)}</li>
      <li><strong>Court:</strong> ${escapeHtml(input.courtName)}</li>
      <li><strong>Date/Time:</strong> ${escapeHtml(input.dateTimeRangeLabel)}</li>
    </ul>
    <p style="margin:16px 0 0;">
      <a href="${escapeHtml(input.venueCourtsUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Open this venue &amp; courts</a>
    </p>
    ${
      input.bookingHistoryUrl
        ? `<p style="margin:12px 0 0;font-size:14px;color:#64748b;"><a href="${escapeHtml(input.bookingHistoryUrl)}" style="color:#0f766e;font-weight:600;">View your bookings</a></p>`
        : ""
    }
  `;
  return {
    templateId: MailTemplateId.BOOKING_REMINDER_30M,
    subject: "Reminder: your court booking starts in 30 minutes",
    html: renderMailLayout({
      title: "Starting soon",
      bodyHtml,
      footerHtml: input.footerHtml,
    }),
  };
}

/** Local start–end times at venue (24h), e.g. `19:30 - 21:00`. */
export function formatBookingTimeRangeShort(
  startAt: Date,
  endAt: Date,
  ianaTimeZone: string,
): string {
  const timeOpts: Intl.DateTimeFormatOptions = {
    timeZone: ianaTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  const start = new Intl.DateTimeFormat("en-GB", timeOpts).format(startAt);
  const end = new Intl.DateTimeFormat("en-GB", timeOpts).format(endAt);
  return `${start} - ${end}`;
}

/** Long-form local range (legacy / other use). */
export function formatBookingWindowLocal(
  startAt: Date,
  endAt: Date,
  ianaTimeZone: string,
  locale = "vi-VN",
): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: ianaTimeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  const a = new Intl.DateTimeFormat(locale, opts).format(startAt);
  const b = new Intl.DateTimeFormat(locale, {
    timeZone: ianaTimeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(endAt);
  return `${a} – ${b}`;
}
