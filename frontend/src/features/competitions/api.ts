import { useQuery } from '@tanstack/react-query';
import type { Competition } from './types';
import { apiFetch } from '@/api/client';

export const competitionKeys = {
  all: ['competitions'] as const,
  list: () => [...competitionKeys.all, 'list'] as const,
};

async function fetchCompetitions(): Promise<Competition[]> {
  return apiFetch<Competition[]>('/competitions');
}

export function useCompetitions() {
  return useQuery({
    queryKey: competitionKeys.list(),
    queryFn: fetchCompetitions,
  });
}
