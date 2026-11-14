import { Link } from '@tanstack/react-router';
import { formatDateTime } from '@/lib/datetime';
import type { Competition, CompetitionStatus } from '../api';
import { CompetitionStatusBadge } from './CompetitionStatusBadge';

// Card tint per status.
const cardClass: Record<CompetitionStatus, string> = {
  active: 'bg-linear-to-b from-primary-600 to-accent-green-600',
  upcoming: 'bg-linear-to-b from-primary-600 to-accent-purple-600',
  finished: 'border border-primary-500 bg-primary-700',
};

export function CompetitionCard({ competition }: { competition: Competition }) {
  return (
    <article
      className={`relative flex flex-col gap-4 rounded-lg p-5 shadow-lg shadow-black/20 transition hover:brightness-110 has-focus-visible:ring-2 has-focus-visible:ring-primary-200 ${cardClass[competition.status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-2xl text-ink-100">
          {/* The link's ::after covers the card, so the whole card is clickable
              while screen readers announce only the title as the link. */}
          <Link
            to="/competitions/$id"
            params={{ id: competition.id }}
            className="outline-none after:absolute after:inset-0 after:rounded-lg"
          >
            {competition.name}
          </Link>
        </h3>
        <CompetitionStatusBadge status={competition.status} className="mt-1" />
      </div>
      <p className="line-clamp-4 text-sm text-ink-300">
        {competition.description}
      </p>
      <dl className="mt-auto grid grid-cols-2 gap-x-4 pt-4 text-sm">
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
        <dt className="text-ink-300">Timovi:</dt>
        <dd className="text-ink-100">{competition.teamCount}</dd>
      </dl>
    </article>
  );
}
