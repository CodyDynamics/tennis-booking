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

@Entity("users")
@Unique(["organizationId", "email"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: true })
  organizationId: string | null;

  @Column({ type: "varchar", nullable: true })
  branchId: string | null;

  @Column()
  roleId: string;

  @Column()
  email: string;

  @Column({ type: "varchar", nullable: true })
  passwordHash: string | null;

  @Column()
  fullName: string;

  @Column({ type: "varchar", nullable: true })
  phone: string | null;

  @Column({ type: "varchar", nullable: true })
  avatarUrl: string | null;

  @Column({ default: "active" })
  status: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: "roleId" })
  role: Role;

  @ManyToOne(() => Court, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "courtId" })
  court: Court | null;
}
