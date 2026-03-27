import { Injectable, Logger } from "@nestjs/common";

/**
 * Placeholder for future in-app / push notifications.
 * Booking emails are handled by {@link BookingMailService}.
 */
@Injectable()
export class UserNotificationsService {
  private readonly logger = new Logger(UserNotificationsService.name);

  // Reserved: list unread, mark read, websocket fan-out, etc.
  ping(): void {
    this.logger.debug("UserNotificationsService: in-app channel not implemented yet");
  }
}
