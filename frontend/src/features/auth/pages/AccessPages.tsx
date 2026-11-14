import { Link } from '@tanstack/react-router';
import { GoogleButton } from '../components/GoogleButton';

const backLinkClass =
  'font-mono text-sm text-primary-200 hover:text-primary-100 hover:underline';

export function LoginRequiredPage() {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-6 rounded-lg border border-primary-500 bg-primary-600/25 p-8 text-center">
      <h1 className="text-3xl">Prijava je potrebna</h1>
      <p className="text-ink-300">
        Za pristup ovoj stranici prijavite se svojim Google računom.
      </p>
      <GoogleButton>Prijava Googleom</GoogleButton>
      <Link to="/competitions" className={backLinkClass}>
        Natrag na natjecanja
      </Link>
    </section>
  );
}

export function AccessDeniedPage() {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-6 rounded-lg border border-primary-500 bg-primary-600/25 p-8 text-center">
      <h1 className="text-3xl">Nemate pristup</h1>
      <p className="text-ink-300">
        Ova stranica dostupna je samo organizatorima i administratorima.
      </p>
      <Link to="/competitions" className={backLinkClass}>
        Natrag na natjecanja
      </Link>
    </section>
  );
}
