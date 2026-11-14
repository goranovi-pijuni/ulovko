import { getRouteApi, Link } from '@tanstack/react-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/shared/QueryStates';
import { useCompetition, type Competition } from '@/features/competitions/api';
import { formatDateTime } from '@/lib/datetime';
import { useChallenges, type Challenge } from '../api';

const route = getRouteApi('/competitions/$id/challenges/$challengeId');

function ChallengeInformation({ challenge }: { challenge: Challenge }) {
  return (
    <article className="flex flex-col gap-7">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-accent-purple-400 px-3 py-1 font-mono text-xs text-accent-purple-200">
            {challenge.categoryName}
          </span>
          <span className="rounded-full border border-primary-400 px-3 py-1 font-mono text-xs text-ink-200">
            {challenge.points === null
              ? 'Bodovi nisu određeni'
              : `${challenge.points} bod.`}
          </span>
        </div>
        <h1 className="text-3xl text-ink-100 sm:text-4xl">
          {challenge.challengeTitle}
        </h1>
      </header>

      <hr className="border-primary-500 lg:w-1/2" />

      <div className="grid gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-sm text-ink-300">Opis zadatka</h2>
          <p className="whitespace-pre-wrap wrap-break-word text-ink-200">
            {challenge.challengeDescription ||
              'Organizator nije dodao opis zadatka.'}
          </p>
        </section>

        <aside className="self-start rounded-lg border border-primary-500 bg-primary-600/40 p-5">
          <h2 className="mb-4 font-mono text-sm text-ink-300">Detalji zadatka</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-ink-300">Kategorija:</dt>
            <dd className="text-ink-100">{challenge.categoryName}</dd>
            <dt className="text-ink-300">Bodovi:</dt>
            <dd className="text-ink-100">
              {challenge.points === null ? 'Nisu određeni' : challenge.points}
            </dd>
            <dt className="text-ink-300">Objavljeno:</dt>
            <dd className="text-ink-100">
              <time dateTime={challenge.publishingDate}>
                {formatDateTime(challenge.publishingDate)}
              </time>
            </dd>
          </dl>
        </aside>
      </div>
    </article>
  );
}

function PublishedChallenge({
  competitionId,
  challengeId,
}: {
  competitionId: number;
  challengeId: number;
}) {
  // No separate public detail endpoint exists: resolve the ID from the same
  // server-filtered list used by the competition page. Direct URLs work too.
  const { data, isPending, isError, error, refetch } =
    useChallenges(competitionId);

  if (isPending) return <LoadingState label="Učitavanje zadatka…" />;
  if (isError) {
    return error.status === 404 ? (
      <EmptyState message="Natjecanje nije pronađeno." />
    ) : (
      <ErrorState onRetry={() => void refetch()} />
    );
  }

  const challenge = data.find((item) => item.id === challengeId);
  if (!challenge) {
    return (
      <EmptyState message="Zadatak nije pronađen ili nije javno objavljen." />
    );
  }

  return <ChallengeInformation challenge={challenge} />;
}

function CompetitionChallenge({
  competition,
  challengeId,
}: {
  competition: Competition;
  challengeId: number;
}) {
  if (competition.status === 'upcoming') {
    return (
      <EmptyState message="Zadaci će biti dostupni nakon početka natjecanja." />
    );
  }

  return (
    <PublishedChallenge
      competitionId={competition.id}
      challengeId={challengeId}
    />
  );
}

export function ChallengeDetailPage() {
  const { id, challengeId } = route.useParams();
  const {
    data: competition,
    isPending,
    isError,
    error,
    refetch,
  } = useCompetition(id);

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Povratak na natjecanje">
        <Link
          to="/competitions/$id"
          params={{ id }}
          className="font-mono text-sm text-ink-300 hover:text-ink-100"
        >
          ← Natrag na natjecanje
        </Link>
      </nav>

      {isPending ? (
        <LoadingState label="Učitavanje natjecanja…" />
      ) : isError ? (
        error.status === 404 ? (
          <EmptyState message="Natjecanje nije pronađeno." />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )
      ) : (
        <>
          <p className="font-mono text-sm text-ink-300">
            {competition.name} / Zadatak
          </p>
          <CompetitionChallenge
            competition={competition}
            challengeId={challengeId}
          />
        </>
      )}
    </div>
  );
}
