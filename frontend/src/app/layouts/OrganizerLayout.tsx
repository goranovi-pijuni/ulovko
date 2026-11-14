import { Link, Outlet } from "@tanstack/react-router";

const activeLinkClass = "border-organizer-300 bg-organizer-500/40 text-ink-100";
const linkClass =
  "rounded-md border border-transparent px-3 py-2 font-mono text-sm text-ink-200 transition hover:bg-primary-500/40 hover:text-ink-100";

export function OrganizerLayout() {
  return (
    <div className="grid gap-7 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
      <aside className="self-start rounded-lg border border-organizer-500/60 bg-primary-600/35 p-4 lg:sticky lg:top-8">
        <p className="px-3 font-mono text-xs uppercase tracking-widest text-organizer-300">
          Radni prostor
        </p>
        <h2 className="px-3 pt-2 text-xl text-ink-100">Organizacija</h2>

        <nav
          aria-label="Organizacijska navigacija"
          className="mt-5 flex flex-wrap gap-1 lg:flex-col"
        >
          <Link
            to="/organizer"
            activeOptions={{ exact: true }}
            className={linkClass}
            activeProps={{ className: `${linkClass} ${activeLinkClass}` }}
          >
            Pregled
          </Link>
          <Link to="/organizer" hash="natjecanja" className={linkClass}>
            Moja natjecanja
          </Link>
        </nav>

        <div className="mt-5 border-t border-primary-500/80 pt-4">
          <Link
            to="/competitions"
            className="px-3 font-mono text-sm text-ink-300 hover:text-ink-100"
          >
            ← Javna natjecanja
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
