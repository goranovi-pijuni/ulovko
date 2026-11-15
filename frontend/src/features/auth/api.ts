import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { ApiError } from '@/api/client';
import {
  authGetProfile,
  authLogout,
  getAuthGetProfileQueryKey,
  getAuthHandleLoginUrl,
} from '@/api/generated/endpoints/auth/auth';
import type { UserProfileDto } from '@/api/generated/model';

export type SessionUser = UserProfileDto;

export const authKeys = {
  session: getAuthGetProfileQueryKey,
};

// Google OAuth uses a full-page redirect, not a fetch request.
export const googleLoginUrl = getAuthHandleLoginUrl();

export const roleLabel: Record<SessionUser['permLevel'], string> = {
  1: 'Natjecatelj',
  2: 'Organizator',
  3: 'Administrator',
};

async function fetchSession({ signal }: { signal: AbortSignal }): Promise<SessionUser | null> {
  try {
    return await authGetProfile({ signal });
  } catch (error) {
    // 401 means signed out; a network error or 5xx does not.
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

// Shared by the header and protected route loaders, so their checks agree.
export const sessionQueryOptions = queryOptions({
  queryKey: authKeys.session(),
  queryFn: fetchSession,
  staleTime: 5 * 60_000,
});

export function useSession() {
  return useQuery(sessionQueryOptions);
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<void, ApiError>({
    mutationFn: async () => {
      try {
        await authLogout();
      } catch (error) {
        // The expired session is already logged out.
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
    },
    onSuccess: async () => {
      // Prevent in-flight requests from restoring old, user-specific data.
      await queryClient.cancelQueries();
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== authKeys.session()[0],
      });
      queryClient.setQueryData(authKeys.session(), null);
      // '/' currently redirects to the public competition listing.
      await router.navigate({ to: '/', replace: true });
      await router.invalidate();
    },
  });
}
