import { formatDateTime } from '@/lib/datetime';
import type { Competition, CompetitionStatus } from '../types';

const statusLabel: Record<CompetitionStatus, string> = {
  upcoming: 'Najavljeno',
  active: 'U tijeku',
  finished: 'Završeno',
};

// Card tint and badge colour per status, as in the Figma home screen.
const cardClass: Record<CompetitionStatus, string> = {
  active: 'bg-linear-to-b from-primary-600 to-accent-green-600',
  upcoming: 'bg-linear-to-b from-primary-600 to-accent-purple-600',
  finished: 'border border-primary-500 bg-primary-700',
};

const badgeClass: Record<CompetitionStatus, string> = {
  active: 'border-accent-green-200 bg-accent-green-700 text-accent-green-200',
  upcoming:
    'border-accent-purple-200 bg-accent-purple-700 text-accent-purple-200',
  finished: 'border-ink-300 bg-primary-700 text-ink-300',
};

export function CompetitionCard({ competition }: { competition: Competition }) {
  return (
    <article
      className={`flex flex-col gap-4 rounded-lg p-5 shadow-lg shadow-black/20 ${cardClass[competition.status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-2xl text-ink-100">{competition.name}</h3>
        <span
          className={`mt-1 shrink-0 rounded-full border px-2 font-mono text-sm ${badgeClass[competition.status]}`}
        >
          {statusLabel[competition.status]}
        </span>
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
