import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useSession } from '@/features/auth/api';

export function ChallengeHandout({ competitionId, challengeId }: {
  competitionId: number;
  challengeId: number;
}) {
  const { data: user, isPending: sessionPending } = useSession();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (downloading) return;
    setDownloading(true);
    setError(null);
    try {
      // ZIP is binary; the generated JSON apiFetch client cannot download it.
      const response = await fetch(`/api/competitions/${competitionId}/${challengeId}/handout`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error('Prijavite se kako biste preuzeli datoteke.');
        if (response.status === 403) throw new Error('Za preuzimanje trebate biti član tima u ovom natjecanju.');
        if (response.status === 404) throw new Error('Datoteke zadatka nisu dostupne.');
        throw new Error('Preuzimanje trenutno nije moguće.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `challenge-${challengeId}-public.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Preuzimanje nije uspjelo.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {sessionPending ? (
        <span className="text-sm text-ink-300">Provjera prijave…</span>
      ) : user ? (
        <button type="button" onClick={() => void download()} disabled={downloading} className="rounded-md border border-accent-green-400 px-3 py-2 font-mono text-sm text-accent-green-200 hover:bg-accent-green-600/20 disabled:opacity-50">
          {downloading ? 'Preuzimanje…' : 'Preuzmi public.zip ↓'}
        </button>
      ) : (
        <Link to="/prijava" className="font-mono text-sm text-accent-green-200 underline underline-offset-2">
          Prijavite se za preuzimanje public.zip
        </Link>
      )}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
