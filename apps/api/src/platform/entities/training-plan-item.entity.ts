import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { TrainingPlan } from "./training-plan.entity";
import { TrainingPlanCompletion } from "./training-plan-completion.entity";

@Entity("training_plan_items")
export class TrainingPlanItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  planId: string;

  @Column({ type: "text" })
  title: string;

  @Column({ type: "int", default: 0 })
  sortOrder: number;

  @Column({ type: "date", nullable: true })
  dueDate: string | null;

  @ManyToOne(() => TrainingPlan, (p) => p.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "planId" })
  plan: TrainingPlan;

  @OneToMany(() => TrainingPlanCompletion, (c) => c.item)
  completions: TrainingPlanCompletion[];
}
