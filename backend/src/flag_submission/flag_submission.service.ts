import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

export type SubmissionStatus = 'correct' | 'incorrect' | 'already_solved';

export interface SubmissionResult {
  status: SubmissionStatus;
  challengeId: number;
}

/** Stupci tablice Challenges koji su potrebni za provjeru zastavice. */
export interface ChallengeRecord {
  id: number;
  competitionId: number;
  flag: string;
  publishingDate: Date;
}

/** Stupci tablice Competitions (compStart, compEnd) koji su potrebni za provjeru. */
export interface CompetitionWindow {
  id: number;
  startsAt: Date;
  endsAt: Date;
}

/** Redak tablice UserTeamComp. participationEndTime je prazan dok je članstvo aktivno. */
export interface TeamMembership {
  userId: number;
  teamId: number;
  competitionId: number;
  startsAt: Date;
  endsAt?: Date;
}

export interface SolutionRecord {
  userId: number;
  teamId: number;
  competitionId: number;
  challengeId: number;
  solveTime: Date;
}

/**
 * Ugovor prema bazi podataka. Servis ovisi samo o ovoj apstraktnoj klasi (ujedno
 * DI token), pa se pravi repozitorij može dodati bez izmjena u logici provjere.
 */
export abstract class FlagSubmissionRepository {
  abstract findChallenge(id: number): Promise<ChallengeRecord | undefined>;

  abstract findCompetition(id: number): Promise<CompetitionWindow | undefined>;

  /** Tim u kojem je korisnik u trenutku `at` u natjecanju, ili undefined. */
  abstract findTeamId(
    userId: number,
    competitionId: number,
    at: Date,
  ): Promise<number | undefined>;

  /** Je li ijedan član tima već riješio zadatak. */
  abstract hasTeamSolved(teamId: number, challengeId: number): Promise<boolean>;

  /**
   * Evidentira rješenje i mora biti ATOMARNO na razini tima (NF-06): ako je tim
   * u međuvremenu već riješio zadatak, ne upisuje ništa i vraća false.
   * U pravoj bazi to znači jedinstveni ključ (teamId, challengeId) ili
   * INSERT ... WHERE NOT EXISTS unutar transakcije.
   */
  abstract recordSolution(solution: SolutionRecord): Promise<boolean>;
}

/**
 * Privremena implementacija u memoriji (kao i CompetitionsService) dok baza ne
 * postane dostupna. Metode su sinkrone unutar async funkcija pa je
 * `recordSolution` atomaran u jednoj Node instanci.
 */
@Injectable()
export class InMemoryFlagSubmissionRepository extends FlagSubmissionRepository {
  readonly challenges = new Map<number, ChallengeRecord>();
  readonly competitions = new Map<number, CompetitionWindow>();
  readonly memberships: TeamMembership[] = [];
  readonly solutions: SolutionRecord[] = [];

  /** Demo podaci za lokalni razvoj; ne koristi se u produkciji. */
  seedDemoData(): void {
    this.competitions.set(1, {
      id: 1,
      startsAt: new Date('2026-01-01T00:00:00Z'),
      endsAt: new Date('2099-01-01T00:00:00Z'),
    });
    this.challenges.set(1, {
      id: 1,
      competitionId: 1,
      flag: 'FLAG{ulovko_demo}',
      publishingDate: new Date('2026-01-01T00:00:00Z'),
    });
    const since = new Date('2026-01-01T00:00:00Z');
    this.memberships.push(
      { userId: 1, teamId: 1, competitionId: 1, startsAt: since },
      { userId: 2, teamId: 1, competitionId: 1, startsAt: since },
      { userId: 3, teamId: 2, competitionId: 1, startsAt: since },
    );
  }

  async findChallenge(id: number): Promise<ChallengeRecord | undefined> {
    return this.challenges.get(id);
  }

  async findCompetition(id: number): Promise<CompetitionWindow | undefined> {
    return this.competitions.get(id);
  }

  async findTeamId(
    userId: number,
    competitionId: number,
    at: Date,
  ): Promise<number | undefined> {
    return this.memberships.find(
      (m) =>
        m.userId === userId &&
        m.competitionId === competitionId &&
        m.startsAt <= at &&
        (m.endsAt === undefined || m.endsAt > at),
    )?.teamId;
  }

  async hasTeamSolved(teamId: number, challengeId: number): Promise<boolean> {
    return this.solutions.some(
      (s) => s.teamId === teamId && s.challengeId === challengeId,
    );
  }

  async recordSolution(solution: SolutionRecord): Promise<boolean> {
    // Bez `await` između provjere i upisa, inače bi se dvije istodobne predaje
    // mogle prepleti i obje upisati rješenje.
    const alreadySolved = this.solutions.some(
      (s) =>
        s.teamId === solution.teamId && s.challengeId === solution.challengeId,
    );
    if (alreadySolved) {
      return false;
    }
    this.solutions.push(solution);
    return true;
  }
}

/** Klizni prozor: najviše `max` pokušaja u `windowMs` po ključu. */
class AttemptLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Bilježi pokušaj. Vraća 0 ako je dopušten, inače ms do idućeg dopuštenog. */
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

/** Usporedba u konstantnom vremenu; hashiranjem obje strane imaju jednaku duljinu. */
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

    // Neobjavljen zadatak ne smije se razlikovati od nepostojećeg (F-010).
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

    // Već riješeno: bez provjere zastavice i bez trošenja pokušaja (F-011).
    if (await this.repository.hasTeamSolved(teamId, challenge.id)) {
      return { status: 'already_solved', challengeId: challenge.id };
    }

    // Zaštita od pogađanja zastavice, po timu i zadatku.
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

    // Sadržaj poslane zastavice namjerno se ne bilježi u dnevnik.
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
      // Drugi član tima ju je riješio istodobno (NF-06).
      return { status: 'already_solved', challengeId: challenge.id };
    }

    this.logger.log(
      `Rješenje: user=${userId} team=${teamId} challenge=${challenge.id}`,
    );
    return { status: 'correct', challengeId: challenge.id };
  }
}
