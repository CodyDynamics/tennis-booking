import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { UserLocationMembership } from "./user-location-membership.entity";
import { MembershipTransactionType } from "./membership.enums";

@Entity("membership_transactions")
export class MembershipTransaction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userLocationMembershipId: string;

  @Column({ type: "varchar" })
  type: MembershipTransactionType;

  @Column({ type: "int" })
  amountCents: number;

  @Column({ type: "varchar", length: 8, default: "USD" })
  currency: string;

  @Column({ type: "varchar", nullable: true })
  periodLabel: string | null;

  @Column({ type: "varchar", nullable: true })
  externalPaymentId: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @ManyToOne(() => UserLocationMembership, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userLocationMembershipId" })
  membership: UserLocationMembership;
}
