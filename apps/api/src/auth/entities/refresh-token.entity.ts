import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/** Opaque refresh token stored as SHA-256 hash (raw token only in HttpOnly cookie). */
@Entity("refresh_tokens")
@Index(["userId"])
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  userId: string;

  @Column({ unique: true })
  tokenHash: string;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  /** Matches "Remember me" (longer refresh cookie / DB row). */
  @Column({ default: false })
  longSession: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
