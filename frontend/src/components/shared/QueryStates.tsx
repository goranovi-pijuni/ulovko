// Shared views for the loading / empty / error states every screen must show.

export function LoadingState({ label = 'Učitavanje…' }: { label?: string }) {
  return (
    <p role="status" className="py-12 text-center text-ink-300">
      {label}
    </p>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-primary-500 py-12 text-center text-ink-300">
      {message}
    </p>
  );
}

export function ErrorState({
  message = 'Došlo je do pogreške pri dohvaćanju podataka.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-red-900 bg-red-950/40 py-8 text-red-200"
    >
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-red-800 px-3 py-1.5 text-sm hover:bg-red-700"
        >
          Pokušaj ponovno
        </button>
      )}
    </div>
  );
}
