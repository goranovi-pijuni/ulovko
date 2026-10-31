# Ulovko — frontend

React + TypeScript + Vite SPA za natjecateljsko, organizacijsko i administracijsko sučelje.

## Pokretanje

Potrebni su Node.js 22 ili noviji te pnpm u verziji navedenoj u `package.json` (`packageManager`).

1. Instalirati Node.js LTS s [nodejs.org](https://nodejs.org/) (na Windowsima i `winget install OpenJS.NodeJS.LTS`).
2. Instalirati pnpm putem npm-a, u točnoj verziji iz `package.json` (na Windowsima ne traži administratorska prava):

   ```bash
   npm install -g pnpm@11.28.9
   ```

3. Instalirati ovisnosti i pokrenuti razvojni poslužitelj:

   ```bash
   cd frontend
   pnpm install --frozen-lockfile
   pnpm dev
   ```

Napomene:

- Ne koristiti `corepack enable` — na Windowsima traži administratorska prava, a novije verzije Node.js-a više ne uključuju Corepack.
- Ne koristiti samostalni pnpm instalacijski program — starije verzije ne mogu se prebaciti na pnpm 11.
- Ne pokretati `npm install` u ovoj mapi; jedini lockfile je `pnpm-lock.yaml`.
- `pnpm-workspace.yaml` dopušta instalacijsku skriptu paketa `esbuild` (potrebna Viteu) i mora ostati u repozitoriju.
- Pri promjeni verzije pnpm-a ažurirati `packageManager` u `package.json` i naredbu u koraku 2.

Razvojni poslužitelj radi na `http://localhost:5173` i prosljeđuje `/api` na backend (`http://localhost:3000`).

Ostale naredbe: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm format`.

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

`features/competitions/api.ts` trenutačno vraća mock podatke dok backend ne izloži `GET /api/competitions`.
