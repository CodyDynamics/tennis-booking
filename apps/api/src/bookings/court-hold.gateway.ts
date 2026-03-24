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
    const released = await this.redis.releaseAllHoldsForSocket(client.id);
    this.socketMeta.delete(client.id);

    if (released.length > 0 && meta) {
      const snapshot = await this.buildSnapshot(meta.courtIds);
      this.server.to(`location:${meta.locationId}`).emit("hold:update", { holds: snapshot });
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
      // compoundKey: {courtId}:{date}:{startTime}:{endTime}
      const parts = compoundKey.split(":");
      const [courtId, date, startTime, endTime] = parts;
      snapshot[compoundKey] = { ...data, courtId, date, startTime, endTime };
    }
    return snapshot;
  }
}
