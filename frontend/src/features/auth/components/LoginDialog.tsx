import { useEffect, useRef } from 'react';
import { GoogleButton } from './GoogleButton';

export function LoginDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Native dialog provides the backdrop, focus trap and Escape handling.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="login-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-primary-500 bg-primary-700 text-ink-100 shadow-2xl shadow-black/50 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="relative flex flex-col gap-5 p-8">
        <header className="flex flex-col gap-2 pr-8">
          <h2 id="login-title" className="text-2xl">
            Prijava
          </h2>
          <p className="text-sm text-ink-300">
            Prijavite se Google računom. Ako još nemate Ulovko račun, automatski
            ćemo ga izraditi.
          </p>
        </header>

        {open && <GoogleButton>Prijava Googleom</GoogleButton>}

        <button
          type="button"
          onClick={onClose}
          aria-label="Zatvori prijavu"
          className="absolute top-4 right-4 rounded-md p-1 text-ink-300 hover:text-ink-100"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </dialog>
  );
}
