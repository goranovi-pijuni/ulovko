import { Link } from '@tanstack/react-router';
import type { Challenge } from '../api';

export function ChallengeCard({
  competitionId,
  challenge,
}: {
  competitionId: number;
  challenge: Challenge;
}) {
  return (
    <Link
      to="/competitions/$id/challenges/$challengeId"
      params={{ id: competitionId, challengeId: challenge.id }}
      className="group flex min-w-0 flex-col gap-4 rounded-lg border border-primary-500 bg-primary-600/40 p-5 transition hover:border-primary-300 hover:bg-primary-600/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full border border-accent-purple-400 px-2 py-0.5 font-mono text-xs text-accent-purple-200">
          {challenge.categoryName}
        </span>
        <span className="font-mono text-sm text-ink-300">
          {challenge.points === null
            ? 'Bodovi nisu određeni'
            : `${challenge.points} bod.`}
        </span>
      </div>
      <h3 className="text-xl text-ink-100 group-hover:underline group-hover:underline-offset-4">
        {challenge.challengeTitle}
      </h3>
      <p className="line-clamp-3 text-sm text-ink-300">
        {challenge.challengeDescription || 'Opis nije dostupan.'}
      </p>
      <span className="mt-auto font-mono text-sm text-accent-green-200">
        Otvori zadatak →
      </span>
    </Link>
  );
}
