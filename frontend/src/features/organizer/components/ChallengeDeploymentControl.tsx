import { ApiError, serverMessage } from '@/api/client';
import { useDeployChallenge, useDeploymentStatus } from '../api';
import { ChallengeEndpoints } from '@/features/challenges/components/ChallengeEndpoints';

const labels = {
  uploaded: 'Spremno za izgradnju',
  building: 'Izgradnja u tijeku…',
  built: 'Slanje servisa u Kubernetes…',
  deployed: 'Deployment stvoren (servisi se pokreću)',
  error: 'Greška pri pokretanju',
};

export function ChallengeDeploymentControl({ competitionId, challengeId, hasDeploy }: {
  competitionId: number;
  challengeId: number;
  hasDeploy: boolean;
}) {
  const status = useDeploymentStatus(competitionId, challengeId, hasDeploy);
  const deploy = useDeployChallenge(competitionId);
  if (!hasDeploy) return null;
  const state = status.data?.status ?? null;
  const busy = deploy.isPending || state === 'building' || state === 'built';
  const alreadyDeployed = state === 'deployed';

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-primary-500 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || alreadyDeployed || status.isPending || status.isError} onClick={() => deploy.mutate(challengeId)} className="rounded-md border border-accent-green-400 bg-accent-green-600/30 px-3 py-2 font-mono text-sm text-accent-green-100 hover:bg-accent-green-600/50 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'Pokretanje…' : 'Pokreni sada'}
        </button>
        <span className="font-mono text-xs text-ink-300">
          {status.isPending ? 'Provjera stanja…' : state ? labels[state] : 'Nije pokrenuto'}
        </span>
      </div>
      <p className="text-xs text-ink-300">Servisi s <code>public: true</code> u konfiguraciji mogu postati mrežno dostupni odmah, neovisno o oznaci javnog zadatka.</p>
      {alreadyDeployed && <p className="text-xs text-ink-300">Za ponovnu objavu najprije ručno uklonite postojeći deployment na runneru.</p>}
      {state === 'error' && status.data?.error && <p role="alert" className="text-sm text-red-300">{status.data.error}</p>}
      {state === 'deployed' && status.data && <ChallengeEndpoints endpoints={status.data.endpoints} />}
      {status.isError && <p role="alert" className="text-sm text-red-300">Nije moguće provjeriti stanje runnera.</p>}
      {deploy.isError && <p role="alert" className="text-sm text-red-300">{deploy.error instanceof ApiError ? serverMessage(deploy.error) ?? 'Pokretanje nije uspjelo.' : 'Pokretanje nije uspjelo.'}</p>}
    </div>
  );
}
