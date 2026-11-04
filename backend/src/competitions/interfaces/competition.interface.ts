export type CompetitionStatus = 'upcoming' | 'active' | 'finished';

export interface Competition {
  id: number;
  name: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  status: CompetitionStatus;
  organisedBy: number;
  teamCount: number;
}
