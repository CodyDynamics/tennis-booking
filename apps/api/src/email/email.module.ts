import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { EmailService } from "./email.service";

@Module({
  imports: [NotificationsModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
