import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Coach } from "../../coaches/entities/coach.entity";
import { User } from "../../users/entities/user.entity";
import { TrainingPlanItem } from "./training-plan-item.entity";

@Entity("training_plans")
export class TrainingPlan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  coachId: string;

  @Column({ type: "uuid" })
  playerUserId: string;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;

  @ManyToOne(() => Coach, { onDelete: "CASCADE" })
  @JoinColumn({ name: "coachId" })
  coach: Coach;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "playerUserId" })
  player: User;

  @OneToMany(() => TrainingPlanItem, (i) => i.plan)
  items: TrainingPlanItem[];
}
