import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { User } from "../users/entities/user.entity";
import { CoachSession, CoachSessionStatus } from "../bookings/entities/coach-session.entity";
import { CoachesService } from "../coaches/coaches.service";
import { ParentGuardianLink } from "./entities/parent-guardian-link.entity";
import { CoachRosterEntry } from "./entities/coach-roster-entry.entity";
import { PlayerMetricSnapshot } from "./entities/player-metric-snapshot.entity";
import { TrainingPlan } from "./entities/training-plan.entity";
import { TrainingPlanItem } from "./entities/training-plan-item.entity";
import { TrainingPlanCompletion } from "./entities/training-plan-completion.entity";
import { SessionFeedbackNote } from "./entities/session-feedback-note.entity";
import { TrainingVideo } from "./entities/training-video.entity";
import { ParentPaymentRequest } from "./entities/parent-payment-request.entity";
import { Achievement } from "./entities/achievement.entity";
import { UserAchievement } from "./entities/user-achievement.entity";
import { UpdatePersonaDto } from "./dto/update-persona.dto";
import { CreateParentLinkDto } from "./dto/parent-link.dto";
import { CreateRosterEntryDto } from "./dto/roster.dto";
import { CreateMetricSnapshotDto } from "./dto/metric-snapshot.dto";
import { CreateTrainingPlanDto } from "./dto/training-plan.dto";
import { CreateFeedbackNoteDto } from "./dto/feedback.dto";
import { PresignVideoDto, RegisterTrainingVideoDto } from "./dto/video.dto";
import { CreateParentPaymentDto } from "./dto/parent-payment.dto";
import { PatchCoachSessionDto } from "./dto/patch-coach-session.dto";
import { randomUUID } from "crypto";

@Injectable()
export class PlatformService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CoachSession)
    private readonly coachSessionRepo: Repository<CoachSession>,
    @InjectRepository(ParentGuardianLink)
    private readonly parentLinkRepo: Repository<ParentGuardianLink>,
    @InjectRepository(CoachRosterEntry)
    private readonly rosterRepo: Repository<CoachRosterEntry>,
    @InjectRepository(PlayerMetricSnapshot)
    private readonly metricRepo: Repository<PlayerMetricSnapshot>,
    @InjectRepository(TrainingPlan)
    private readonly planRepo: Repository<TrainingPlan>,
    @InjectRepository(TrainingPlanItem)
    private readonly planItemRepo: Repository<TrainingPlanItem>,
    @InjectRepository(TrainingPlanCompletion)
    private readonly completionRepo: Repository<TrainingPlanCompletion>,
    @InjectRepository(SessionFeedbackNote)
    private readonly feedbackRepo: Repository<SessionFeedbackNote>,
    @InjectRepository(TrainingVideo)
    private readonly videoRepo: Repository<TrainingVideo>,
    @InjectRepository(ParentPaymentRequest)
    private readonly paymentRepo: Repository<ParentPaymentRequest>,
    @InjectRepository(Achievement)
    private readonly achievementRepo: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private readonly userAchievementRepo: Repository<UserAchievement>,
    private readonly coachesService: CoachesService,
  ) {}

  async getPersona(userId: string) {
    const u = await this.userRepo.findOne({
      where: { id: userId },
      select: {
        id: true,
        appPersona: true,
        onboardingCompletedAt: true,
      },
    });
    if (!u) throw new NotFoundException("User not found");
    return {
      appPersona: u.appPersona,
      onboardingCompletedAt: u.onboardingCompletedAt,
    };
  }

  async updatePersona(userId: string, dto: UpdatePersonaDto) {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) throw new NotFoundException("User not found");
    if (dto.appPersona !== undefined) {
      u.appPersona = dto.appPersona ?? null;
    }
    if (dto.onboardingCompletedAt !== undefined) {
      u.onboardingCompletedAt = dto.onboardingCompletedAt
        ? new Date(dto.onboardingCompletedAt)
        : null;
    }
    await this.userRepo.save(u);
    return this.getPersona(userId);
  }

  async listParentChildren(parentUserId: string) {
    const links = await this.parentLinkRepo.find({
      where: { parentUserId, status: "active" },
      relations: { child: true },
    });
    return links.map((l) => ({
      linkId: l.id,
      childUserId: l.childUserId,
      fullName: l.child.fullName,
      email: l.child.email,
      avatarUrl: l.child.avatarUrl,
    }));
  }

  async createParentLink(parentUserId: string, dto: CreateParentLinkDto) {
    if (parentUserId === dto.childUserId) {
      throw new BadRequestException("Cannot link a user to themselves");
    }
    const child = await this.userRepo.findOne({ where: { id: dto.childUserId } });
    if (!child) throw new NotFoundException("Child user not found");
    const existing = await this.parentLinkRepo.findOne({
      where: { parentUserId, childUserId: dto.childUserId },
    });
    if (existing) {
      existing.status = "active";
      return this.parentLinkRepo.save(existing);
    }
    return this.parentLinkRepo.save(
      this.parentLinkRepo.create({
        parentUserId,
        childUserId: dto.childUserId,
        status: "active",
      }),
    );
  }

  private async getCoachForUser(userId: string) {
    return this.coachesService.findByUserId(userId);
  }

  async listCoachSessions(userId: string, from?: string, to?: string) {
    const coach = await this.getCoachForUser(userId);
    if (!coach) throw new ForbiddenException("User does not have a coach profile");
    const qb = this.coachSessionRepo
      .createQueryBuilder("s")
      .where("s.coachId = :cid", { cid: coach.id })
      .orderBy("s.sessionDate", "ASC")
      .addOrderBy("s.startTime", "ASC");
    if (from) qb.andWhere("s.sessionDate >= :from", { from });
    if (to) qb.andWhere("s.sessionDate <= :to", { to });
    const sessions = await qb.getMany();
    const bookerIds = [
      ...new Set(sessions.map((s) => s.bookedById).filter(Boolean)),
    ] as string[];
    const bookers =
      bookerIds.length > 0
        ? await this.userRepo.find({
            where: { id: In(bookerIds) },
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          })
        : [];
    const bookerMap = new Map(bookers.map((b) => [b.id, b]));
    return sessions.map((s) => ({
      id: s.id,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      sessionType: s.sessionType,
      status: s.status,
      locationId: s.locationId,
      courtId: s.courtId,
      bookedById: s.bookedById,
      booker: s.bookedById ? bookerMap.get(s.bookedById) ?? null : null,
    }));
  }

  async patchCoachSession(userId: string, sessionId: string, dto: PatchCoachSessionDto) {
    const coach = await this.getCoachForUser(userId);
    if (!coach) throw new ForbiddenException("User does not have a coach profile");
    const session = await this.coachSessionRepo.findOne({ where: { id: sessionId } });
    if (!session || session.coachId !== coach.id) {
      throw new NotFoundException("Session not found");
    }
    session.status = dto.status as CoachSessionStatus;
    await this.coachSessionRepo.save(session);
    return { id: session.id, status: session.status };
  }

  async listRoster(userId: string) {
    const coach = await this.getCoachForUser(userId);
    if (!coach) throw new ForbiddenException("User does not have a coach profile");
    const rows = await this.rosterRepo.find({
      where: { coachId: coach.id, status: "active" },
      relations: { student: true },
      order: { createdAt: "DESC" },
    });
    return rows.map((r) => ({
      id: r.id,
      studentUserId: r.studentUserId,
      skillLevel: r.skillLevel,
      fullName: r.student.fullName,
      email: r.student.email,
      avatarUrl: r.student.avatarUrl,
    }));
  }

  async addRosterEntry(userId: string, dto: CreateRosterEntryDto) {
    const coach = await this.getCoachForUser(userId);
    if (!coach) throw new ForbiddenException("User does not have a coach profile");
    const student = await this.userRepo.findOne({ where: { id: dto.studentUserId } });
    if (!student) throw new NotFoundException("Student user not found");
    const existing = await this.rosterRepo.findOne({
      where: { coachId: coach.id, studentUserId: dto.studentUserId },
    });
    if (existing) {
      existing.skillLevel = dto.skillLevel ?? existing.skillLevel;
      existing.status = "active";
      return this.rosterRepo.save(existing);
    }
    return this.rosterRepo.save(
      this.rosterRepo.create({
        coachId: coach.id,
        studentUserId: dto.studentUserId,
        skillLevel: dto.skillLevel ?? null,
        status: "active",
      }),
    );
  }

  async removeRosterEntry(userId: string, studentUserId: string) {
    const coach = await this.getCoachForUser(userId);
    if (!coach) throw new ForbiddenException("User does not have a coach profile");
    const row = await this.rosterRepo.findOne({
      where: { coachId: coach.id, studentUserId },
    });
    if (!row) throw new NotFoundException("Roster entry not found");
    row.status = "inactive";
    await this.rosterRepo.save(row);
    return { removed: true };
  }

  private async assertCanViewPlayer(viewerId: string, playerId: string) {
    if (viewerId === playerId) return;
    const parent = await this.parentLinkRepo.findOne({
      where: { parentUserId: viewerId, childUserId: playerId, status: "active" },
    });
    if (parent) return;
    const coach = await this.getCoachForUser(viewerId);
    if (coach) {
      const onRoster = await this.rosterRepo.exist({
        where: {
          coachId: coach.id,
          studentUserId: playerId,
          status: "active",
        },
      });
      if (onRoster) return;
    }
    throw new ForbiddenException("Cannot access this player");
  }

  async listMetricSnapshots(
    viewerId: string,
    playerId: string,
    from?: string,
    to?: string,
  ) {
    await this.assertCanViewPlayer(viewerId, playerId);
    const qb = this.metricRepo
      .createQueryBuilder("m")
      .where("m.playerUserId = :pid", { pid: playerId });
    if (from) qb.andWhere("m.recordedAt >= :from", { from: new Date(from) });
    if (to) qb.andWhere("m.recordedAt <= :to", { to: new Date(to) });
    return qb.orderBy("m.recordedAt", "DESC").take(200).getMany();
  }

  async createMetricSnapshot(
    viewerId: string,
    playerId: string,
    dto: CreateMetricSnapshotDto,
  ) {
    if (viewerId === playerId) {
      return this.metricRepo.save(
        this.metricRepo.create({
          playerUserId: playerId,
          coachId: null,
          scores: dto.scores,
        }),
      );
    }
    const coach = await this.getCoachForUser(viewerId);
    if (!coach) {
      throw new ForbiddenException("Only the player or their coach can add metrics");
    }
    await this.assertCanViewPlayer(viewerId, playerId);
    return this.metricRepo.save(
      this.metricRepo.create({
        playerUserId: playerId,
        coachId: coach.id,
        scores: dto.scores,
      }),
    );
  }

  async listTrainingPlans(viewerId: string, playerUserId: string) {
    await this.assertCanViewPlayer(viewerId, playerUserId);
    const plans = await this.planRepo.find({
      where: { playerUserId },
      relations: { items: true },
      order: { createdAt: "DESC" },
    });
    const itemIds = plans.flatMap((p) => p.items.map((i) => i.id));
    const completions =
      itemIds.length > 0
        ? await this.completionRepo.find({
            where: { itemId: In(itemIds), userId: playerUserId },
          })
        : [];
    const done = new Set(completions.map((c) => c.itemId));
    return plans.map((p) => ({
      id: p.id,
      title: p.title,
      coachId: p.coachId,
      createdAt: p.createdAt,
      items: p.items
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((i) => ({
          id: i.id,
          title: i.title,
          sortOrder: i.sortOrder,
          dueDate: i.dueDate,
          completed: done.has(i.id),
        })),
    }));
  }

  async createTrainingPlan(coachUserId: string, dto: CreateTrainingPlanDto) {
    const coach = await this.getCoachForUser(coachUserId);
    if (!coach) throw new ForbiddenException("User does not have a coach profile");
    await this.assertCanViewPlayer(coachUserId, dto.playerUserId);
    const plan = await this.planRepo.save(
      this.planRepo.create({
        coachId: coach.id,
        playerUserId: dto.playerUserId,
        title: dto.title,
      }),
    );
    const items = dto.items.map((it, idx) =>
      this.planItemRepo.create({
        planId: plan.id,
        title: it.title,
        sortOrder: it.sortOrder ?? idx,
        dueDate: it.dueDate ?? null,
      }),
    );
    await this.planItemRepo.save(items);
    return this.listTrainingPlans(coachUserId, dto.playerUserId);
  }

  async completeTrainingItem(viewerId: string, itemId: string) {
    const item = await this.planItemRepo.findOne({
      where: { id: itemId },
      relations: { plan: true },
    });
    if (!item) throw new NotFoundException("Training item not found");
    await this.assertCanViewPlayer(viewerId, item.plan.playerUserId);
    if (viewerId !== item.plan.playerUserId) {
      throw new ForbiddenException("Only the player can mark items complete");
    }
    const existing = await this.completionRepo.findOne({
      where: { itemId, userId: viewerId },
    });
    if (existing) return existing;
    const saved = await this.completionRepo.save(
      this.completionRepo.create({ itemId, userId: viewerId }),
    );
    await this.tryAwardFirstDrill(viewerId);
    await this.tryAwardFiveSessions(viewerId);
    return saved;
  }

  private async tryAwardFirstDrill(userId: string) {
    const ach = await this.achievementRepo.findOne({ where: { code: "first_drill" } });
    if (!ach) return;
    const exists = await this.userAchievementRepo.exist({
      where: { userId, achievementId: ach.id },
    });
    if (exists) return;
    await this.userAchievementRepo.save(
      this.userAchievementRepo.create({ userId, achievementId: ach.id }),
    );
  }

  private async tryAwardFiveSessions(userId: string) {
    const completed = await this.coachSessionRepo.count({
      where: {
        bookedById: userId,
        status: CoachSessionStatus.COMPLETED,
      },
    });
    if (completed < 5) return;
    const ach = await this.achievementRepo.findOne({ where: { code: "five_sessions" } });
    if (!ach) return;
    const exists = await this.userAchievementRepo.exist({
      where: { userId, achievementId: ach.id },
    });
    if (exists) return;
    await this.userAchievementRepo.save(
      this.userAchievementRepo.create({ userId, achievementId: ach.id }),
    );
  }

  async listFeedback(viewerId: string, coachSessionId?: string, courtBookingId?: string) {
    if (!coachSessionId && !courtBookingId) {
      throw new BadRequestException("Provide coachSessionId or courtBookingId");
    }
    const where = coachSessionId
      ? { coachSessionId }
      : { courtBookingId: courtBookingId! };
    const notes = await this.feedbackRepo.find({
      where,
      relations: { author: true },
      order: { createdAt: "DESC" },
    });
    const coach = await this.getCoachForUser(viewerId);
    const resolved = await Promise.all(
      notes.map(async (n) => {
        if (n.authorUserId === viewerId) return n;
        if (n.visibility !== "coach_only") return n;
        if (n.coachSessionId && coach) {
          const ok = await this.coachSessionRepo.exist({
            where: { id: n.coachSessionId, coachId: coach.id },
          });
          return ok ? n : null;
        }
        return null;
      }),
    );
    const filtered = resolved.filter((n): n is SessionFeedbackNote => n !== null);
    return filtered.map((n) => ({
      id: n.id,
      body: n.body,
      visibility: n.visibility,
      createdAt: n.createdAt,
      authorUserId: n.authorUserId,
      authorName: n.author?.fullName,
      coachSessionId: n.coachSessionId,
      courtBookingId: n.courtBookingId,
    }));
  }

  async createFeedback(viewerId: string, dto: CreateFeedbackNoteDto) {
    const hasSession = Boolean(dto.coachSessionId);
    const hasCourt = Boolean(dto.courtBookingId);
    if (hasSession === hasCourt) {
      throw new BadRequestException("Provide exactly one of coachSessionId or courtBookingId");
    }
    const note = this.feedbackRepo.create({
      coachSessionId: dto.coachSessionId ?? null,
      courtBookingId: dto.courtBookingId ?? null,
      authorUserId: viewerId,
      body: dto.body,
      visibility: dto.visibility ?? "coach_player",
    });
    return this.feedbackRepo.save(note);
  }

  presignTrainingVideo(_viewerId: string, dto: PresignVideoDto) {
    const key = `training-videos/${dto.playerUserId}/${randomUUID()}`;
    return {
      mock: true as const,
      message:
        "S3-compatible upload is not configured. Use POST /platform/videos with storageKey after your upload target is ready.",
      storageKey: key,
      uploadUrl: null as string | null,
    };
  }

  async registerTrainingVideo(viewerId: string, dto: RegisterTrainingVideoDto) {
    await this.assertCanViewPlayer(viewerId, dto.playerUserId);
    if (viewerId !== dto.playerUserId) {
      throw new ForbiddenException("Only the player may register uploads for themselves");
    }
    return this.videoRepo.save(
      this.videoRepo.create({
        uploaderUserId: viewerId,
        playerUserId: dto.playerUserId,
        storageKey: dto.storageKey,
        status: "pending_review",
      }),
    );
  }

  async listParentPayments(parentUserId: string) {
    return this.paymentRepo.find({
      where: { parentUserId },
      order: { createdAt: "DESC" },
      take: 100,
    });
  }

  async createParentPayment(parentUserId: string, dto: CreateParentPaymentDto) {
    const link = await this.parentLinkRepo.findOne({
      where: {
        parentUserId,
        childUserId: dto.childUserId,
        status: "active",
      },
    });
    if (!link) throw new ForbiddenException("Not linked to this child");
    return this.paymentRepo.save(
      this.paymentRepo.create({
        parentUserId,
        childUserId: dto.childUserId,
        amountCents: dto.amountCents,
        currency: dto.currency ?? "USD",
        description: dto.description ?? null,
        status: "pending",
      }),
    );
  }

  listAchievements() {
    return this.achievementRepo.find({ order: { code: "ASC" } });
  }

  async listMyAchievements(userId: string) {
    const rows = await this.userAchievementRepo.find({
      where: { userId },
      relations: { achievement: true },
      order: { earnedAt: "DESC" },
    });
    return rows.map((r) => ({
      earnedAt: r.earnedAt,
      achievement: r.achievement,
    }));
  }
}
