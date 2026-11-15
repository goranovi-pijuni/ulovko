import { useState, type FormEvent } from 'react';
import { ApiError, serverMessage } from '@/api/client';
import { useChallengeCategories, useEditChallenge, type OrganizerChallenge } from '../api';

const inputClass = 'w-full rounded-md border border-primary-400 bg-primary-700/60 px-3 py-2 text-ink-100 focus:border-organizer-300 focus:outline-none disabled:opacity-50';
const maxUploadSize = 64 * 1024 * 1024;

function localDateTime(utc: string): string {
  const date = new Date(utc);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ChallengeEditForm({
  competitionId, challenge, onClose,
}: {
  competitionId: number;
  challenge: OrganizerChallenge;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(challenge.challengeTitle);
  const [description, setDescription] = useState(challenge.challengeDescription ?? '');
  const [publishingDate, setPublishingDate] = useState(localDateTime(challenge.publishingDate));
  const [categoryId, setCategoryId] = useState(String(challenge.categoryId));
  const [points, setPoints] = useState(challenge.points?.toString() ?? '');
  const [isPublic, setIsPublic] = useState(challenge.isPublic);
  const [flag, setFlag] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState('');
  const categories = useChallengeCategories();
  const edit = useEditChallenge(competitionId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new Date(publishingDate);
    if (!title.trim() || title.length > 200 || description.length > 10_000 || !Number.isFinite(date.valueOf()) || !Number.isSafeInteger(Number(categoryId)) || Number(categoryId) < 1 || (points !== '' && (!/^\d+$/.test(points) || Number(points) > 2147483647)) || (file && (!file.name.toLowerCase().endsWith('.zip') || file.size > maxUploadSize))) {
      setValidation('Provjerite naziv, datum, kategoriju, bodove i ZIP arhivu (do 64 MiB).');
      return;
    }
    setValidation('');
    edit.mutate({
      challengeId: challenge.id,
      data: { title, description, publishingDate, categoryId: Number(categoryId), points, isPublic, flag, file },
    }, { onSuccess: onClose });
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3 rounded-lg border border-organizer-400/70 bg-primary-700/65 p-4">
      <h4 className="text-lg text-ink-100">Uredi zadatak</h4>
      <label className="flex flex-col gap-1 text-sm text-ink-200">Naziv
        <input className={inputClass} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} disabled={edit.isPending} required />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-200">Opis
        <textarea className={inputClass} rows={3} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} disabled={edit.isPending} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-ink-200">Kategorija
          <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={edit.isPending || categories.isPending}>
            {categories.data?.map((category) => <option key={category.id} value={category.id}>{category.categoryName}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-200">Bodovi
          <input className={inputClass} type="number" min="0" max="2147483647" step="1" value={points} onChange={(e) => setPoints(e.target.value)} disabled={edit.isPending} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-ink-200">Datum i vrijeme objave
        <input className={inputClass} type="datetime-local" value={publishingDate} onChange={(e) => setPublishingDate(e.target.value)} disabled={edit.isPending} required />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-200">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} disabled={edit.isPending} /> Javno dostupan zadatak
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-200">Nova zastavica (ostavite prazno za zadržavanje stare)
        <input className={inputClass} value={flag} onChange={(e) => setFlag(e.target.value)} autoComplete="off" maxLength={4096} disabled={edit.isPending} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-200">Nova ZIP arhiva (neobavezno)
        <input type="file" accept=".zip,application/zip" className="w-full min-w-0 text-sm text-ink-200" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={edit.isPending} />
        <span className="text-xs text-ink-300">Ako odaberete ZIP, zamijenit će postojeće datoteke. Pokrenuti servisi neće se automatski ponovno izgraditi.</span>
      </label>
      {validation && <p role="alert" className="text-sm text-red-300">{validation}</p>}
      {categories.isError && <p role="alert" className="text-sm text-red-300">Kategorije nije moguće dohvatiti.</p>}
      {edit.isError && <p role="alert" className="text-sm text-red-300">{edit.error instanceof ApiError ? serverMessage(edit.error) ?? 'Spremanje nije uspjelo.' : 'Spremanje nije uspjelo.'}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={edit.isPending || categories.isPending || categories.isError} className="rounded-md bg-accent-green-200 px-4 py-2 text-sm font-medium text-accent-green-700 disabled:opacity-50">
          {edit.isPending ? 'Spremanje…' : 'Spremi izmjene'}
        </button>
        <button type="button" onClick={onClose} disabled={edit.isPending} className="rounded-md border border-primary-400 px-4 py-2 text-sm text-ink-200">Odustani</button>
      </div>
    </form>
  );
}
