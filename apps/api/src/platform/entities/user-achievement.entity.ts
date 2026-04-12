import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Achievement } from "./achievement.entity";

@Entity("user_achievements")
@Unique(["userId", "achievementId"])
export class UserAchievement {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid" })
  achievementId: string;

  @CreateDateColumn({ type: "timestamptz" })
  earnedAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Achievement, { onDelete: "CASCADE" })
  @JoinColumn({ name: "achievementId" })
  achievement: Achievement;
}
