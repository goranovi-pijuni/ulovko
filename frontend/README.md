# Ulovko — frontend

React + TypeScript + Vite SPA za natjecateljsko, organizacijsko i administracijsko sučelje.

## Pokretanje

Potreban je samo Node.js 22 ili noviji (npm dolazi uz njega), kao i za backend.

1. Instalirati Node.js LTS s [nodejs.org](https://nodejs.org/) (na Windowsima i `winget install OpenJS.NodeJS.LTS`).
2. Instalirati ovisnosti i pokrenuti razvojni poslužitelj:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

Razvojni poslužitelj radi na `http://localhost:5173` i prosljeđuje `/api` na backend (`http://localhost:3000`).

Ostale naredbe: `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run format:check`.

Napomene:

- `npm install` koristiti samo pri dodavanju ili nadogradnji paketa i zatim commitati promijenjeni `package-lock.json`.
- `allowScripts` u `package.json` dopušta instalacijsku skriptu paketa `esbuild` (koristi ga Vite).

## Struktura

```text
src/
  app/
    router/          # rute i provjera pristupa (TanStack Router)
    providers/       # QueryClient, kasnije sesija i tema
    layouts/         # Public, a zatim Competitor, Organizer, Admin
  features/          # jedna mapa po funkcionalnoj cjelini
    competitions/    # primjer: types.ts, api.ts (query hookovi), components/, pages/
    auth/ teams/ challenges/ submissions/ scoreboard/
    organizer/ infrastructure/ administration/
  components/
    ui/              # shadcn/ui komponente
    shared/          # zajedničke komponente (stanja učitavanja/pogreške, 404)
  api/
    generated/       # Orval izlaz — ne mijenjati ručno
    client.ts        # centralna HTTP konfiguracija
  lib/
    validation/      # Zod sheme
    realtime/        # SSE / EventSource
    datetime.ts      # UTC iz API-ja → lokalni prikaz
  tests/
```

Svaka nova funkcionalnost slijedi uzorak iz `features/competitions`: tipovi, query hookovi s ključevima, komponente i stranice, uz prikaz stanja učitavanja, praznog rezultata i pogreške.

`features/competitions/api.ts` dohvaća `GET /api/competitions`, pa za prikaz natjecanja lokalno mora biti pokrenut backend.
