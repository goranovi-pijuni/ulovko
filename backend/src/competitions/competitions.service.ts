import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, countDistinct, eq, lte, sql, type SQL } from 'drizzle-orm';
import { unlink } from 'node:fs/promises';
import { DatabaseService } from '../database/database.service.js';
import {
  categories,
  challenges,
  competitions,
  userTeamComp,
} from '../database/schema.js';
import { ArchiveService } from '../challenge-packages/archive.service.js';
import { R2Service } from '../challenge-packages/r2.service.js';
import type {
  Competition,
  CompetitionStatus,
} from './interfaces/competition.interface.js';

function status(start: Date, end: Date, now: Date): CompetitionStatus {
  return now < start ? 'upcoming' : now >= end ? 'finished' : 'active';
}
function str(value: unknown, field: string, max = 4096): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new BadRequestException(`${field} mora biti tekst duljine 1-${max}`);
  }
  return value.trim();
}
function int(value: unknown, field: string, optional = false): number | null {
  if (optional && (value === undefined || value === null || value === ''))
    return null;
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    !/^\d+$/.test(String(value))
  ) {
    throw new BadRequestException(`${field} mora biti pozitivan cijeli broj`);
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < (optional ? 0 : 1) || n > 2147483647)
    throw new BadRequestException(`${field} nije valjan`);
  return n;
}
function date(value: unknown, field: string): Date {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)
  ) {
    throw new BadRequestException(
      `${field} mora biti ISO 8601 datum s vremenskom zonom`,
    );
  }
  const result = new Date(value);
  if (!Number.isFinite(result.valueOf()))
    throw new BadRequestException(`${field} nije valjan datum`);
  return result;
}

@Injectable()
export class CompetitionsService {
  private readonly logger = new Logger(CompetitionsService.name);
  constructor(
    private readonly database: DatabaseService,
    private readonly archive: ArchiveService,
    private readonly r2: R2Service,
  ) {}

  private async findCompetitions(filter?: SQL): Promise<Competition[]> {
    const rows = await this.database.db
      .select({
        id: competitions.id,
        name: competitions.compName,
        description: competitions.compDescription,
        startsAt: competitions.compStart,
        endsAt: competitions.compEnd,
        organisedBy: competitions.organizedBy,
        teamCount: countDistinct(userTeamComp.teamId),
      })
      .from(competitions)
      .leftJoin(userTeamComp, eq(userTeamComp.compId, competitions.id))
      .where(filter)
      .groupBy(competitions.id)
      .orderBy(competitions.compStart);
    const now = new Date();
    return rows.map((row) => ({
      ...row,
      description: row.description ?? '',
      status: status(row.startsAt, row.endsAt, now),
    }));
  }
  findAll(): Promise<Competition[]> {
    return this.findCompetitions();
  }
  async findById(id: number): Promise<Competition | undefined> {
    const [found] = await this.findCompetitions(eq(competitions.id, id));
    return found;
  }

  async createCompetition(body: Record<string, unknown>): Promise<Competition> {
    const name = str(body.name, 'name', 200);
    const description =
      body.description === undefined
        ? ''
        : str(body.description, 'description', 10000);
    const startsAt = date(body.startsAt, 'startsAt');
    const endsAt = date(body.endsAt, 'endsAt');
    if (startsAt >= endsAt)
      throw new BadRequestException('endsAt mora biti nakon startsAt');
    const organisedBy = int(body.organisedBy, 'organisedBy')!;
    const max = int(body.max, 'max', true),
      min = int(body.min, 'min', true),
      decay = int(body.decay, 'decay', true);
    if (max !== null && min !== null && max < min)
      throw new BadRequestException('max mora biti >= min');
    const [created] = await this.database.db
      .insert(competitions)
      .values({
        compName: name,
        compDescription: description,
        compStart: startsAt,
        compEnd: endsAt,
        organizedBy: organisedBy,
        max,
        min,
        decay,
      })
      .returning({ id: competitions.id });
    try {
      await this.r2.ensureCompetitionBucket(created.id);
    } catch (error) {
      await this.database.db
        .delete(competitions)
        .where(eq(competitions.id, created.id))
        .catch(() => undefined);
      this.logger.error(
        'Could not create R2 bucket',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException('R2 bucket nije moguće pripremiti');
    }
    const result = await this.findById(created.id);
    if (!result)
      throw new ServiceUnavailableException('Natjecanje nije moguće dohvatiti');
    return result;
  }

  async listChallenges(competitionId: number) {
    if (!(await this.findById(competitionId)))
      throw new NotFoundException('Natjecanje nije pronađeno');
    // Never return flag or R2 credentials to the public frontend.
    return this.database.db
      .select({
        id: challenges.id,
        challengeTitle: challenges.challengeTitle,
        challengeDescription: challenges.challengeDescription,
        publishingDate: challenges.publishingDate,
        points: challenges.points,
        categoryId: challenges.categoryId,
      })
      .from(challenges)
      .where(
        and(
          eq(challenges.competitionId, competitionId),
          lte(challenges.publishingDate, new Date()),
        ),
      )
      .orderBy(challenges.publishingDate);
  }

  async uploadChallenge(
    competitionId: number,
    file: Express.Multer.File | undefined,
    body: Record<string, unknown>,
  ) {
    if (!file?.path)
      throw new BadRequestException('ZIP arhiva mora biti u polju file');
    try {
      if (!(await this.findById(competitionId)))
        throw new NotFoundException('Natjecanje nije pronađeno');
      const title = str(body.challengeTitle, 'challengeTitle', 200);
      const description =
        body.challengeDescription === undefined
          ? ''
          : str(body.challengeDescription, 'challengeDescription', 10000);
      const publishingDate = date(body.publishingDate, 'publishingDate');
      const flag = str(body.flag, 'flag');
      const points = int(body.points, 'points', true);
      const categoryId = int(body.categoryId, 'categoryId')!;
      const [category] = await this.database.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, categoryId))
        .limit(1);
      if (!category) throw new BadRequestException('Nepostojeći categoryId');

      // Validate first. Reserve the ID without inserting a row so an in-progress
      // upload never appears in public challenge listings.
      const pkg = await this.archive.prepare(file.path);
      try {
        const reserved = await this.database.db.execute(
          sql`SELECT nextval(pg_get_serial_sequence('public."Challenges"', 'id')) AS id`,
        );
        const challengeId = Number(reserved.rows[0]?.id);
        if (!Number.isSafeInteger(challengeId) || challengeId <= 0) {
          throw new ServiceUnavailableException(
            'Nije moguce rezervirati ID zadatka',
          );
        }
        let location: { bucket: string; prefix: string } | undefined;
        try {
          location = await this.r2.upload(competitionId, challengeId, pkg);
          await this.database.db.insert(challenges).values({
            id: challengeId,
            challengeTitle: title,
            challengeDescription: description,
            publishingDate,
            flag,
            points,
            competitionId,
            categoryId,
          });
        } catch (error) {
          if (location)
            await this.r2.cleanup(
              location.bucket,
              ['config.yaml', 'public.zip', 'deploy.zip'].map(
                (name) => `${location!.prefix}${name}`,
              ),
            );
          this.logger.error(
            'Challenge upload failed',
            error instanceof Error ? error.stack : undefined,
          );
          throw new ServiceUnavailableException('Pohrana zadatka nije uspjela');
        }
        if (!location)
          throw new ServiceUnavailableException('R2 lokacija nije dostupna');
        return {
          id: challengeId,
          competitionId,
          challengeTitle: title,
          hasConfig: pkg.hasConfig,
          hasPublic: pkg.hasPublic,
          hasDeploy: pkg.hasDeploy,
          r2Bucket: location.bucket,
          r2KeyPrefix: location.prefix,
        };
      } finally {
        await pkg.cleanup();
      }
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
  }
}
