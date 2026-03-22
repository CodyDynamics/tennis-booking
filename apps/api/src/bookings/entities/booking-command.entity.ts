import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Optional outbox for async court booking: idempotency + worker state.
 * RabbitMQ consumers should still rely on DB constraints (see docs/BOOKING_CONCURRENCY_AND_QUEUE.md).
 */
export enum BookingCommandStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
}

@Entity("booking_commands")
export class BookingCommand {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Client or server-generated; UNIQUE prevents duplicate work. */
  @Column({ unique: true })
  idempotencyKey: string;

  @Column()
  userId: string;

  @Column({ type: "varchar", default: "court_booking" })
  commandType: string;

  @Column({ type: "jsonb" })
  payload: Record<string, unknown>;

  @Column({
    type: "varchar",
    default: BookingCommandStatus.PENDING,
  })
  status: BookingCommandStatus;

  @Column({ type: "text", nullable: true })
  failureReason: string | null;

  @Column({ type: "uuid", nullable: true })
  resultCourtBookingId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  processedAt: Date | null;
}
