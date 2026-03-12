import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("password_reset_tokens")
export class PasswordResetToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column({ unique: true })
  token: string;

  @Column({ type: "timestamp" })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.passwordResetTokens, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}
