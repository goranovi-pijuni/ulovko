import type { CompetitionStatus } from '../api';

const statusLabel: Record<CompetitionStatus, string> = {
  upcoming: 'Najavljeno',
  active: 'U tijeku',
  finished: 'Završeno',
};

const badgeClass: Record<CompetitionStatus, string> = {
  active: 'border-accent-green-200 bg-accent-green-700 text-accent-green-200',
  upcoming:
    'border-accent-purple-200 bg-accent-purple-700 text-accent-purple-200',
  finished: 'border-ink-300 bg-primary-700 text-ink-300',
};

export function CompetitionStatusBadge({
  status,
  className = '',
}: {
  status: CompetitionStatus;
  className?: string;
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 font-mono text-sm ${badgeClass[status]} ${className}`}
    >
      {statusLabel[status]}
    </span>
  );
}
