// Session state and auth actions. The session comes from the generated
// GET /api/auth/profile client; credential login and registration call the
// proposed endpoints documented in frontend/README.md, which the backend does
// not implement yet.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { ApiError, apiFetch } from '@/api/client';
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

// Full-page navigation: Google's consent screen cannot run inside fetch.
export const googleLoginUrl = getAuthHandleLoginUrl();

export const roleLabel: Record<SessionUser['permLevel'], string> = {
  1: 'Natjecatelj',
  2: 'Organizator',
  3: 'Administrator',
};

// Signed out is a normal state, not an error: 401 resolves to null.
async function fetchSession({
  signal,
}: {
  signal: AbortSignal;
}): Promise<SessionUser | null> {
  try {
    return await authGetProfile({ signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function useSession() {
  return useQuery({
    queryKey: authKeys.session(),
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
  });
}

// --- Proposed contract (not yet in openapi.json) -----------------------------
// Replace with the generated client once the backend exposes these routes.

export interface LoginRequest {
  /** Username or email address. */
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

function setSession(queryClient: QueryClient, user: SessionUser | null) {
  queryClient.setQueryData(authKeys.session(), user);
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<SessionUser, ApiError, LoginRequest>({
    mutationFn: (body) =>
      apiFetch<SessionUser>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (user) => setSession(queryClient, user),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation<SessionUser, ApiError, RegisterRequest>({
    mutationFn: (body) =>
      apiFetch<SessionUser>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (user) => setSession(queryClient, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError>({
    mutationFn: async () => {
      try {
        await authLogout();
      } catch (error) {
        // An already expired session is as good as a successful logout.
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
    },
    onSuccess: () => {
      setSession(queryClient, null);
      // Refetch anything loaded with the old session's permissions.
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== authKeys.session()[0],
      });
    },
  });
}

// The proposed routes answer 404 until the backend implements them.
export function isEndpointMissing(error: ApiError): boolean {
  return error.status === 404 || error.status === 405 || error.status === 501;
}
