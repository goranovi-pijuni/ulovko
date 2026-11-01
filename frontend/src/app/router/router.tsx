import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { NotFound } from '@/components/shared/NotFound';
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

// Competitor, organizer and admin route trees (each with its own layout and
// access check in beforeLoad) will be added next to the public routes.
const routeTree = rootRoute.addChildren([indexRoute, competitionsRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
