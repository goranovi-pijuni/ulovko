import { Link } from "@tanstack/react-router";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/QueryStates";
import { useSession } from "@/features/auth/api";
import {
  useCompetitions,
  type Competition,
  type CompetitionStatus,
} from "@/features/competitions/api";
import { CompetitionStatusBadge } from "@/features/competitions/components/CompetitionStatusBadge";
import { formatDateTime } from "@/lib/datetime";

const statusOrder: Record<CompetitionStatus, number> = {
  active: 0,
  upcoming: 1,
  finished: 2,
};

function OrganizerCompetitionCard({ competition }: { competition: Competition }) {
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-lg border border-primary-500 bg-primary-600/45 p-5 transition hover:border-organizer-300/70 hover:bg-primary-600/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="min-w-0 text-xl text-ink-100">{competition.name}</h3>
        <CompetitionStatusBadge status={competition.status} />
      </div>
      <p className="line-clamp-2 min-h-10 text-sm text-ink-300">
        {competition.description || "Opis nije dodan."}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-300">Početak</dt>
        <dd className="text-ink-100">
          <time dateTime={competition.startsAt}>{formatDateTime(competition.startsAt)}</time>
        </dd>
        <dt className="text-ink-300">Završetak</dt>
        <dd className="text-ink-100">
          <time dateTime={competition.endsAt}>{formatDateTime(competition.endsAt)}</time>
        </dd>
        <dt className="text-ink-300">Timovi</dt>
        <dd className="text-ink-100">{competition.teamCount}</dd>
      </dl>
      <Link
        to="/competitions/$id"
        params={{ id: competition.id }}
        className="mt-auto self-start rounded-md border border-organizer-400 px-3 py-2 font-mono text-sm text-ink-100 hover:bg-organizer-500/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-organizer-200"
      >
        Detalji natjecanja →
      </Link>
    </article>
  );
}

export function OrganizerDashboard() {
  const { data: user } = useSession();
  const { data, isPending, isError, refetch } = useCompetitions();

  // The public competitions API already includes the creator's user ID.
  // Filtering here is for presentation; access control remains on the backend.
  const mine = (data ?? [])
    .filter((competition) => competition.organisedBy === user?.id)
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const active = mine.filter((competition) => competition.status === "active").length;
  const upcoming = mine.filter((competition) => competition.status === "upcoming").length;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="rounded-xl border border-organizer-500/70 bg-linear-to-br from-primary-600 via-organizer-600/65 to-accent-purple-600/55 p-6 shadow-lg shadow-black/20 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-organizer-200">
          Organizacijska nadzorna ploča
        </p>
        <h1 className="mt-3 text-3xl text-ink-100 sm:text-4xl">Pregled natjecanja</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-200 sm:text-base">
          Ovdje možete pratiti natjecanja koja organizirate i otvoriti njihove detalje.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span
            aria-disabled="true"
            title="Forma za stvaranje natjecanja bit će dostupna uskoro"
            className="cursor-not-allowed rounded-md bg-accent-green-200/70 px-4 py-2 font-mono text-sm font-medium text-accent-green-700/90 opacity-70"
          >
            + Novo natjecanje (uskoro)
          </span>
          <Link
            to="/competitions"
            className="rounded-md border border-organizer-300/60 px-4 py-2 font-mono text-sm text-ink-100 hover:bg-organizer-500/40"
          >
            Javni popis natjecanja
          </Link>
        </div>
      </header>

      <section aria-label="Sažetak organizacije" className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Ukupno natjecanja", value: mine.length },
          { label: "U tijeku", value: active },
          { label: "Najavljena", value: upcoming },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-primary-500 bg-primary-600/35 p-5">
            <p className="font-mono text-xs uppercase tracking-wide text-ink-300">{label}</p>
            <p
              className="mt-2 text-3xl text-ink-100"
              aria-label={`${label}: ${isPending || !user || isError ? "učitavanje" : value}`}
            >
              {isPending || !user || isError ? "—" : value}
            </p>
          </div>
        ))}
      </section>

      <section id="natjecanja" className="flex flex-col gap-5 scroll-mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-primary-500 pb-4">
          <div>
            <h2 className="text-2xl text-ink-100">Moja natjecanja</h2>
            <p className="mt-1 text-sm text-ink-300">
              Natjecanja koja ste stvorili kao organizator.
            </p>
          </div>
        </div>

        {!user || isPending ? (
          <LoadingState label="Učitavanje vaših natjecanja…" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : mine.length === 0 ? (
          <EmptyState message="Još nemate vlastitih natjecanja. Ovdje će se pojaviti nakon stvaranja." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {mine.map((competition) => (
              <OrganizerCompetitionCard key={competition.id} competition={competition} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
