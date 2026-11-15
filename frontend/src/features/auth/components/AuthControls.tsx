import { useEffect, useId, useRef, useState } from 'react';
import { roleLabel, useLogout, useSession, type SessionUser } from '../api';
import { useLoginDialog } from '../loginDialog';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0]![0]}${parts.at(-1)![0]}` : name.slice(0, 2);
  return letters.toUpperCase();
}

// Currently just initials
function Avatar({ user }: { user: SessionUser }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent-purple-300 bg-accent-purple-600 font-mono text-xs text-accent-purple-100"
    >
      {initials(user.displayName)}
    </span>
  );
}

function ProfileDetails({ user }: { user: SessionUser }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-ink-100">{user.displayName}</span>
      <span className="truncate text-sm text-ink-300">{user.email}</span>
      <span className="mt-1 self-start rounded-full border border-primary-400 px-2 font-mono text-xs text-ink-200">
        {roleLabel[user.permLevel]}
      </span>
    </div>
  );
}

function LogoutButton({ onDone }: { onDone?: () => void }) {
  const logout = useLogout();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSuccess: onDone })}
        className="rounded-md border border-primary-500 px-3 py-1.5 text-left font-mono text-sm text-ink-200 hover:border-primary-300 hover:text-ink-100 disabled:cursor-wait disabled:opacity-70"
      >
        {logout.isPending ? 'Odjava…' : 'Odjava'}
      </button>
      {logout.isError && (
        <span role="alert" className="text-xs text-red-300">
          Odjava nije uspjela. Pokušajte ponovno.
        </span>
      )}
    </div>
  );
}

// Desktop: avatar button with a dropdown card.
function ProfileMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Profil: ${user.displayName}`}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full py-0.5 pr-2 pl-0.5 text-ink-200 hover:bg-primary-600 hover:text-ink-100"
      >
        <Avatar user={user} />
        <span className="max-w-40 truncate text-sm">{user.displayName}</span>
        <svg
          viewBox="0 0 24 24"
          className={`size-4 transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute top-full right-0 z-20 mt-2 flex w-72 flex-col gap-4 rounded-lg border border-primary-500 bg-primary-700 p-4 shadow-xl shadow-black/40"
        >
          <div className="flex items-start gap-3">
            <Avatar user={user} />
            <ProfileDetails user={user} />
          </div>
          <hr className="border-primary-500" />
          <LogoutButton onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

// Mobile menu: the same details shown inline.
function ProfileSummary({ user, onDone }: { user: SessionUser; onDone?: () => void }) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <Avatar user={user} />
        <ProfileDetails user={user} />
      </div>
      <LogoutButton onDone={onDone} />
    </div>
  );
}

export function AuthControls({
  variant,
  onNavigate,
}: {
  variant: 'desktop' | 'mobile';
  /** Called before leaving the menu, e.g. to close the mobile menu. */
  onNavigate?: () => void;
}) {
  const session = useSession();
  const loginDialog = useLoginDialog();

  // Hold the space while the session loads so the header does not flash the
  // login buttons for users who are already signed in.
  if (session.isPending)
    return <span role="status" aria-label="Provjera prijave" className="h-8 w-36" />;

  if (session.isError) {
    return (
      <div role="alert" className="flex items-center gap-2 text-xs text-red-200">
        <span>Prijava nije dostupna.</span>
        <button type="button" onClick={() => void session.refetch()} className="underline underline-offset-2">
          Pokušaj ponovno
        </button>
      </div>
    );
  }

  const user = session.data ?? null;
  if (user) {
    return variant === 'desktop' ? (
      <ProfileMenu user={user} />
    ) : (
      <ProfileSummary user={user} onDone={onNavigate} />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        loginDialog.open();
      }}
      className="rounded-md bg-primary-200 px-3 py-1.5 font-mono text-sm text-primary-700 hover:bg-primary-100"
    >
      Prijava
    </button>
  );
}
