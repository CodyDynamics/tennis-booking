import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Location } from "../../locations/entities/location.entity";
import { Area } from "../../areas/entities/area.entity";
import { Sport } from "../../sports/entities/sport.entity";

@Entity("courts")
export class Court {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: true })
  locationId: string | null;

  @Column({ type: "uuid", nullable: true })
  areaId: string | null;

  @Column({ type: "uuid", nullable: true })
  sportId: string | null;

  @Column()
  name: string;

  @Column({ type: "varchar", default: "outdoor" })
  type: string; // indoor | outdoor

  @Column({ type: "varchar", default: "tennis" })
  sport: string; // tennis | pickleball

  /** Standard (walk-in / non-member) hourly rate */
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  pricePerHourPublic: string;

  /**
   * If set, used as member hourly rate for this court (overrides location % discount).
   * Null = derive from pricePerHourPublic + location.memberCourtDiscountPercent.
   */
  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  pricePerHourMember: string | null;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "varchar", nullable: true })
  imageUrl: string | null;

  /** JSON array of image URLs for gallery */
  @Column({ type: "text", nullable: true })
  imageGallery: string | null;

  /** Google Maps embed URL or iframe src for location map */
  @Column({ type: "text", nullable: true })
  mapEmbedUrl: string | null;

  @Column({ default: "active" })
  status: string; // active | maintenance

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Location, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "locationId" })
  location: Location | null;

  @ManyToOne(() => Area, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "areaId" })
  area: Area | null;

  @ManyToOne(() => Sport, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "sportId" })
  sportRef: Sport | null;
}
