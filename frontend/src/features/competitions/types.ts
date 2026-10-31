// Temporary hand-written model. Replace with the Orval-generated types once
// the OpenAPI contract with the backend is agreed.

export type CompetitionStatus = 'upcoming' | 'active' | 'finished';

export interface Competition {
  id: string;
  name: string;
  description: string;
  status: CompetitionStatus;
  /** UTC ISO 8601 */
  startsAt: string;
  /** UTC ISO 8601 */
  endsAt: string;
  teamCount: number;
}
