import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Coach } from "../../coaches/entities/coach.entity";

@Entity("player_metric_snapshots")
export class PlayerMetricSnapshot {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  playerUserId: string;

  @Column({ type: "uuid", nullable: true })
  coachId: string | null;

  @CreateDateColumn({ name: "recordedAt", type: "timestamptz" })
  recordedAt: Date;

  @Column({ type: "jsonb", default: {} })
  scores: Record<string, number>;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "playerUserId" })
  player: User;

  @ManyToOne(() => Coach, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "coachId" })
  coach: Coach | null;
}
