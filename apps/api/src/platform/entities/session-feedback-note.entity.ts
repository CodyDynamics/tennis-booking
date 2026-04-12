import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { CoachSession } from "../../bookings/entities/coach-session.entity";
import { CourtBooking } from "../../bookings/entities/court-booking.entity";

@Entity("session_feedback_notes")
export class SessionFeedbackNote {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", nullable: true })
  coachSessionId: string | null;

  @Column({ type: "uuid", nullable: true })
  courtBookingId: string | null;

  @Column({ type: "uuid" })
  authorUserId: string;

  @Column({ type: "text" })
  body: string;

  @Column({ type: "varchar", length: 32, default: "coach_player" })
  visibility: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "authorUserId" })
  author: User;

  @ManyToOne(() => CoachSession, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "coachSessionId" })
  coachSession: CoachSession | null;

  @ManyToOne(() => CourtBooking, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "courtBookingId" })
  courtBooking: CourtBooking | null;
}
