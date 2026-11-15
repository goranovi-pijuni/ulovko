import { useRef, useState, type FormEvent } from 'react';
import { ApiError, serverMessage } from '@/api/client';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/QueryStates';
import { useChallengeCategories, useUploadChallenge } from '../api';

const maxUploadSize = 64 * 1024 * 1024;
const inputClass =
  'w-full rounded-md border border-primary-400/70 bg-primary-700/60 px-3 py-2.5 text-ink-100 outline-none transition placeholder:text-ink-400 focus:border-organizer-300 focus:ring-2 focus:ring-organizer-500/40 disabled:opacity-60';

type Values = {
  title: string;
  description: string;
  categoryId: string;
  publishingDate: string;
  points: string;
  flag: string;
  isPublic: boolean;
};

const initialValues: Values = {
  title: '',
  description: '',
  categoryId: '',
  publishingDate: '',
  points: '',
  flag: '',
  isPublic: false,
};

type Errors = Partial<Record<keyof Values | 'file', string>>;

function validate(values: Values, file: File | null): Errors {
  const errors: Errors = {};
  if (!values.title.trim()) errors.title = 'Unesite naziv zadatka.';
  if (values.title.trim().length > 200) errors.title = 'Naziv je predugačak.';
  if (values.description.trim().length > 10_000) errors.description = 'Opis je predugačak.';
  if (!Number.isSafeInteger(Number(values.categoryId)) || Number(values.categoryId) < 1) {
    errors.categoryId = 'Odaberite kategoriju.';
  }
  if (!values.publishingDate || !Number.isFinite(new Date(values.publishingDate).getTime())) {
    errors.publishingDate = 'Odaberite valjan datum i vrijeme objave.';
  }
  if (!values.flag.trim() || values.flag.length > 4096) errors.flag = 'Unesite valjanu zastavicu.';
  if (values.points && (!/^\d+$/.test(values.points) || Number(values.points) > 2147483647)) {
    errors.points = 'Bodovi moraju biti nenegativan cijeli broj.';
  }
  if (!file) errors.file = 'Odaberite ZIP arhivu.';
  else if (!file.name.toLowerCase().endsWith('.zip')) errors.file = 'Datoteka mora biti ZIP arhiva.';
  else if (file.size > maxUploadSize) errors.file = 'ZIP arhiva ne smije biti veća od 64 MiB.';
  return errors;
}

function uploadError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400: return serverMessage(error) ?? 'ZIP arhiva ili podaci nisu valjani.';
      case 401: return 'Prijava je istekla. Prijavite se ponovno.';
      case 403: return 'Nemate pravo dodavati zadatke u ovo natjecanje.';
      case 404: return 'Natjecanje ili odabrana kategorija nije pronađena.';
      case 413: return 'ZIP arhiva je prevelika (najviše 64 MiB).';
      case 503: return 'Pohrana zadatka trenutno nije dostupna. Pokušajte ponovno.';
    }
  }
  return 'Zadatak nije moguće učitati. Provjerite vezu i pokušajte ponovno.';
}

export function ChallengeUploadForm({ competitionId }: { competitionId: number }) {
  const { data: categories, isPending: categoriesPending, isError: categoriesError, refetch } = useChallengeCategories();
  const upload = useUploadChallenge(competitionId);
  const [values, setValues] = useState<Values>(initialValues);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [uploaded, setUploaded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors({});
    setUploaded(false);
    upload.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (upload.isPending || !categories?.length) return;
    const nextErrors = validate(values, file);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !file) return;

    upload.mutate({
      competitionId,
      data: {
        file,
        challengeTitle: values.title.trim(),
        ...(values.description.trim() && { challengeDescription: values.description.trim() }),
        categoryId: Number(values.categoryId),
        publishingDate: new Date(values.publishingDate).toISOString(),
        flag: values.flag.trim(),
        isPublic: values.isPublic,
        ...(values.points !== '' && { points: Number(values.points) }),
      },
    }, {
      onSuccess: () => {
        setValues(initialValues);
        setFile(null);
        setErrors({});
        setUploaded(true);
        if (fileInput.current) fileInput.current.value = '';
      },
    });
  }

  return (
    <section aria-labelledby="upload-heading" className="flex min-w-0 flex-col gap-5 rounded-xl border border-organizer-500/70 bg-linear-to-br from-primary-600/85 to-accent-purple-600/20 p-5 sm:p-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-organizer-300">Novi zadatak</p>
        <h2 id="upload-heading" className="mt-2 text-2xl text-ink-100">Učitaj ZIP zadatka</h2>
        <p className="mt-2 text-sm text-ink-300">Arhiva mora sadržavati <code>public/</code> ili <code>deploy/</code>. Za izvršivi zadatak potrebni su i <code>config.yaml</code> i <code>deploy/</code>. Učitavanje ne pokreće servise.</p>
      </div>

      {categoriesPending ? <LoadingState label="Učitavanje kategorija…" />
        : categoriesError ? <ErrorState message="Kategorije nije moguće dohvatiti." onRetry={() => void refetch()} />
        : !categories?.length ? <EmptyState message="Nema dostupnih kategorija. Najprije dodajte kategorije u bazu podataka." />
        : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="challenge-title" className="text-sm text-ink-200">Naziv zadatka *</label>
              <input id="challenge-title" className={inputClass} value={values.title} maxLength={200} onChange={(e) => update('title', e.target.value)} disabled={upload.isPending} placeholder="npr. Cookie Monster" required />
              {errors.title && <p className="text-sm text-red-300">{errors.title}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="challenge-description" className="text-sm text-ink-200">Opis (neobavezno)</label>
              <textarea id="challenge-description" className={`${inputClass} resize-y`} rows={3} maxLength={10000} value={values.description} onChange={(e) => update('description', e.target.value)} disabled={upload.isPending} />
              {errors.description && <p className="text-sm text-red-300">{errors.description}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="challenge-category" className="text-sm text-ink-200">Kategorija *</label>
                <select id="challenge-category" className={inputClass} value={values.categoryId} onChange={(e) => update('categoryId', e.target.value)} disabled={upload.isPending} required>
                  <option value="">Odaberite kategoriju</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.categoryName}</option>)}
                </select>
                {errors.categoryId && <p className="text-sm text-red-300">{errors.categoryId}</p>}
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="challenge-points" className="text-sm text-ink-200">Bodovi (neobavezno)</label>
                <input id="challenge-points" className={inputClass} value={values.points} onChange={(e) => update('points', e.target.value)} type="number" min="0" max="2147483647" step="1" disabled={upload.isPending} />
                {errors.points && <p className="text-sm text-red-300">{errors.points}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="challenge-publish" className="text-sm text-ink-200">Datum i vrijeme objave *</label>
              <input id="challenge-publish" className={inputClass} type="datetime-local" value={values.publishingDate} onChange={(e) => update('publishingDate', e.target.value)} disabled={upload.isPending} required />
              {errors.publishingDate && <p className="text-sm text-red-300">{errors.publishingDate}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="challenge-flag" className="text-sm text-ink-200">Zastavica *</label>
              <input id="challenge-flag" className={inputClass} value={values.flag} onChange={(e) => update('flag', e.target.value)} disabled={upload.isPending} autoComplete="off" maxLength={4096} placeholder="npr. ulovko{...}" required />
              {errors.flag && <p className="text-sm text-red-300">{errors.flag}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="challenge-file" className="text-sm text-ink-200">ZIP arhiva (najviše 64 MiB) *</label>
              <input id="challenge-file" ref={fileInput} type="file" accept=".zip,application/zip" className="w-full min-w-0 rounded-md border border-primary-400/70 bg-primary-700/60 p-2 text-sm text-ink-200 file:mr-3 file:rounded file:border-0 file:bg-organizer-500/60 file:px-3 file:py-1.5 file:text-ink-100" disabled={upload.isPending} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setUploaded(false); setErrors({}); upload.reset(); }} required />
              {errors.file && <p className="text-sm text-red-300">{errors.file}</p>}
            </div>
            <label className="flex items-start gap-3 rounded-md border border-primary-500 bg-primary-700/40 p-3 text-sm text-ink-200">
              <input type="checkbox" checked={values.isPublic} onChange={(e) => update('isPublic', e.target.checked)} disabled={upload.isPending} className="mt-1 size-4 accent-green-400" />
              <span>Javno dostupan zadatak <span className="block text-xs text-ink-300">Vidljiv natjecateljima tek nakon početka natjecanja i datuma objave. Isključeno znači da ga vidi samo organizator.</span></span>
            </label>
            {upload.isError && <div role="alert" className="rounded-md border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{uploadError(upload.error)}</div>}
            {uploaded && <p role="status" className="rounded-md border border-accent-green-400 bg-accent-green-600/30 p-3 text-sm text-accent-green-100">Zadatak je uspješno učitan i dodan na popis.</p>}
            <button type="submit" disabled={upload.isPending} className="self-start rounded-md bg-accent-green-200 px-5 py-2.5 font-mono text-sm font-medium text-accent-green-700 transition hover:bg-accent-green-100 disabled:cursor-wait disabled:opacity-60">
              {upload.isPending ? 'Učitavanje zadatka…' : 'Učitaj zadatak'}
            </button>
          </form>
        )}
    </section>
  );
}
