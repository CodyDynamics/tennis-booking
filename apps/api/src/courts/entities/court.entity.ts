import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Branch } from "../../branches/entities/branch.entity";

@Entity("courts")
export class Court {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  branchId: string;

  @Column()
  name: string;

  @Column({ type: "varchar", default: "outdoor" })
  type: string; // indoor | outdoor

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  pricePerHour: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ default: "active" })
  status: string; // active | maintenance

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Branch, { onDelete: "CASCADE" })
  @JoinColumn({ name: "branchId" })
  branch: Branch;
}
