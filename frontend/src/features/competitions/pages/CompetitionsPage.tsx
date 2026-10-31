import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/shared/QueryStates';
import { useCompetitions } from '../api';
import { CompetitionCard } from '../components/CompetitionCard';
import type { Competition, CompetitionStatus } from '../types';

// Active competitions come first, then upcoming; finished ones are listed in
// their own section below.
const statusOrder: Record<CompetitionStatus, number> = {
  active: 0,
  upcoming: 1,
  finished: 2,
};

const divider = <hr className="border-primary-500 lg:w-1/2" />;

function CompetitionGrid({
  title,
  competitions,
}: {
  title: string;
  competitions: Competition[];
}) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="sr-only">{title}</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-11">
        {competitions.map((c) => (
          <CompetitionCard key={c.id} competition={c} />
        ))}
      </div>
    </section>
  );
}

export function CompetitionsPage() {
  const { data, isPending, isError, refetch } = useCompetitions();

  const sorted = [...(data ?? [])].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status],
  );
  const current = sorted.filter((c) => c.status !== 'finished');
  const finished = sorted.filter((c) => c.status === 'finished');

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl text-ink-100">Natjecanja</h1>
        <p className="text-sm text-ink-200">
          Pregled aktivnih, najavljenih i završenih natjecanja
        </p>
      </header>
      {divider}

      {isPending ? (
        <LoadingState label="Učitavanje natjecanja…" />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : sorted.length === 0 ? (
        <EmptyState message="Trenutačno nema natjecanja." />
      ) : (
        <>
          {current.length > 0 && (
            <CompetitionGrid
              title="Aktivna i najavljena natjecanja"
              competitions={current}
            />
          )}
          {current.length > 0 && finished.length > 0 && divider}
          {finished.length > 0 && (
            <CompetitionGrid
              title="Završena natjecanja"
              competitions={finished}
            />
          )}
        </>
      )}
    </div>
  );
}
