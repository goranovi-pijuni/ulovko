import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import {
  challenges,
  competitions,
  solutions,
  userTeamComp,
} from '../database/schema.js';
import {
  FlagSubmissionRepository,
  type ChallengeRecord,
  type CompetitionWindow,
  type SolutionRecord,
} from './flag_submission.service.js';

type Executor = Pick<DatabaseService['db'], 'select'>;

@Injectable()
export class DatabaseFlagSubmissionRepository extends FlagSubmissionRepository {
  constructor(private readonly database: DatabaseService) {
    super();
  }

  async findChallenge(id: number): Promise<ChallengeRecord | undefined> {
    const [row] = await this.database.db
      .select({
        id: challenges.id,
        competitionId: challenges.competitionId,
        flag: challenges.flag,
        publishingDate: challenges.publishingDate,
      })
      .from(challenges)
      .where(eq(challenges.id, id))
      .limit(1);
    return row;
  }

  async findCompetition(id: number): Promise<CompetitionWindow | undefined> {
    const [row] = await this.database.db
      .select({
        id: competitions.id,
        startsAt: competitions.compStart,
        endsAt: competitions.compEnd,
      })
      .from(competitions)
      .where(eq(competitions.id, id))
      .limit(1);
    return row;
  }

  async findTeamId(
    userId: number,
    competitionId: number,
    at: Date,
  ): Promise<number | undefined> {
    const seconds = Math.floor(at.getTime() / 1000);
    const [row] = await this.database.db
      .select({ teamId: userTeamComp.teamId })
      .from(userTeamComp)
      .where(
        and(
          eq(userTeamComp.userId, userId),
          eq(userTeamComp.compId, competitionId),
          lte(userTeamComp.participationStartTime, seconds),
          or(
            isNull(userTeamComp.participationEndTime),
            gt(userTeamComp.participationEndTime, seconds),
          ),
        ),
      )
      .limit(1);
    return row?.teamId;
  }

  hasTeamSolved(teamId: number, challengeId: number): Promise<boolean> {
    return this.teamSolved(this.database.db, teamId, challengeId);
  }

  recordSolution(solution: SolutionRecord): Promise<boolean> {
    return this.database.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(${solution.teamId}::int, ${solution.challengeId}::int)`,
      );
      if (await this.teamSolved(tx, solution.teamId, solution.challengeId)) {
        return false;
      }
      const inserted = await tx
        .insert(solutions)
        .values({
          userId: solution.userId,
          compId: solution.competitionId,
          challengeId: solution.challengeId,
          solveTime: solution.solveTime,
        })
        .onConflictDoNothing()
        .returning({ userId: solutions.userId });
      return inserted.length > 0;
    });
  }

  private async teamSolved(
    executor: Executor,
    teamId: number,
    challengeId: number,
  ): Promise<boolean> {
    const [row] = await executor
      .select({ userId: solutions.userId })
      .from(solutions)
      .innerJoin(
        userTeamComp,
        and(
          eq(userTeamComp.userId, solutions.userId),
          eq(userTeamComp.compId, solutions.compId),
          eq(userTeamComp.teamId, teamId),
          sql`extract(epoch from ${solutions.solveTime}) >= ${userTeamComp.participationStartTime}`,
          sql`(${userTeamComp.participationEndTime} is null or extract(epoch from ${solutions.solveTime}) < ${userTeamComp.participationEndTime})`,
        ),
      )
      .where(eq(solutions.challengeId, challengeId))
      .limit(1);
    return row !== undefined;
  }
}
