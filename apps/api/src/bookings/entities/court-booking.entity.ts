import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Court } from "../../courts/entities/court.entity";
import { Coach } from "../../coaches/entities/coach.entity";
import { User } from "../../users/entities/user.entity";
import { Location } from "../../locations/entities/location.entity";
import { LocationBookingWindow } from "../../locations/entities/location-booking-window.entity";
import { UserLocationMembership } from "../../memberships/entities/user-location-membership.entity";

export enum CourtBookingType {
  COURT_ONLY = "COURT_ONLY",
  COURT_COACH = "COURT_COACH",
}

export enum CourtBookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
}

export enum PaymentStatus {
  UNPAID = "unpaid",
  PAID = "paid",
  REFUNDED = "refunded",
}

export enum CourtPricingTier {
  PUBLIC = "public",
  MEMBER = "member",
}

@Entity("court_bookings")
@Index(["courtId", "bookingDate"])
export class CourtBooking {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: true })
  organizationId: string | null;

  @Column({ type: "varchar", nullable: true })
  branchId: string | null;

  @Column({ type: "uuid", nullable: true })
  locationId: string | null;

  @Column({ type: "varchar", nullable: true })
  sport: string | null;

  @Column({ type: "varchar", nullable: true })
  courtType: string | null;

  @Column({ type: "uuid", nullable: true })
  locationBookingWindowId: string | null;

  @Column({ type: "varchar", default: CourtPricingTier.PUBLIC })
  pricingTier: CourtPricingTier;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  unitPricePerHourSnapshot: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  discountAmount: string | null;

  @Column({ type: "uuid", nullable: true })
  userLocationMembershipId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  bookingStartAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  bookingEndAt: Date | null;

  @Column()
  courtId: string;

  @Column()
  userId: string;

  @Column({ type: "varchar", nullable: true })
  coachId: string | null;

  @Column({ type: "varchar", default: CourtBookingType.COURT_ONLY })
  bookingType: CourtBookingType;

  @Column({ type: "date" })
  bookingDate: Date;

  @Column({ type: "time" })
  startTime: string;

  @Column({ type: "time" })
  endTime: string;

  @Column({ type: "int" })
  durationMinutes: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  totalPrice: string;

  @Column({ type: "varchar", default: PaymentStatus.UNPAID })
  paymentStatus: PaymentStatus;

  @Column({ type: "varchar", default: CourtBookingStatus.PENDING })
  bookingStatus: CourtBookingStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Court, { onDelete: "CASCADE" })
  @JoinColumn({ name: "courtId" })
  court: Court;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Coach, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "coachId" })
  coach: Coach | null;

  @ManyToOne(() => Location, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "locationId" })
  location: Location | null;

  @ManyToOne(() => LocationBookingWindow, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "locationBookingWindowId" })
  locationBookingWindow: LocationBookingWindow | null;

  @ManyToOne(() => UserLocationMembership, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "userLocationMembershipId" })
  userLocationMembership: UserLocationMembership | null;
}
