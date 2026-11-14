import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { ErrorState } from '@/components/shared/QueryStates';
import { NotFound } from '@/components/shared/NotFound';
import { sessionQueryOptions } from '@/features/auth/api';
import {
  AccessDeniedPage,
  LoginRequiredPage,
} from '@/features/auth/pages/AccessPages';
import { CompetitionDetailPage } from '@/features/competitions/pages/CompetitionDetailPage';
import { CompetitionsPage } from '@/features/competitions/pages/CompetitionsPage';
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
  params: {
    parse: ({ id }) => (/^[1-9]\d*$/.test(id) ? { id: Number(id) } : false),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  component: CompetitionDetailPage,
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

function OrganizerPlaceholder() {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-primary-500 bg-primary-600/25 p-8">
      <h1 className="text-3xl">Organizacijski pregled</h1>
      <p className="text-ink-300">
        Organizacijska nadzorna ploča bit će dostupna uskoro.
      </p>
    </section>
  );
}

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
  component: OrganizerPlaceholder,
  errorComponent: AuthCheckError,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  competitionsRoute,
  competitionDetailRoute,
  loginRequiredRoute,
  accessDeniedRoute,
  legacySignUpRoute,
  organizerRoute,
]);

export const router = createRouter({ routeTree, context: { queryClient } });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
