import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("achievements")
export class Achievement {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 64, unique: true })
  code: string;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string | null;
}
