import { Link } from '@tanstack/react-router';

export function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-mono font-semibold">
        404: Stranica nije pronađena
      </h1>
      <Link
        to="/competitions"
        className="mt-4 inline-block text-ink-300 hover:underline"
      >
        Natrag na natjecanja
      </Link>
    </div>
  );
}
