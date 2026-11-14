// A public challenge is accessible only through the competition-scoped API.
// The backend filters unpublished and non-public challenges.
import { useCompetitionsListChallenges } from '@/api/generated/endpoints/competitions/competitions';

export type { PublicChallengeDto as Challenge } from '@/api/generated/model';

export function useChallenges(competitionId: number) {
  return useCompetitionsListChallenges(competitionId, {
    query: {
      retry: (failureCount, error) => error.status !== 404 && failureCount < 1,
    },
  });
}
