import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { serverMessage, type ApiError } from '@/api/client';
import { LoadingState } from '@/components/shared/QueryStates';
import { isEndpointMissing, useRegister, useSession } from '../api';
import {
  FormError,
  GoogleButton,
  OrDivider,
  primaryButtonClass,
  TextField,
} from '../components/AuthFormParts';
import { useLoginDialog } from '../loginDialog';

function registerErrorMessage(error: ApiError | null): string | null {
  if (!error) return null;
  if (error.status === 409) {
    return 'Korisničko ime ili e-pošta već su zauzeti.';
  }
  // Can be removed when non-Google logins are implemented
  if (isEndpointMissing(error)) {
    return 'Izrada računa lozinkom još nije dostupna. Registrirajte se Googleom.';
  }
  if (error.status === 400) {
    return serverMessage(error) ?? 'Provjerite unesene podatke.';
  }
  return 'Izrada računa nije uspjela. Pokušajte ponovno.';
}

function SignUpForm() {
  const register = useRegister();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const confirmRef = useRef<HTMLInputElement>(null);

  // Native validation blocks submission and shows this message in place.
  useEffect(() => {
    confirmRef.current?.setCustomValidity(
      confirmPassword && confirmPassword !== password
        ? 'Lozinke se ne podudaraju.'
        : '',
    );
  }, [password, confirmPassword]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    register.mutate(
      { username: username.trim(), email: email.trim(), password },
      { onSuccess: () => void navigate({ to: '/competitions' }) },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField
        label="Korisničko ime"
        name="username"
        autoComplete="username"
        required
        minLength={3}
        maxLength={32}
        pattern="[A-Za-z0-9_.\-]+"
        title="Slova, brojke te znakovi _ . -"
        hint="3–32 znaka: slova, brojke te _ . -"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <TextField
        label="E-pošta"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label="Lozinka"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Najmanje 8 znakova"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        ref={confirmRef}
        label="Ponovite lozinku"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      <FormError message={registerErrorMessage(register.error)} />
      <button
        type="submit"
        disabled={register.isPending}
        className={primaryButtonClass}
      >
        {register.isPending ? 'Izrada računa…' : 'Izradi račun'}
      </button>
    </form>
  );
}

export function SignUpPage() {
  const session = useSession();
  const loginDialog = useLoginDialog();

  if (session.isPending) return <LoadingState />;
  if (session.data) return <Navigate to="/competitions" />;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-lg border border-primary-500 bg-primary-600/25 p-6 shadow-lg shadow-black/20 sm:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl text-ink-100">Izrada računa</h1>
        <p className="text-sm text-ink-200">
          Natjecateljski račun za prijavu timova i predaju zastavica.
        </p>
      </header>

      <GoogleButton>Continue with Google</GoogleButton>
      <OrDivider />
      <SignUpForm />

      <p className="text-center text-sm text-ink-300">
        Već imate račun?{' '}
        <button
          type="button"
          onClick={loginDialog.open}
          className="text-primary-200 underline-offset-4 hover:underline"
        >
          Prijavite se
        </button>
      </p>
    </div>
  );
}
