import { useState, type FormEvent } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { ApiError } from '@/api/client';
import { useCreateCompetition } from '@/features/competitions/api';

type FormValues = {
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  name: '',
  description: '',
  startsAt: '',
  endsAt: '',
};

const fieldClass =
  'w-full rounded-md border border-primary-400/70 bg-primary-700/60 px-3 py-2.5 text-ink-100 outline-none transition placeholder:text-ink-400 focus:border-organizer-300 focus:ring-2 focus:ring-organizer-500/40 disabled:opacity-60';

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.name.trim()) {
    errors.name = 'Unesite naziv natjecanja.';
  } else if (values.name.trim().length > 200) {
    errors.name = 'Naziv može imati najviše 200 znakova.';
  }

  if (values.description.trim().length > 10000) {
    errors.description = 'Opis može imati najviše 10 000 znakova.';
  }

  const start = values.startsAt ? new Date(values.startsAt) : null;
  const end = values.endsAt ? new Date(values.endsAt) : null;

  if (!start || Number.isNaN(start.getTime())) {
    errors.startsAt = 'Odaberite valjan datum i vrijeme početka.';
  }
  if (!end || Number.isNaN(end.getTime())) {
    errors.endsAt = 'Odaberite valjan datum i vrijeme završetka.';
  } else if (start && !Number.isNaN(start.getTime()) && end <= start) {
    errors.endsAt = 'Završetak mora biti nakon početka natjecanja.';
  }

  return errors;
}

function submissionError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return 'Poslani podaci nisu valjani. Provjerite naziv, opis i datume.';
      case 401:
        return 'Prijava je istekla. Ponovno se prijavite i pokušajte opet.';
      case 403:
        return 'Nemate ovlasti za stvaranje natjecanja.';
      case 503:
        return 'Pohrana za natjecanje trenutačno nije dostupna. Pokušajte ponovno.';
      default:
        break;
    }
  }
  return 'Natjecanje nije moguće stvoriti. Provjerite vezu i pokušajte ponovno.';
}

export function CreateCompetitionPage() {
  const router = useRouter();
  const createCompetition = useCreateCompetition();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});

  function update(field: keyof FormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors({});
    createCompetition.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createCompetition.isPending) return;

    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    createCompetition.mutate(
      {
        data: {
          name: values.name.trim(),
          ...(values.description.trim() && {
            description: values.description.trim(),
          }),
          // datetime-local is local wall time; the API requires a timezone.
          startsAt: new Date(values.startsAt).toISOString(),
          endsAt: new Date(values.endsAt).toISOString(),
        },
      },
      {
        onSuccess: (created) => {
          void router.navigate({
            to: '/organizer/competitions/$id',
            params: { id: created.id },
            search: { stvoreno: true },
          });
        },
      },
    );
  }

  return (
    <div className="flex min-w-0 max-w-3xl flex-col gap-6">
      <Link
        to="/organizer"
        className="self-start font-mono text-sm text-ink-300 hover:text-ink-100"
      >
        ← Organizacijski pregled
      </Link>

      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-organizer-300">
          Organizacija / Natjecanja
        </p>
        <h1 className="text-3xl text-ink-100 sm:text-4xl">Novo natjecanje</h1>
        <p className="max-w-2xl text-ink-300">
          Unesite osnovne informacije o natjecanju. Nakon stvaranja možete
          dodati zadatke i otvoriti njegov javni prikaz.
        </p>
      </header>

      <form
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-6 rounded-xl border border-organizer-500/70 bg-linear-to-br from-primary-600/85 to-accent-purple-600/35 p-5 sm:p-8"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="competition-name" className="font-medium text-ink-100">
            Naziv natjecanja <span aria-hidden="true">*</span>
          </label>
          <input
            id="competition-name"
            name="name"
            type="text"
            value={values.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="npr. FER CTF 2026"
            maxLength={200}
            autoComplete="off"
            required
            disabled={createCompetition.isPending}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'competition-name-error' : undefined}
            className={fieldClass}
          />
          {errors.name && (
            <p id="competition-name-error" className="text-sm text-red-300">
              {errors.name}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="competition-description" className="font-medium text-ink-100">
            Opis <span className="text-sm font-normal text-ink-300">(neobavezno)</span>
          </label>
          <textarea
            id="competition-description"
            name="description"
            value={values.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder="Opišite natjecanje i kome je namijenjeno…"
            rows={5}
            maxLength={10000}
            disabled={createCompetition.isPending}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'competition-description-error' : undefined}
            className={`${fieldClass} resize-y`}
          />
          {errors.description && (
            <p id="competition-description-error" className="text-sm text-red-300">
              {errors.description}
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-medium text-ink-100">Vrijeme održavanja</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="competition-start" className="text-sm text-ink-200">
                Početak <span aria-hidden="true">*</span>
              </label>
              <input
                id="competition-start"
                name="startsAt"
                type="datetime-local"
                value={values.startsAt}
                onChange={(event) => update('startsAt', event.target.value)}
                required
                disabled={createCompetition.isPending}
                aria-invalid={Boolean(errors.startsAt)}
                aria-describedby={errors.startsAt ? 'competition-start-error' : undefined}
                className={`${fieldClass} min-w-0`}
              />
              {errors.startsAt && (
                <p id="competition-start-error" className="text-sm text-red-300">
                  {errors.startsAt}
                </p>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="competition-end" className="text-sm text-ink-200">
                Završetak <span aria-hidden="true">*</span>
              </label>
              <input
                id="competition-end"
                name="endsAt"
                type="datetime-local"
                value={values.endsAt}
                onChange={(event) => update('endsAt', event.target.value)}
                required
                disabled={createCompetition.isPending}
                aria-invalid={Boolean(errors.endsAt)}
                aria-describedby={errors.endsAt ? 'competition-end-error' : undefined}
                className={`${fieldClass} min-w-0`}
              />
              {errors.endsAt && (
                <p id="competition-end-error" className="text-sm text-red-300">
                  {errors.endsAt}
                </p>
              )}
            </div>
          </div>
          <p className="text-sm text-ink-300">
            Datumi i vremena unose se u vašoj lokalnoj vremenskoj zoni.
          </p>
        </fieldset>

        {createCompetition.isError && (
          <div role="alert" className="rounded-md border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">
            {submissionError(createCompetition.error)}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-primary-500 pt-6">
          <button
            type="submit"
            disabled={createCompetition.isPending}
            className="rounded-md bg-accent-green-200 px-5 py-2.5 font-mono text-sm font-medium text-accent-green-700 transition hover:bg-accent-green-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green-200 disabled:cursor-wait disabled:opacity-60"
          >
            {createCompetition.isPending ? 'Stvaranje natjecanja…' : 'Stvori natjecanje'}
          </button>
          <Link
            to="/organizer"
            className="rounded-md border border-primary-400 px-5 py-2.5 font-mono text-sm text-ink-200 hover:bg-primary-500/40 hover:text-ink-100"
          >
            Odustani
          </Link>
        </div>
      </form>
    </div>
  );
}
