import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity("training_videos")
export class TrainingVideo {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  uploaderUserId: string;

  @Column({ type: "uuid" })
  playerUserId: string;

  @Column({ type: "varchar", length: 512 })
  storageKey: string;

  @Column({ type: "varchar", length: 32, default: "pending_review" })
  status: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "uploaderUserId" })
  uploader: User;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "playerUserId" })
  player: User;
}
