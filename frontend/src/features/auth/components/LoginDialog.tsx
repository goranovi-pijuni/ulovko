import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import type { ApiError } from '@/api/client';
import { isEndpointMissing, useLogin } from '../api';
import {
  FormError,
  GoogleButton,
  OrDivider,
  primaryButtonClass,
  TextField,
} from './AuthFormParts';

function loginErrorMessage(error: ApiError | null): string | null {
  if (!error) return null;
  if (error.status === 401) {
    return 'Neispravno korisničko ime, e-pošta ili lozinka.';
  }
  if (isEndpointMissing(error)) {
    return 'Prijava lozinkom još nije dostupna. Prijavite se Googleom.';
  }
  if (error.status === 429) {
    return 'Previše pokušaja prijave. Pričekajte pa pokušajte ponovno.';
  }
  return 'Prijava nije uspjela. Pokušajte ponovno.';
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const login = useLogin();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate(
      { identifier: identifier.trim(), password },
      { onSuccess: onDone },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton>Sign in with Google</GoogleButton>
      <OrDivider />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Korisničko ime ili e-pošta"
          name="identifier"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <TextField
          label="Lozinka"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={loginErrorMessage(login.error)} />
        <button
          type="submit"
          disabled={login.isPending}
          className={primaryButtonClass}
        >
          {login.isPending ? 'Prijava…' : 'Prijavi se'}
        </button>
      </form>
      <p className="text-center text-sm text-ink-300">
        Nemate račun?{' '}
        <Link
          to="/signup"
          onClick={onDone}
          className="text-primary-200 underline-offset-4 hover:underline"
        >
          Izradite ga
        </Link>
      </p>
    </div>
  );
}

export function LoginDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // The native <dialog> provides the backdrop, focus trap and Esc handling;
  // React state stays the source of truth for whether it is open.
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
      // A click on the backdrop targets the <dialog> element itself.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-primary-500 bg-primary-700 text-ink-100 shadow-2xl shadow-black/50 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="relative flex flex-col gap-5 p-8">
        <header className="flex flex-col gap-1 pr-8">
          <h2 id="login-title" className="text-2xl">
            Prijava
          </h2>
          <p className="text-sm text-ink-300">Dobro došli natrag u Ulovko.</p>
        </header>

        {/* Mounted only while open, so each opening starts with a clean form. */}
        {open && <LoginForm onDone={onClose} />}

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
