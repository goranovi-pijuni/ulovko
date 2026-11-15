import { useQuery } from '@tanstack/react-query';
import { apiFetch, type ApiError } from '@/api/client';
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

export interface ChallengeEndpoint {
  service: string;
  ready: boolean;
  protocol: 'http' | 'https' | 'tcp';
  url?: string;
  host?: string;
  port?: number;
}

// The backend checks publication and proxies the token-protected runner API.
export function useChallengeEndpoints(competitionId: number, challengeId: number) {
  return useQuery<ChallengeEndpoint[], ApiError>({
    queryKey: ['public-challenge-endpoints', competitionId, challengeId],
    queryFn: () => apiFetch<ChallengeEndpoint[]>(
      `/api/competitions/${competitionId}/challenges/${challengeId}/endpoints`,
    ),
    refetchInterval: 15_000,
  });
}
