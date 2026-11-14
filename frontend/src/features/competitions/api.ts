// Feature-facing wrappers around the Orval-generated client. Components import
// from here rather than from src/api/generated directly.
import {
  getCompetitionsGetByIdQueryKey,
  getCompetitionsGetCompetitionsQueryKey,
  useCompetitionsGetById,
  useCompetitionsGetCompetitions,
} from '@/api/generated/endpoints/competitions/competitions';

export type {
  CompetitionDto as Competition,
  CompetitionStatus,
} from '@/api/generated/model';

export const competitionKeys = {
  list: getCompetitionsGetCompetitionsQueryKey,
  detail: getCompetitionsGetByIdQueryKey,
};

export function useCompetitions() {
  return useCompetitionsGetCompetitions();
}

export function useCompetition(id: number) {
  return useCompetitionsGetById(id, {
    query: {
      // A missing competition stays missing; retry other failures once.
      retry: (failureCount, error) => error.status !== 404 && failureCount < 1,
    },
  });
}
