import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard, PermissionsGuard, RequirePermission } from "@app/common";
import { MailSenderService } from "./mail-sender.service";
import { SendResendTestEmailDto } from "./dto/send-resend-test-email.dto";

@ApiTags("Notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly mailSender: MailSenderService) {}

  @Post("test-email/resend")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("locations:update")
  @ApiBearerAuth("JWT")
  @ApiOperation({
    summary: "Send Resend test email to resend.dev scenario inbox",
  })
  @ApiResponse({ status: 200 })
  async sendResendTest(@Body() dto: SendResendTestEmailDto) {
    return this.mailSender.sendResendTestEmail(dto);
  }
}
