import { useQuery } from '@tanstack/react-query';
import type { Competition } from './types';

export const competitionKeys = {
  all: ['competitions'] as const,
  list: () => [...competitionKeys.all, 'list'] as const,
};

// Mock data until GET /api/competitions exists. When it does, swap the body
// of fetchCompetitions for `apiFetch<Competition[]>('/competitions')` (or the
// Orval hook) and move these fixtures into MSW handlers.
const mockCompetitions: Competition[] = [
  {
    id: 'fer-ctf-2026',
    name: 'FER CTF 2026',
    description:
      'Godišnje studentsko natjecanje iz web sigurnosti, kriptografije i forenzike.',
    status: 'active',
    startsAt: '2026-10-25T08:00:00Z',
    endsAt: '2026-10-28T20:00:00Z',
    teamCount: 42,
  },
  {
    id: 'zimski-ctf',
    name: 'Zimski CTF',
    description: 'Natjecanje za početnike s naglaskom na obrnuto inženjerstvo.',
    status: 'upcoming',
    startsAt: '2026-12-12T09:00:00Z',
    endsAt: '2026-12-13T21:00:00Z',
    teamCount: 8,
  },
  {
    id: 'proljetni-ctf-2026',
    name: 'Proljetni CTF 2026',
    description: 'Jeopardy natjecanje s HTTP i TCP servisima.',
    status: 'finished',
    startsAt: '2026-04-18T10:00:00Z',
    endsAt: '2026-04-19T18:00:00Z',
    teamCount: 31,
  },
];

async function fetchCompetitions(): Promise<Competition[]> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return mockCompetitions;
}

export function useCompetitions() {
  return useQuery({
    queryKey: competitionKeys.list(),
    queryFn: fetchCompetitions,
  });
}
