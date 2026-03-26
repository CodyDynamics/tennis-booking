import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Location } from "./location.entity";
import { Court } from "../../courts/entities/court.entity";

@Entity("location_booking_windows")
export class LocationBookingWindow {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  locationId: string;

  /** Optional per-court override. Null means location-level window for sport+courtType. */
  @Column({ type: "uuid", nullable: true })
  courtId: string | null;

  @Column({ type: "varchar" })
  sport: string; // tennis | pickleball

  @Column({ type: "varchar" })
  courtType: string; // indoor | outdoor

  @Column({ type: "time" })
  windowStartTime: string;

  @Column({ type: "time" })
  windowEndTime: string;

  /** JSON array of allowed durations in minutes, e.g. "[30,60,90]" */
  @Column({ type: "text" })
  allowedDurationMinutes: string;

  @Column({ type: "int", default: 30 })
  slotGridMinutes: number;

  @Column({ type: "int", default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Location, { onDelete: "CASCADE" })
  @JoinColumn({ name: "locationId" })
  location: Location;

  @ManyToOne(() => Court, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "courtId" })
  court: Court | null;
}
