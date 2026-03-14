/**
 * OOP: Booking là cha. Mỗi loại booking (sân, coach) implement interface này.
 * Parent (BookingService) ủy quyền cho từng handler tương ứng.
 */
export type BookingKind = "court" | "coach";

export interface IBookingHandler {
  readonly kind: BookingKind;

  /**
   * Create a new booking of this kind.
   * Returns the created entity id and summary.
   */
  create(params: CreateBookingParams): Promise<CreateBookingResult>;

  /**
   * Cancel a booking by id (if it belongs to this handler).
   */
  cancel(bookingId: string, userId: string): Promise<void>;

  /**
   * Find one booking by id (if it belongs to this handler).
   */
  findOne(bookingId: string): Promise<unknown | null>;

  /**
   * List bookings for a user (this kind only).
   */
  findByUser(userId: string, from?: Date, to?: Date): Promise<unknown[]>;
}

export interface CreateBookingParams {
  userId: string;
  organizationId?: string | null;
  branchId?: string | null;
  [key: string]: unknown;
}

export interface CreateBookingResult {
  id: string;
  kind: BookingKind;
  summary: string;
}
