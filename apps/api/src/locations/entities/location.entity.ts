import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Branch } from "../../branches/entities/branch.entity";
import {
  LocationVisibility,
  MemberCourtPriceBasis,
} from "./location.enums";
import { LocationKind } from "./location-kind.enum";

@Entity("locations")
export class Location {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  branchId: string;

  @Column({ type: "uuid", nullable: true })
  parentLocationId: string | null;

  @Column({ type: "varchar", default: LocationKind.CHILD })
  kind: LocationKind;

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

  /** IANA timezone for slot generation (e.g. America/Chicago) */
  @Column({ type: "varchar", default: "America/Chicago" })
  timezone: string;

  @Column({ type: "varchar", default: LocationVisibility.PUBLIC })
  visibility: LocationVisibility;

  /** One-time membership fee for private locations (cents) */
  @Column({ type: "int", default: 0 })
  membershipInitiationFeeCents: number;

  /** Recurring monthly fee (cents) */
  @Column({ type: "int", default: 0 })
  membershipMonthlyFeeCents: number;

  /** 0–100: discount off public hourly rate when memberCourtPriceBasis is discount_from_public */
  @Column({ type: "int", default: 0 })
  memberCourtDiscountPercent: number;

  @Column({
    type: "varchar",
    default: MemberCourtPriceBasis.DISCOUNT_FROM_PUBLIC,
  })
  memberCourtPriceBasis: MemberCourtPriceBasis;

  @Column({ default: "active" })
  status: string; // active | inactive

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Branch, { onDelete: "CASCADE" })
  @JoinColumn({ name: "branchId" })
  branch: Branch;

  @ManyToOne(() => Location, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "parentLocationId" })
  parentLocation: Location | null;

  @OneToMany(() => Location, (loc) => loc.parentLocation)
  children: Location[];
}
