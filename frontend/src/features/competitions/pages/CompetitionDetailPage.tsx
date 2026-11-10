import { getRouteApi, Link } from '@tanstack/react-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/shared/QueryStates';
import { formatDateTime, formatDuration } from '@/lib/datetime';
import { useCompetition, type Competition } from '../api';
import { CompetitionStatusBadge } from '../components/CompetitionStatusBadge';

const route = getRouteApi('/competitions/$id');

const divider = <hr className="border-primary-500 lg:w-1/2" />;

function BackLink() {
  return (
    <Link
      to="/competitions"
      className="self-start font-mono text-sm text-ink-300 hover:text-ink-100"
    >
      ← Sva natjecanja
    </Link>
  );
}

function CompetitionDetails({ competition }: { competition: Competition }) {
  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <h1 className="text-3xl text-ink-100">{competition.name}</h1>
          <CompetitionStatusBadge
            status={competition.status}
            className="mt-2"
          />
        </div>
      </header>
      {divider}

      <div className="grid gap-8 lg:grid-cols-3 lg:gap-11">
        <section className="flex flex-col gap-3 lg:col-span-2">
          <h2 className="font-mono text-sm text-ink-300">Opis</h2>
          {competition.description ? (
            <p className="whitespace-pre-line text-ink-200">
              {competition.description}
            </p>
          ) : (
            <p className="text-ink-300">Organizator nije dodao opis.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-sm text-ink-300">Detalji</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-primary-500 bg-primary-600/40 p-5 text-sm">
            <dt className="text-ink-300">Početak:</dt>
            <dd className="text-ink-100">
              <time dateTime={competition.startsAt}>
                {formatDateTime(competition.startsAt)}
              </time>
            </dd>
            <dt className="text-ink-300">Završetak:</dt>
            <dd className="text-ink-100">
              <time dateTime={competition.endsAt}>
                {formatDateTime(competition.endsAt)}
              </time>
            </dd>
            <dt className="text-ink-300">Trajanje:</dt>
            <dd className="text-ink-100">
              {formatDuration(competition.startsAt, competition.endsAt)}
            </dd>
            <dt className="text-ink-300">Timovi:</dt>
            <dd className="text-ink-100">{competition.teamCount}</dd>
          </dl>
        </section>
      </div>
    </>
  );
}

export function CompetitionDetailPage() {
  const { id } = route.useParams();
  const { data, isPending, isError, error, refetch } = useCompetition(id);

  return (
    <div className="flex flex-col gap-8">
      <BackLink />

      {isPending ? (
        <LoadingState label="Učitavanje natjecanja…" />
      ) : isError ? (
        error.status === 404 ? (
          <EmptyState message="Natjecanje nije pronađeno." />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )
      ) : (
        <CompetitionDetails competition={data} />
      )}
    </div>
  );
}
