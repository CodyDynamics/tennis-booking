import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("branches")
export class Branch {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: true })
  organizationId: string | null;

  @Column()
  name: string;

  @Column({ type: "varchar", nullable: true })
  address: string | null;

  @Column({ type: "varchar", nullable: true })
  phone: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
