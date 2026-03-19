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

@Entity("courts")
export class Court {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: true })
  locationId: string | null;

  @Column()
  name: string;

  @Column({ type: "varchar", default: "outdoor" })
  type: string; // indoor | outdoor

  @Column({ type: "varchar", default: "tennis" })
  sport: string; // tennis | pickleball

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  pricePerHour: string;

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
}
