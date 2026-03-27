import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CourtBooking } from "../bookings/entities/court-booking.entity";
import { MailSenderService } from "./mail-sender.service";
import { BookingMailService } from "./booking-mail.service";
import { BookingReminderScheduler } from "./booking-reminder.scheduler";
import { UserNotificationsService } from "./user-notifications.service";
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [TypeOrmModule.forFeature([CourtBooking])],
  controllers: [NotificationsController],
  providers: [
    MailSenderService,
    BookingMailService,
    BookingReminderScheduler,
    UserNotificationsService,
  ],
  exports: [
    MailSenderService,
    BookingMailService,
    UserNotificationsService,
  ],
})
export class NotificationsModule {}
