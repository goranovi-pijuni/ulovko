import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, type ApiError } from '@/api/client';
import type { ChallengeEndpoint } from '@/features/challenges/api';
import {
  getCompetitionsListChallengesQueryKey,
  getCompetitionsListOrganizerChallengesQueryKey,
  useCompetitionsListChallengeCategories,
  useCompetitionsListOrganizerChallenges,
  useCompetitionsUploadChallenge,
} from '@/api/generated/endpoints/competitions/competitions';

export type {
  ChallengeCategoryDto as ChallengeCategory,
  OrganizerChallengeDto as OrganizerChallenge,
} from '@/api/generated/model';

export function useChallengeCategories(enabled = true) {
  return useCompetitionsListChallengeCategories({ query: { enabled } });
}

export function useOrganizerChallenges(competitionId: number, enabled = true) {
  return useCompetitionsListOrganizerChallenges(competitionId, {
    query: { enabled, retry: (count, error) => error.status !== 403 && error.status !== 404 && count < 1 },
  });
}

export function useUploadChallenge(competitionId: number) {
  const queryClient = useQueryClient();
  return useCompetitionsUploadChallenge({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: getCompetitionsListOrganizerChallengesQueryKey(competitionId),
        });
        void queryClient.invalidateQueries({
          queryKey: getCompetitionsListChallengesQueryKey(competitionId),
        });
      },
    },
  });
}

// The edit and deployment endpoints are documented in Swagger. We keep these
// small wrappers beside the existing Orval hooks; regenerate Orval after the
// backend is deployed to get the same types automatically.

export type EditChallengeInput = {
  title: string;
  description: string;
  publishingDate: string;
  categoryId: number;
  points: string;
  isPublic: boolean;
  flag: string;
  file: File | null;
};

export type DeploymentStatus = {
  status: 'uploaded' | 'building' | 'built' | 'deployed' | 'error' | null;
  error: string | null;
  endpoints: ChallengeEndpoint[];
};

function organizerChallengeUrl(competitionId: number, challengeId: number) {
  return `/api/competitions/${competitionId}/organizer/challenges/${challengeId}`;
}

function invalidateChallenges(client: ReturnType<typeof useQueryClient>, competitionId: number) {
  void client.invalidateQueries({ queryKey: getCompetitionsListOrganizerChallengesQueryKey(competitionId) });
  void client.invalidateQueries({ queryKey: getCompetitionsListChallengesQueryKey(competitionId) });
}

export function useEditChallenge(competitionId: number) {
  const client = useQueryClient();
  return useMutation<void, ApiError, { challengeId: number; data: EditChallengeInput }>({
    mutationFn: ({ challengeId, data }) => {
      const body = new FormData();
      body.set('challengeTitle', data.title.trim());
      body.set('challengeDescription', data.description.trim());
      body.set('publishingDate', new Date(data.publishingDate).toISOString());
      body.set('categoryId', String(data.categoryId));
      body.set('points', data.points);
      body.set('isPublic', String(data.isPublic));
      if (data.flag.trim()) body.set('flag', data.flag.trim());
      if (data.file) body.set('file', data.file);
      return apiFetch<void>(organizerChallengeUrl(competitionId, challengeId), {
        method: 'PATCH', body,
      });
    },
    onSuccess: () => invalidateChallenges(client, competitionId),
  });
}

const deploymentQueryKey = (competitionId: number, challengeId: number) =>
  ['organizer-deployment', competitionId, challengeId] as const;

export function useDeploymentStatus(competitionId: number, challengeId: number, enabled: boolean) {
  return useQuery<DeploymentStatus, ApiError>({
    queryKey: deploymentQueryKey(competitionId, challengeId),
    queryFn: () => apiFetch<DeploymentStatus>(`${organizerChallengeUrl(competitionId, challengeId)}/deployment`),
    enabled,
    refetchInterval: (query) => ['building', 'built'].includes(query.state.data?.status ?? '') ? 2500 : query.state.data?.status === 'deployed' ? 8000 : false,
  });
}

export function useDeployChallenge(competitionId: number) {
  const client = useQueryClient();
  return useMutation<DeploymentStatus, ApiError, number>({
    mutationFn: (challengeId) => apiFetch<DeploymentStatus>(
      `${organizerChallengeUrl(competitionId, challengeId)}/deploy`, { method: 'POST' },
    ),
    onSuccess: (data, challengeId) => {
      client.setQueryData(deploymentQueryKey(competitionId, challengeId), data);
      invalidateChallenges(client, competitionId);
    },
  });
}
