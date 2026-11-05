import { Injectable } from '@nestjs/common';
import { countDistinct, eq, type SQL } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service.js';
import { competitions, userTeamComp } from '../database/schema.js';
import type {
  Competition,
  CompetitionStatus,
} from './interfaces/competition.interface.js';
import type { Challenge } from './interfaces/challenge.interface.js';

function getStatus(startsAt: Date, endsAt: Date, now: Date): CompetitionStatus {
  if (now < startsAt) return 'upcoming';
  if (now >= endsAt) return 'finished';
  return 'active';
}

@Injectable()
export class CompetitionsService {
  constructor(private readonly database: DatabaseService) {}

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
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      organisedBy: row.organisedBy,
      teamCount: row.teamCount,
      status: getStatus(row.startsAt, row.endsAt, now),
    }));
  }

  findAll(): Promise<Competition[]> {
    return this.findCompetitions();
  }

  async findById(id: number): Promise<Competition | undefined> {
    const [competition] = await this.findCompetitions(eq(competitions.id, id));
    return competition;
  }

  uploadChallenge(
    competitionId: number,
    file: Express.Multer.File,
    body: Challenge,
  ) {}
}
