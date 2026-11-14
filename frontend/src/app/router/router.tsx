import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { NotFound } from '@/components/shared/NotFound';
import { SignUpPage } from '@/features/auth/pages/SignUpPage';
import { CompetitionDetailPage } from '@/features/competitions/pages/CompetitionDetailPage';
import { CompetitionsPage } from '@/features/competitions/pages/CompetitionsPage';

const rootRoute = createRootRoute({
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
  // Only positive integer IDs match; anything else falls through to NotFound.
  params: {
    parse: ({ id }) => (/^[1-9]\d*$/.test(id) ? { id: Number(id) } : false),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  component: CompetitionDetailPage,
});

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignUpPage,
});

// Competitor, organizer and admin route trees (each with its own layout and
// access check in beforeLoad) will be added next to the public routes.
const routeTree = rootRoute.addChildren([
  indexRoute,
  competitionsRoute,
  competitionDetailRoute,
  signUpRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
