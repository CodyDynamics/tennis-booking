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

@Entity("parent_guardian_links")
@Unique(["parentUserId", "childUserId"])
export class ParentGuardianLink {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  parentUserId: string;

  @Column({ type: "uuid" })
  childUserId: string;

  @Column({ type: "varchar", default: "active" })
  status: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "parentUserId" })
  parent: User;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "childUserId" })
  child: User;
}
