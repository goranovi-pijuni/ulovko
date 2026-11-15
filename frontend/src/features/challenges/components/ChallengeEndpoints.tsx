import type { ChallengeEndpoint } from '../api';

export function ChallengeEndpoints({ endpoints }: { endpoints: ChallengeEndpoint[] }) {
  if (!endpoints.length) {
    return <p className="text-sm text-ink-300">Nema pokrenutih javnih servisa.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {endpoints.map((endpoint, index) => (
        <li key={`${endpoint.service}-${index}`} className="rounded-md border border-primary-500 bg-primary-600/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-mono text-ink-100">{endpoint.service}</span>
            <span className={endpoint.ready ? 'text-accent-green-200' : 'text-ink-300'}>
              {endpoint.ready ? 'Spreman' : 'Pokreće se'}
            </span>
          </div>
          {endpoint.url ? (
            <a href={endpoint.url} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all font-mono text-sm text-accent-green-200 underline underline-offset-2 hover:text-ink-100">
              {endpoint.url} ↗
            </a>
          ) : endpoint.host && endpoint.port ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all text-sm text-ink-200">nc {endpoint.host} {endpoint.port}</code>
              <button type="button" onClick={() => void navigator.clipboard.writeText(`nc ${endpoint.host} ${endpoint.port}`)} className="rounded border border-primary-400 px-2 py-1 font-mono text-xs text-ink-200 hover:text-ink-100">
                Kopiraj
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
