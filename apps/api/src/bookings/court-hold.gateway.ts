import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { RedisService, HoldData } from "../redis/redis.service";

// ─── Slot-level payloads (new flow) ──────────────────────────────────────────
interface SlotHoldRequestPayload {
  locationId: string;
  sport: string;
  courtType: string;
  date: string;        // "yyyy-MM-dd"
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  durationMinutes: number;
}

interface SlotHoldReleasePayload {
  locationId: string;
  sport: string;
  courtType: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface SlotBookedPayload extends SlotHoldReleasePayload {
  durationMinutes?: number;
}

interface HoldRequestPayload {
  courtId: string;
  date: string;          // "yyyy-MM-dd"
  startTime: string;     // "HH:mm"
  endTime: string;       // "HH:mm"
  durationMinutes: number;
  locationId: string;
  courtName?: string;
  courtIds?: string[];   // all court IDs in this location (for full hold snapshot)
}

interface HoldReleasePayload {
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  locationId: string;
  courtIds?: string[];
}

interface JoinLocationPayload {
  locationId: string;
  courtIds?: string[];
}

export type HoldSnapshot = Record<
  string,
  HoldData & { courtId: string; date: string; startTime: string; endTime: string }
>;

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      cb(null, true);
    },
    credentials: true,
  },
  namespace: "/holds",
})
export class CourtHoldGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CourtHoldGateway.name);
  /** socketId → { locationId, courtIds } so we can broadcast on disconnect */
  private socketMeta = new Map<string, { locationId: string; courtIds: string[] }>();

  constructor(private readonly redis: RedisService) {}

  handleConnection(client: Socket) {
    this.logger.debug(`WS connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.debug(`WS disconnected: ${client.id}`);
    const meta = this.socketMeta.get(client.id);

    // Release court-level holds
    const releasedCourt = await this.redis.releaseAllHoldsForSocket(client.id);
    // Release slot-level holds
    const releasedSlot = await this.redis.removeAllSlotHoldsForSocket(client.id);
    this.socketMeta.delete(client.id);

    if (meta && (releasedCourt.length > 0 || releasedSlot.length > 0)) {
      if (releasedCourt.length > 0) {
        const snapshot = await this.buildSnapshot(meta.courtIds);
        this.server.to(`location:${meta.locationId}`).emit("hold:update", { holds: snapshot });
      }
      if (releasedSlot.length > 0) {
        await this.broadcastSlotUpdate(meta.locationId);
      }
    }
  }

  /** Client calls this first after connecting to enter a location room. */
  @SubscribeMessage("join:location")
  async handleJoinLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinLocationPayload,
  ) {
    const { locationId, courtIds = [] } = payload;
    await client.join(`location:${locationId}`);
    this.socketMeta.set(client.id, { locationId, courtIds });

    // Send current snapshot to the joining client
    const snapshot = await this.buildSnapshot(courtIds);
    client.emit("hold:update", { holds: snapshot });
    // Also send slot-hold counts immediately so "left" is correct on first paint.
    const holdCounts = await this.redis.getSlotHoldCounts(locationId);
    client.emit("slot:update", { holdCounts });
    this.logger.debug(`Socket ${client.id} joined location:${locationId}`);
  }

  /** Client requests a hold when selecting a court+slot. */
  @SubscribeMessage("hold:request")
  async handleHoldRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: HoldRequestPayload,
  ) {
    const { courtId, date, startTime, endTime, locationId, courtIds = [], courtName } = payload;

    // Extract display name from socket handshake auth
    const displayName =
      (client.handshake.auth as { displayName?: string })?.displayName ??
      (client.handshake.query?.displayName as string | undefined) ??
      "A guest";

    const acquired = await this.redis.acquireHold(
      courtId, date, startTime, endTime,
      client.id, displayName,
    );

    if (!acquired) {
      const key = `${courtId}:${date}:${startTime}:${endTime}`;
      const snapshot = await this.buildSnapshot(courtIds);
      const existing = snapshot[key];
      client.emit("hold:denied", {
        courtId, date, startTime, endTime,
        heldBy: existing?.displayName ?? "another user",
        courtName: courtName ?? courtId,
      });
      return;
    }

    // Broadcast updated hold snapshot to everyone in the room
    const snapshot = await this.buildSnapshot(courtIds);
    this.server.to(`location:${locationId}`).emit("hold:update", { holds: snapshot });
    this.logger.debug(`Hold acquired: ${courtId} ${date} ${startTime}-${endTime} by ${client.id}`);
  }

  /** Client releases hold when cancelling or deselecting court. */
  @SubscribeMessage("hold:release")
  async handleHoldRelease(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: HoldReleasePayload,
  ) {
    const { courtId, date, startTime, endTime, locationId, courtIds = [] } = payload;
    await this.redis.releaseHold(courtId, date, startTime, endTime, client.id);

    const snapshot = await this.buildSnapshot(courtIds);
    this.server.to(`location:${locationId}`).emit("hold:update", { holds: snapshot });
  }

  /** Client emits this after a successful booking to notify all room members to refetch. */
  @SubscribeMessage("court:booked")
  async handleCourtBooked(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: HoldReleasePayload,
  ) {
    const { courtId, date, startTime, endTime, locationId, courtIds = [] } = payload;
    // Force-release the hold (in case it wasn't released yet)
    await this.redis.forceDeleteHold(courtId, date, startTime, endTime);
    const snapshot = await this.buildSnapshot(courtIds);
    // Broadcast updated holds to the room
    this.server.to(`location:${locationId}`).emit("hold:update", { holds: snapshot });
    // Broadcast availability change so all clients refetch their slot grids
    this.server.to(`location:${locationId}`).emit("availability:changed", {
      courtId,
      date,
      startTime,
      endTime,
    });
    this.logger.debug(`Court booked broadcast: ${courtId} ${date} ${startTime}-${endTime} → room location:${locationId}`);
  }

  /** Called by BookingsService after successful booking to force-release the hold for that slot. */
  async releaseHoldAfterBooking(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
    locationId: string,
    courtIds: string[],
  ) {
    await this.redis.forceDeleteHold(courtId, date, startTime, endTime);
    const snapshot = await this.buildSnapshot(courtIds);
    this.server.to(`location:${locationId}`).emit("hold:update", { holds: snapshot });
  }

  private async buildSnapshot(courtIds: string[]): Promise<HoldSnapshot> {
    const raw = await this.redis.getHoldsByLocation("", courtIds);
    const snapshot: HoldSnapshot = {};
    for (const [compoundKey, data] of Object.entries(raw)) {
      const parts = compoundKey.split(":");
      const [courtId, date, startTime, endTime] = parts;
      snapshot[compoundKey] = { ...data, courtId, date, startTime, endTime };
    }
    return snapshot;
  }

  // ─── New slot-level hold events ───────────────────────────────────────────

  /** Client requests a slot hold (new flow: no specific court). */
  @SubscribeMessage("slot:hold_request")
  async handleSlotHoldRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SlotHoldRequestPayload,
  ) {
    const { locationId, sport, courtType, date, startTime, endTime } = payload;
    const displayName =
      (client.handshake.auth as { displayName?: string })?.displayName ??
      (client.handshake.query?.displayName as string | undefined) ??
      "A guest";

    await this.redis.addSlotHolder(locationId, sport, courtType, date, startTime, endTime, client.id, displayName);
    await this.broadcastSlotUpdate(locationId);
    this.logger.debug(`Slot hold: ${sport}/${courtType} ${date} ${startTime}-${endTime} by ${client.id}`);
  }

  /** Client releases a slot hold (deselect or cancel). */
  @SubscribeMessage("slot:hold_release")
  async handleSlotHoldRelease(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SlotHoldReleasePayload,
  ) {
    const { locationId, sport, courtType, date, startTime, endTime } = payload;
    await this.redis.removeSlotHolder(locationId, sport, courtType, date, startTime, endTime, client.id);
    await this.broadcastSlotUpdate(locationId);
  }

  /** Client emits after a successful slot booking so all room members refetch availability. */
  @SubscribeMessage("slot:booked")
  async handleSlotBooked(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SlotBookedPayload,
  ) {
    const { locationId, sport, courtType, date, startTime, endTime } = payload;
    await this.redis.forceDeleteSlotHold(locationId, sport, courtType, date, startTime, endTime);
    await this.broadcastSlotUpdate(locationId);
    this.server.to(`location:${locationId}`).emit("availability:changed", { date, startTime, endTime, sport, courtType });
    this.logger.debug(`Slot booked broadcast: ${sport}/${courtType} ${date} ${startTime}-${endTime} → room location:${locationId}`);
  }

  /** Broadcast current slot hold counts to the entire location room. */
  private async broadcastSlotUpdate(locationId: string) {
    const holdCounts = await this.redis.getSlotHoldCounts(locationId);
    this.server.to(`location:${locationId}`).emit("slot:update", { holdCounts });
  }
}
