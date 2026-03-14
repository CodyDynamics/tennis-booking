import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Coach } from "../../coaches/entities/coach.entity";
import { Court } from "../../courts/entities/court.entity";

export enum CoachSessionType {
  PRIVATE = "private",
  GROUP = "group",
}

export enum CoachSessionStatus {
  SCHEDULED = "scheduled",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

@Entity("coach_sessions")
export class CoachSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: true })
  organizationId: string | null;

  @Column({ type: "varchar", nullable: true })
  branchId: string | null;

  @Column()
  coachId: string;

  @Column({ type: "varchar", nullable: true })
  bookedById: string | null; // user who booked this session

  @Column({ type: "varchar", nullable: true })
  courtId: string | null;

  @Column({ type: "date" })
  sessionDate: Date;

  @Column({ type: "time" })
  startTime: string;

  @Column({ type: "int" })
  durationMinutes: number;

  @Column({ type: "varchar", default: CoachSessionType.PRIVATE })
  sessionType: CoachSessionType;

  @Column({ type: "varchar", default: CoachSessionStatus.SCHEDULED })
  status: CoachSessionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Coach, { onDelete: "CASCADE" })
  @JoinColumn({ name: "coachId" })
  coach: Coach;

  @ManyToOne(() => Court, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "courtId" })
  court: Court | null;
}
