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

@Entity("locations")
export class Location {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  branchId: string;

  @Column()
  name: string;

  @Column({ type: "varchar", nullable: true })
  address: string | null;

  /** Map center latitude (WGS84), decimal string from DB */
  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  /** Map center longitude (WGS84) */
  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  /**
   * JSON array of demo markers near this location:
   * `[{ "lat": number, "lng": number, "label": string }]`
   */
  @Column({ type: "text", nullable: true })
  mapMarkers: string | null;

  @Column({ default: "active" })
  status: string; // active | inactive

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Branch, { onDelete: "CASCADE" })
  @JoinColumn({ name: "branchId" })
  branch: Branch;
}
