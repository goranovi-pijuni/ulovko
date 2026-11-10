import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { FlagSubmissionRepository } from './flag_submission.repository.js';

export type SubmissionStatus = 'correct' | 'incorrect' | 'already_solved';

export interface SubmissionResult {
  status: SubmissionStatus;
  challengeId: number;
}

class AttemptLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string, now: number): number {
    const recent = (this.attempts.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (recent.length >= this.max) {
      this.attempts.set(key, recent);
      return this.windowMs - (now - recent[0]);
    }
    recent.push(now);
    this.attempts.set(key, recent);
    return 0;
  }
}

export const MAX_ATTEMPTS = 5;
export const ATTEMPT_WINDOW_MS = 60_000;

function flagsMatch(expected: string, submitted: string): boolean {
  const a = createHash('sha256').update(expected.trim()).digest();
  const b = createHash('sha256').update(submitted.trim()).digest();
  return timingSafeEqual(a, b);
}

@Injectable()
export class FlagSubmissionService {
  private readonly logger = new Logger(FlagSubmissionService.name);
  private readonly limiter = new AttemptLimiter(
    MAX_ATTEMPTS,
    ATTEMPT_WINDOW_MS,
  );

  constructor(private readonly repository: FlagSubmissionRepository) {}

  async submit(
    userId: number,
    challengeId: number,
    flag: string,
  ): Promise<SubmissionResult> {
    const now = new Date();

    const challenge = await this.repository.findChallenge(challengeId);
    if (!challenge || challenge.publishingDate > now) {
      throw new NotFoundException('Zadatak nije pronađen');
    }

    const competition = await this.repository.findCompetition(
      challenge.competitionId,
    );
    if (!competition) {
      throw new NotFoundException('Zadatak nije pronađen');
    }
    if (now < competition.startsAt || now > competition.endsAt) {
      throw new ForbiddenException('Natjecanje trenutačno nije aktivno');
    }

    const teamId = await this.repository.findTeamId(
      userId,
      competition.id,
      now,
    );
    if (teamId === undefined) {
      throw new ForbiddenException('Niste član tima u ovom natjecanju');
    }

    if (await this.repository.hasTeamSolved(teamId, challenge.id)) {
      return { status: 'already_solved', challengeId: challenge.id };
    }

    const waitMs = this.limiter.consume(
      `${teamId}:${challenge.id}`,
      now.getTime(),
    );
    if (waitMs > 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Previše pokušaja, pokušajte ponovno kasnije',
          retryAfterSeconds: Math.ceil(waitMs / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!flagsMatch(challenge.flag, flag)) {
      this.logger.warn(
        `Pogrešna zastavica: user=${userId} team=${teamId} challenge=${challenge.id}`,
      );
      return { status: 'incorrect', challengeId: challenge.id };
    }

    const recorded = await this.repository.recordSolution({
      userId,
      teamId,
      competitionId: competition.id,
      challengeId: challenge.id,
      solveTime: now,
    });
    if (!recorded) {
      return { status: 'already_solved', challengeId: challenge.id };
    }

    this.logger.log(
      `Rješenje: user=${userId} team=${teamId} challenge=${challenge.id}`,
    );
    return { status: 'correct', challengeId: challenge.id };
  }
}
