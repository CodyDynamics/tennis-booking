import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Location } from "../../locations/entities/location.entity";
import { MembershipStatus } from "./membership.enums";

@Entity("user_location_memberships")
@Unique(["userId", "locationId"])
export class UserLocationMembership {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  locationId: string;

  @Column({ type: "varchar", default: MembershipStatus.PENDING_PAYMENT })
  status: MembershipStatus;

  @Column({ type: "timestamptz", nullable: true })
  initiationPaidAt: Date | null;

  @Column({ type: "date", nullable: true })
  currentPeriodStart: Date | null;

  @Column({ type: "date", nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  lastMonthlyPaidAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Location, { onDelete: "CASCADE" })
  @JoinColumn({ name: "locationId" })
  location: Location;
}
