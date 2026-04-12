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
import { TrainingPlanItem } from "./training-plan-item.entity";

@Entity("training_plan_completions")
@Unique(["itemId", "userId"])
export class TrainingPlanCompletion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  itemId: string;

  @Column({ type: "uuid" })
  userId: string;

  @CreateDateColumn({ type: "timestamptz" })
  completedAt: Date;

  @ManyToOne(() => TrainingPlanItem, (i) => i.completions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "itemId" })
  item: TrainingPlanItem;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}
