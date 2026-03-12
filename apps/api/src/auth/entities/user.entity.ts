import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from "typeorm";
import { Role } from "./role.entity";
import { PasswordResetToken } from "./password-reset-token.entity";

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Role, (role) => role.users, { eager: true })
  @JoinColumn({ name: "roleId" })
  role: Role;

  @OneToMany(() => PasswordResetToken, (token) => token.user)
  passwordResetTokens: PasswordResetToken[];
}
