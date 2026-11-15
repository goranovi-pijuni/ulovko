import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { OrganizerLayout } from '@/app/layouts/OrganizerLayout';
import { ErrorState } from '@/components/shared/QueryStates';
import { NotFound } from '@/components/shared/NotFound';
import { sessionQueryOptions } from '@/features/auth/api';
import {
  AccessDeniedPage,
  LoginRequiredPage,
} from '@/features/auth/pages/AccessPages';
import { ChallengeDetailPage } from '@/features/challenges/pages/ChallengeDetailPage';
import { CompetitionDetailPage } from '@/features/competitions/pages/CompetitionDetailPage';
import { CompetitionsPage } from '@/features/competitions/pages/CompetitionsPage';
import { OrganizerDashboard } from '@/features/organizer/pages/OrganizerDashboard';
import { CreateCompetitionPage } from '@/features/organizer/pages/CreateCompetitionPage';
import { OrganizerCompetitionPage } from '@/features/organizer/pages/OrganizerCompetitionPage';
import { queryClient } from '@/app/providers/queryClient';

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: PublicLayout,
  notFoundComponent: NotFound,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/competitions' });
  },
});

const competitionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/competitions',
  component: CompetitionsPage,
});

const competitionDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/competitions/$id',
  validateSearch: (search: Record<string, unknown>): { stvoreno?: boolean } =>
    search.stvoreno === true || search.stvoreno === 'true'
      ? { stvoreno: true }
      : {},
  params: {
    parse: ({ id }) => (/^[1-9]\d*$/.test(id) ? { id: Number(id) } : false),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  component: CompetitionDetailPage,
});

const challengeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/competitions/$id/challenges/$challengeId',
  params: {
    parse: ({ id, challengeId }) =>
      /^[1-9]\d*$/.test(id) && /^[1-9]\d*$/.test(challengeId)
        ? { id: Number(id), challengeId: Number(challengeId) }
        : false,
    stringify: ({ id, challengeId }) => ({
      id: String(id),
      challengeId: String(challengeId),
    }),
  },
  component: ChallengeDetailPage,
});

const loginRequiredRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/prijava',
  component: LoginRequiredPage,
});

const accessDeniedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/zabranjen-pristup',
  component: AccessDeniedPage,
});

// Keep old links working: Google OAuth creates an account on first login.
const legacySignUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  beforeLoad: () => {
    throw redirect({ to: '/prijava' });
  },
});

function AuthCheckError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <ErrorState
      message="Nije moguće provjeriti prava pristupa."
      onRetry={() => {
        reset();
        void router.invalidate();
      }}
    />
  );
}

// Child routes added in the organizer dashboard/form commits inherit this guard.
const organizerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/organizer',
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery(sessionQueryOptions);
    if (!user) throw redirect({ to: '/prijava' });
    if (user.permLevel !== 2 && user.permLevel !== 3) {
      throw redirect({ to: '/zabranjen-pristup' });
    }
  },
  component: OrganizerLayout,
  errorComponent: AuthCheckError,
});

const organizerIndexRoute = createRoute({
  getParentRoute: () => organizerRoute,
  path: '/',
  component: OrganizerDashboard,
});

const organizerCreateRoute = createRoute({
  getParentRoute: () => organizerRoute,
  path: '/competitions/new',
  component: CreateCompetitionPage,
});

const organizerCompetitionRoute = createRoute({
  getParentRoute: () => organizerRoute,
  path: '/competitions/$id',
  validateSearch: (search: Record<string, unknown>): { stvoreno?: boolean } =>
    search.stvoreno === true || search.stvoreno === 'true'
      ? { stvoreno: true }
      : {},
  params: {
    parse: ({ id }) => (/^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) ? { id: Number(id) } : false),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  component: OrganizerCompetitionPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  competitionsRoute,
  competitionDetailRoute,
  challengeDetailRoute,
  loginRequiredRoute,
  accessDeniedRoute,
  legacySignUpRoute,
  organizerRoute.addChildren([organizerIndexRoute, organizerCreateRoute, organizerCompetitionRoute]),
]);

export const router = createRouter({ routeTree, context: { queryClient } });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
