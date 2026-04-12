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
import { Role } from "../../roles/entities/role.entity";
import { Court } from "../../courts/entities/court.entity";
import { UserAccountType } from "./user-account-type.enum";

@Entity("users")
@Unique(["email"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", nullable: true })
  roleId: string | null;

  @Column()
  email: string;

  @Column({ type: "varchar", nullable: true })
  passwordHash: string | null;

  @Column()
  fullName: string;

  @Column({ type: "varchar", nullable: true })
  firstName: string | null;

  @Column({ type: "varchar", nullable: true })
  lastName: string | null;

  /** Required for registered users; OAuth signups may use placeholder until profile completion */
  @Column({ type: "varchar" })
  phone: string;

  @Column({ type: "text", nullable: true })
  homeAddress: string | null;

  @Column({ type: "varchar", nullable: true })
  avatarUrl: string | null;

  @Column({ default: "active" })
  status: string;

  @Column({ type: "boolean", default: false })
  mustChangePasswordOnFirstLogin: boolean;

  @Column({ type: "varchar", nullable: true })
  googleId: string | null;

  /**
   * Coach (or staff) primary court assignment: many users can share one court;
   * each user has at most one court. Null = not tied to a facility court.
   */
  @Column({ type: "uuid", nullable: true })
  courtId: string | null;

  /**
   * Directory listing on /coaches: only `public` users with no courtId appear.
   */
  @Column({ type: "varchar", length: 16, default: "public" })
  visibility: "public" | "private";

  @Column({
    type: "varchar",
    length: 32,
    default: UserAccountType.NORMAL,
  })
  accountType: UserAccountType;

  /** Mobile onboarding persona (coach | player | parent); independent of RBAC role. */
  @Column({ type: "varchar", length: 16, nullable: true })
  appPersona: string | null;

  @Column({ type: "timestamptz", nullable: true })
  onboardingCompletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Role, { eager: true, nullable: true })
  @JoinColumn({ name: "roleId" })
  role: Role | null;

  @ManyToOne(() => Court, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "courtId" })
  court: Court | null;
}
