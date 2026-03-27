import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Delete,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { BookingsService } from "./bookings.service";
import { CreateCourtBookingDto } from "./dto/create-court-booking.dto";
import { CreateCourtSlotBookingDto } from "./dto/create-court-slot-booking.dto";
import { CreateCoachSessionDto } from "./dto/create-coach-session.dto";
import {
  CourtWizardAvailabilityQueryDto,
  CourtWizardWindowsQueryDto,
  CourtSlotQueryDto,
} from "./dto/court-wizard-query.dto";
import { JwtAuthGuard } from "@app/common";
import { CurrentUser } from "@app/common";

@ApiTags("Bookings")
@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get("court/wizard/windows")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({
    summary:
      "Booking wizard: list time windows (location_booking_windows) for sport + indoor/outdoor",
  })
  @ApiResponse({ status: 200, description: "Array of window configs" })
  getCourtWizardWindows(
    @CurrentUser() user: { id: string },
    @Query() query: CourtWizardWindowsQueryDto,
  ) {
    return this.bookingsService.getWizardWindows(user.id, query);
  }

  @Get("court/wizard/availability")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({
    summary:
      "Booking wizard: slots on grid inside window + courts with at least one free slot",
  })
  @ApiResponse({ status: 200, description: "slots + courts summaries" })
  getCourtWizardAvailability(
    @CurrentUser() user: { id: string },
    @Query() query: CourtWizardAvailabilityQueryDto,
  ) {
    return this.bookingsService.getWizardAvailability(user.id, query);
  }

  @Get("court/wizard/slots")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({
    summary: "New flow: available time slots for date+duration (no window selection, no court names)",
  })
  @ApiResponse({ status: 200, description: "{ slots: [{ startTime, endTime, availableCount, totalCount }] }" })
  getCourtSlots(
    @CurrentUser() user: { id: string },
    @Query() query: CourtSlotQueryDto,
  ) {
    return this.bookingsService.getAvailableSlots(user.id, query);
  }

  @Post("court/slot")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "New flow: book a slot (system assigns random available court)" })
  @ApiBody({ type: CreateCourtSlotBookingDto })
  @ApiResponse({ status: 201, description: "Booking created with system-assigned court" })
  @ApiResponse({ status: 409, description: "All courts taken for this slot" })
  createSlotBooking(
    @Body() dto: CreateCourtSlotBookingDto,
    @CurrentUser() user: { id: string; organizationId?: string; branchId?: string },
  ) {
    return this.bookingsService.createSlotBooking(
      user.id,
      dto,
      user.organizationId,
      user.branchId,
    );
  }

  @Patch("court/slot/:bookingId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Reschedule slot booking (updates same row, new time/court)" })
  @ApiParam({ name: "bookingId", description: "Existing court_bookings.id" })
  @ApiBody({ type: CreateCourtSlotBookingDto })
  @ApiResponse({ status: 200, description: "Booking updated" })
  @ApiResponse({ status: 409, description: "Slot no longer available" })
  updateSlotBooking(
    @Param("bookingId") bookingId: string,
    @Body() dto: CreateCourtSlotBookingDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.updateSlotBooking(user.id, bookingId, dto);
  }

  @Post("court")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Book court (optional with coach)" })
  @ApiBody({ type: CreateCourtBookingDto })
  @ApiResponse({ status: 201, description: "Booking created", schema: { type: "object", properties: { id: { type: "string" }, kind: { type: "string", example: "court" }, summary: { type: "string" } } } })
  @ApiResponse({ status: 400, description: "Court not available or invalid data" })
  createCourtBooking(
    @Body() dto: CreateCourtBookingDto,
    @CurrentUser() user: { id: string; organizationId?: string; branchId?: string },
  ) {
    return this.bookingsService.createCourtBooking(
      user.id,
      dto,
      user.organizationId,
      user.branchId,
    );
  }

  @Get("court/availability")
  @ApiOperation({ summary: "Get available court slots by date" })
  @ApiQuery({ name: "courtId", required: true, description: "Court UUID" })
  @ApiQuery({ name: "date", required: true, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "slotMinutes", required: false, description: "Slot length in minutes", example: "60" })
  @ApiResponse({ status: 200, description: "Array of { start, end } available slots" })
  getCourtAvailability(
    @Query("courtId") courtId: string,
    @Query("date") date: string,
    @Query("slotMinutes") slotMinutes?: string,
  ) {
    return this.bookingsService.getCourtAvailability(
      courtId,
      date,
      slotMinutes ? parseInt(slotMinutes, 10) : undefined,
    );
  }

  @Post("coach")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Book coach (with or without court)" })
  @ApiBody({ type: CreateCoachSessionDto })
  @ApiResponse({ status: 201, description: "Session created", schema: { type: "object", properties: { id: { type: "string" }, kind: { type: "string", example: "coach" }, summary: { type: "string" } } } })
  @ApiResponse({ status: 400, description: "Coach not available or invalid data" })
  createCoachSession(
    @Body() dto: CreateCoachSessionDto,
    @CurrentUser() user: { id: string; organizationId?: string; branchId?: string },
  ) {
    return this.bookingsService.createCoachSession(
      user.id,
      dto,
      user.organizationId,
      user.branchId,
    );
  }

  @Get("my")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "List current user bookings (court + coach)" })
  @ApiQuery({ name: "from", required: false, description: "From date (YYYY-MM-DD)" })
  @ApiQuery({ name: "to", required: false, description: "To date (YYYY-MM-DD)" })
  @ApiResponse({ status: 200, description: "{ courtBookings: [], coachSessions: [] }" })
  findMyBookings(
    @CurrentUser() user: { id: string },
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.bookingsService.findMyBookings(user.id, from, to);
  }

  @Get(":kind/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Get booking by id" })
  @ApiParam({ name: "kind", enum: ["court", "coach"] })
  @ApiParam({ name: "id", description: "Booking UUID" })
  @ApiResponse({ status: 200, description: "{ kind, data }" })
  @ApiResponse({ status: 404, description: "Booking not found" })
  findOne(
    @Param("kind") kind: "court" | "coach",
    @Param("id") id: string,
  ) {
    return this.bookingsService.findBooking(id, kind);
  }

  @Delete(":kind/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Cancel booking" })
  @ApiParam({ name: "kind", enum: ["court", "coach"] })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, description: "Cancel successful" })
  @ApiResponse({ status: 403, description: "Can only cancel own booking" })
  cancel(
    @Param("kind") kind: "court" | "coach",
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.cancelBooking(id, kind, user.id);
  }
}
