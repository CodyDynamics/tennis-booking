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

@Entity("location_booking_windows")
export class LocationBookingWindow {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  locationId: string;

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
}
