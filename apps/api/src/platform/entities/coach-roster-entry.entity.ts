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
import { Coach } from "../../coaches/entities/coach.entity";
import { User } from "../../users/entities/user.entity";

@Entity("coach_roster_entries")
@Unique(["coachId", "studentUserId"])
export class CoachRosterEntry {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  coachId: string;

  @Column({ type: "uuid" })
  studentUserId: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  skillLevel: string | null;

  @Column({ type: "varchar", default: "active" })
  status: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;

  @ManyToOne(() => Coach, { onDelete: "CASCADE" })
  @JoinColumn({ name: "coachId" })
  coach: Coach;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "studentUserId" })
  student: User;
}
