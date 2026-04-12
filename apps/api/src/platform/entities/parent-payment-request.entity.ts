import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity("parent_payment_requests")
export class ParentPaymentRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  parentUserId: string;

  @Column({ type: "uuid" })
  childUserId: string;

  @Column({ type: "int" })
  amountCents: number;

  @Column({ type: "varchar", length: 8, default: "USD" })
  currency: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "varchar", length: 32, default: "pending" })
  status: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  externalPaymentRef: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "parentUserId" })
  parent: User;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "childUserId" })
  child: User;
}
