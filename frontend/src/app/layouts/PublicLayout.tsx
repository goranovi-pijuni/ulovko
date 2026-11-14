import { useState } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { AuthControls } from '@/features/auth/components/AuthControls';
import { LoginDialogProvider } from '@/features/auth/components/LoginDialogProvider';

const navLinkClass = 'font-mono text-ink-200 hover:text-ink-100';
const navLinkActiveClass = 'font-mono text-ink-100';

// Teams and Scoreboard have no pages yet and remain disabled.
const upcomingNavItems = ['Teams', 'Scoreboard'];

function ComingSoon({ label }: { label: string }) {
  return (
    <span
      aria-disabled="true"
      title="Uskoro"
      className="cursor-not-allowed font-mono text-ink-200"
    >
      {label}
    </span>
  );
}

// I will replace the ULOVKO text with a logo when I make one
export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <LoginDialogProvider>
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-primary-600">
          <nav
            aria-label="Glavna navigacija"
            className="mx-auto flex max-w-7xl items-center gap-10 px-4 py-4 sm:px-8"
          >
            <Link
              to="/"
              className="font-mono text-3xl font-medium text-ink-100"
            >
              ULOVKO
            </Link>

            <div className="hidden items-center gap-6 md:flex">
              <Link
                to="/competitions"
                className={navLinkClass}
                activeProps={{ className: navLinkActiveClass }}
              >
                Competitions
              </Link>
              {upcomingNavItems.map((label) => (
                <ComingSoon key={label} label={label} />
              ))}
            </div>

            <div className="ml-auto hidden items-center gap-6 md:flex">
              <AuthControls variant="desktop" />
            </div>

            <button
              type="button"
              className="ml-auto rounded-md p-1 text-ink-200 hover:text-ink-100 md:hidden"
              aria-label={menuOpen ? 'Zatvori izbornik' : 'Otvori izbornik'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-8"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                aria-hidden="true"
              >
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </nav>

          {menuOpen && (
            <div
              id="mobile-menu"
              className="flex flex-col gap-4 border-t border-primary-600 px-4 py-4 md:hidden"
            >
              <Link
                to="/competitions"
                className={navLinkClass}
                activeProps={{ className: navLinkActiveClass }}
                onClick={() => setMenuOpen(false)}
              >
                Competitions
              </Link>
              {upcomingNavItems.map((label) => (
                <ComingSoon key={label} label={label} />
              ))}
              <div className="flex items-center gap-6 border-t border-primary-600 pt-4">
                <AuthControls
                  variant="mobile"
                  onNavigate={() => setMenuOpen(false)}
                />
              </div>
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>
    </LoginDialogProvider>
  );
}
