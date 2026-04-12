import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@app/common";
import { PlatformService } from "./platform.service";
import { UpdatePersonaDto } from "./dto/update-persona.dto";
import { CreateParentLinkDto } from "./dto/parent-link.dto";
import { CreateRosterEntryDto } from "./dto/roster.dto";
import { CreateMetricSnapshotDto } from "./dto/metric-snapshot.dto";
import { CreateTrainingPlanDto } from "./dto/training-plan.dto";
import { CreateFeedbackNoteDto } from "./dto/feedback.dto";
import { PresignVideoDto, RegisterTrainingVideoDto } from "./dto/video.dto";
import { CreateParentPaymentDto } from "./dto/parent-payment.dto";
import { PatchCoachSessionDto } from "./dto/patch-coach-session.dto";

@ApiTags("Platform")
@ApiBearerAuth("JWT")
@Controller("platform")
@UseGuards(JwtAuthGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get("me/persona")
  @ApiOperation({ summary: "Mobile onboarding: get app persona flags" })
  getPersona(@CurrentUser() user: { id: string }) {
    return this.platformService.getPersona(user.id);
  }

  @Patch("me/persona")
  @ApiOperation({ summary: "Mobile onboarding: set coach | player | parent persona" })
  patchPersona(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePersonaDto,
  ) {
    return this.platformService.updatePersona(user.id, dto);
  }

  @Get("parent/children")
  @ApiOperation({ summary: "List linked child accounts for parent view" })
  listChildren(@CurrentUser() user: { id: string }) {
    return this.platformService.listParentChildren(user.id);
  }

  @Post("parent/links")
  @ApiOperation({ summary: "Link current user as parent to an existing child user" })
  createParentLink(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateParentLinkDto,
  ) {
    return this.platformService.createParentLink(user.id, dto);
  }

  @Get("coach/sessions")
  @ApiOperation({ summary: "Coach calendar: sessions for the signed-in coach profile" })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  listCoachSessions(
    @CurrentUser() user: { id: string },
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.platformService.listCoachSessions(user.id, from, to);
  }

  @Patch("coach/sessions/:sessionId")
  @ApiOperation({ summary: "Update coach session status (owner coach only)" })
  patchCoachSession(
    @CurrentUser() user: { id: string },
    @Param("sessionId") sessionId: string,
    @Body() dto: PatchCoachSessionDto,
  ) {
    return this.platformService.patchCoachSession(user.id, sessionId, dto);
  }

  @Get("coach/roster")
  @ApiOperation({ summary: "List students on the coach roster" })
  listRoster(@CurrentUser() user: { id: string }) {
    return this.platformService.listRoster(user.id);
  }

  @Post("coach/roster")
  @ApiOperation({ summary: "Add or reactivate a student on the roster" })
  addRoster(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateRosterEntryDto,
  ) {
    return this.platformService.addRosterEntry(user.id, dto);
  }

  @Delete("coach/roster/:studentUserId")
  @ApiOperation({ summary: "Remove (deactivate) a roster entry" })
  removeRoster(
    @CurrentUser() user: { id: string },
    @Param("studentUserId") studentUserId: string,
  ) {
    return this.platformService.removeRosterEntry(user.id, studentUserId);
  }

  @Get("players/:playerId/metrics")
  @ApiOperation({ summary: "Performance snapshots for a player (self, parent, or roster coach)" })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  listMetrics(
    @CurrentUser() user: { id: string },
    @Param("playerId") playerId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.platformService.listMetricSnapshots(user.id, playerId, from, to);
  }

  @Post("players/:playerId/metrics")
  @ApiOperation({ summary: "Create a metric snapshot (player or their coach)" })
  createMetric(
    @CurrentUser() user: { id: string },
    @Param("playerId") playerId: string,
    @Body() dto: CreateMetricSnapshotDto,
  ) {
    return this.platformService.createMetricSnapshot(user.id, playerId, dto);
  }

  @Get("training/plans")
  @ApiOperation({ summary: "Training plans for a player" })
  @ApiQuery({ name: "playerUserId", required: true })
  listTrainingPlans(
    @CurrentUser() user: { id: string },
    @Query("playerUserId") playerUserId: string,
  ) {
    return this.platformService.listTrainingPlans(user.id, playerUserId);
  }

  @Post("training/plans")
  @ApiOperation({ summary: "Create a training plan with items (coach)" })
  createTrainingPlan(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTrainingPlanDto,
  ) {
    return this.platformService.createTrainingPlan(user.id, dto);
  }

  @Post("training/items/:itemId/complete")
  @ApiOperation({ summary: "Mark a training item complete (player only)" })
  completeItem(
    @CurrentUser() user: { id: string },
    @Param("itemId") itemId: string,
  ) {
    return this.platformService.completeTrainingItem(user.id, itemId);
  }

  @Get("feedback")
  @ApiOperation({ summary: "List feedback notes for a session or court booking" })
  @ApiQuery({ name: "coachSessionId", required: false })
  @ApiQuery({ name: "courtBookingId", required: false })
  listFeedback(
    @CurrentUser() user: { id: string },
    @Query("coachSessionId") coachSessionId?: string,
    @Query("courtBookingId") courtBookingId?: string,
  ) {
    return this.platformService.listFeedback(user.id, coachSessionId, courtBookingId);
  }

  @Post("feedback")
  @ApiOperation({ summary: "Create a feedback note" })
  createFeedback(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateFeedbackNoteDto,
  ) {
    return this.platformService.createFeedback(user.id, dto);
  }

  @Post("videos/presign")
  @ApiOperation({
    summary: "Mock presign for training video upload (configure S3 for production)",
  })
  presignVideo(
    @CurrentUser() user: { id: string },
    @Body() dto: PresignVideoDto,
  ) {
    return this.platformService.presignTrainingVideo(user.id, dto);
  }

  @Post("videos")
  @ApiOperation({ summary: "Register uploaded training video metadata" })
  registerVideo(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterTrainingVideoDto,
  ) {
    return this.platformService.registerTrainingVideo(user.id, dto);
  }

  @Get("parent/payments")
  @ApiOperation({ summary: "Payment requests created by the parent" })
  listPayments(@CurrentUser() user: { id: string }) {
    return this.platformService.listParentPayments(user.id);
  }

  @Post("parent/payments")
  @ApiOperation({ summary: "Create a pending payment request for a linked child" })
  createPayment(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateParentPaymentDto,
  ) {
    return this.platformService.createParentPayment(user.id, dto);
  }

  @Get("gamification/achievements")
  @ApiOperation({ summary: "Catalog of achievements" })
  listAchievements() {
    return this.platformService.listAchievements();
  }

  @Get("gamification/me")
  @ApiOperation({ summary: "Achievements earned by the current user" })
  listMyAchievements(@CurrentUser() user: { id: string }) {
    return this.platformService.listMyAchievements(user.id);
  }
}
