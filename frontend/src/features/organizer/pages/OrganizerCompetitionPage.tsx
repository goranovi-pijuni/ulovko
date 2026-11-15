import { useState } from 'react';
import { getRouteApi, Link } from '@tanstack/react-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/shared/QueryStates';
import { useSession } from '@/features/auth/api';
import { useCompetition } from '@/features/competitions/api';
import { CompetitionStatusBadge } from '@/features/competitions/components/CompetitionStatusBadge';
import { formatDateTime } from '@/lib/datetime';
import { useOrganizerChallenges, type OrganizerChallenge } from '../api';
import { ChallengeUploadForm } from '../components/ChallengeUploadForm';
import { ChallengeEditForm } from '../components/ChallengeEditForm';
import { ChallengeDeploymentControl } from '../components/ChallengeDeploymentControl';
import { ChallengeHandout } from '@/features/challenges/components/ChallengeHandout';

const route = getRouteApi('/organizer/competitions/$id');

function PublicationBadge({ challenge }: { challenge: OrganizerChallenge }) {
  const color = challenge.isPublic
    ? 'border-accent-green-400 text-accent-green-200'
    : 'border-organizer-400/70 text-organizer-200';

  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-xs ${color}`}>
      {challenge.isPublic ? 'Javna objava uključena' : 'Nije javno'}
    </span>
  );
}

function OrganizerChallengeItem({ challenge, competitionId }: {
  challenge: OrganizerChallenge;
  competitionId: number;
}) {
  const [editing, setEditing] = useState(false);
  return (
            <article
              className="rounded-lg border border-primary-500 bg-primary-600/45 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-organizer-300">
                    {challenge.categoryName} · #{challenge.id}
                  </p>
                  <h3 className="mt-1 text-lg text-ink-100">
                    {challenge.challengeTitle}
                  </h3>
                </div>
                <PublicationBadge challenge={challenge} />
              </div>

              {challenge.challengeDescription && (
                <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-ink-300">
                  {challenge.challengeDescription}
                </p>
              )}

              <dl className="mt-4 grid gap-x-4 gap-y-2 border-t border-primary-500 pt-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-300">Objava</dt>
                  <dd className="text-ink-100">
                    {formatDateTime(challenge.publishingDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-300">Bodovi</dt>
                  <dd className="text-ink-100">
                    {challenge.points === null ? 'Nisu zadani' : challenge.points}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-300">Datoteke za natjecatelje</dt>
                  <dd className="text-ink-100">
                    {challenge.hasHandout ? 'Dostupne' : 'Nema ih'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-300">Servisi za izvođenje</dt>
                  <dd className="text-ink-100">
                    {challenge.hasDeploy ? 'Priloženi' : 'Nisu priloženi'}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditing(!editing)} className="rounded-md border border-organizer-400 px-3 py-2 font-mono text-sm text-organizer-200 hover:bg-organizer-500/30">
                  {editing ? 'Zatvori uređivanje' : 'Uredi zadatak'}
                </button>
              </div>
              {challenge.hasHandout && <div className="mt-3"><ChallengeHandout competitionId={competitionId} challengeId={challenge.id} /></div>}
              {editing && <ChallengeEditForm competitionId={competitionId} challenge={challenge} onClose={() => setEditing(false)} />}
              <ChallengeDeploymentControl competitionId={competitionId} challengeId={challenge.id} hasDeploy={challenge.hasDeploy} />
            </article>
  );
}

function OrganizerChallengeList({ competitionId }: { competitionId: number }) {
  const { data, isPending, isError, error, refetch } =
    useOrganizerChallenges(competitionId);

  return (
    <section
      aria-labelledby="managed-challenges-heading"
      className="flex min-w-0 flex-col gap-5"
    >
      <div>
        <h2 id="managed-challenges-heading" className="text-2xl text-ink-100">
          Zadaci natjecanja
        </h2>
        <p className="mt-1 text-sm text-ink-300">
          Ovdje su vidljivi i neobjavljeni zadaci. Zastavice se ne prikazuju.
        </p>
      </div>

      {isPending ? (
        <LoadingState label="Učitavanje zadataka…" />
      ) : isError ? (
        <ErrorState
          message={
            error.status === 403
              ? 'Nemate pravo vidjeti zadatke ovog natjecanja.'
              : error.status === 404
                ? 'Natjecanje nije pronađeno.'
                : 'Zadatke trenutačno nije moguće dohvatiti.'
          }
          onRetry={() => void refetch()}
        />
      ) : data.length === 0 ? (
        <EmptyState message="Još nema zadataka. Dodajte prvi zadatak putem ZIP arhive." />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs text-ink-300">
            Ukupno zadataka: {data.length}
          </p>
          {data.map((challenge) => (
            <OrganizerChallengeItem key={challenge.id} challenge={challenge} competitionId={competitionId} />
          ))}
        </div>
      )}
    </section>
  );
}

export function OrganizerCompetitionPage() {
  const { id } = route.useParams();
  const { stvoreno } = route.useSearch();
  const { data: user } = useSession();
  const { data: competition, isPending, isError, error, refetch } =
    useCompetition(id);
  const canManage = Boolean(
    competition &&
      user &&
      (user.permLevel === 3 || competition.organisedBy === user.id),
  );

  return (
    <div className="flex min-w-0 flex-col gap-7">
      <Link
        to="/organizer"
        hash="natjecanja"
        className="self-start font-mono text-sm text-ink-300 hover:text-ink-100"
      >
        ← Moja natjecanja
      </Link>

      {isPending ? (
        <LoadingState label="Učitavanje natjecanja…" />
      ) : isError ? (
        error.status === 404 ? (
          <EmptyState message="Natjecanje nije pronađeno." />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )
      ) : !canManage ? (
        <ErrorState message="Nemate pravo upravljati ovim natjecanjem." />
      ) : (
        <>
          {stvoreno && (
            <div
              role="status"
              className="rounded-md border border-accent-green-400 bg-accent-green-600/30 p-4 text-accent-green-100"
            >
              Natjecanje je stvoreno. Sada možete dodati zadatke.
            </div>
          )}

          <header className="rounded-xl border border-organizer-500/70 bg-linear-to-br from-primary-600 via-organizer-600/50 to-accent-purple-600/30 p-6 sm:p-8">
            <p className="font-mono text-xs uppercase tracking-widest text-organizer-300">
              Upravljanje natjecanjem
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="min-w-0 text-3xl text-ink-100 sm:text-4xl">
                {competition.name}
              </h1>
              <CompetitionStatusBadge status={competition.status} />
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-ink-200">
              {competition.description || 'Natjecanje nema opisa.'}
            </p>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-300">Početak</dt>
                <dd className="text-ink-100">
                  {formatDateTime(competition.startsAt)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-300">Završetak</dt>
                <dd className="text-ink-100">
                  {formatDateTime(competition.endsAt)}
                </dd>
              </div>
            </dl>
            <Link
              to="/competitions/$id"
              params={{ id }}
              className="mt-5 inline-block rounded-md border border-organizer-300/70 px-3 py-2 font-mono text-sm text-ink-100 hover:bg-organizer-500/30"
            >
              Otvori javnu stranicu →
            </Link>
          </header>

          <div className="grid min-w-0 gap-6 xl:grid-cols-2 xl:items-start">
            <OrganizerChallengeList competitionId={id} />
            <ChallengeUploadForm competitionId={id} />
          </div>
        </>
      )}
    </div>
  );
}
