# Ulovko — frontend

React + TypeScript + Vite SPA za natjecateljsko, organizacijsko i administracijsko sučelje.

## Pokretanje

Potreban je samo Node.js 22 ili noviji, kao i za backend.

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

## API klijent (Orval)

Tipovi i query hookovi za backend generiraju se [Orvalom](https://orval.dev/) iz OpenAPI dokumenta backenda:

- `openapi.json` — commitana snimka OpenAPI dokumenta (`/api/docs-json`), jedini ulaz za generiranje.
- `orval.config.ts` — konfiguracija: TanStack Query hookovi, `fetch` klijent i `apiFetch` iz `src/api/client.ts` kao mutator.
- `src/api/generated/` — izlaz (`endpoints/<tag>/` i `model/`), commita se i ne mijenja ručno.

Kada se API backenda promijeni:

```bash
# uz pokrenut backend na http://localhost:3000
npm run api:fetch      # osvježi openapi.json (drugi izvor: OPENAPI_URL=...)
npm run api:generate   # ponovno generira src/api/generated
```

Zatim commitati `openapi.json` i `src/api/generated` zajedno s promjenom koja ih koristi. Tipovi postoje samo za odgovore koje backend opisuje u Swaggeru (`@ApiOkResponse({ type: SomeDto })`); bez toga Orval odgovor tipizira kao `void`.

Generirani URL-ovi već sadrže prefiks `/api`, a `apiFetch` šalje kolačić sesije i za neuspješne odgovore baca `ApiError` (tip `error` u hookovima).

## Prijava i registracija

`features/auth` drži sesiju (`useSession`, iz `GET /api/auth/profile`; odgovor 401 znači odjavljen korisnik), skočni prozor za prijavu (`LoginDialog`), stranicu `/signup` i profil u zaglavlju.

Prijava Googleom radi preko postojećeg `GET /api/auth/google/login`. Prijava i registracija lozinkom pozivaju **predložene** rute koje backend još ne implementira. Dok ih nema, obrasci prikazuju poruku da je dostupna samo prijava Googleom. Kada backend doda rute, treba osvježiti `openapi.json` i zamijeniti ručno napisane pozive u `features/auth/api.ts` generiranima.

## Struktura

```text
src/
  app/
    router/          # rute i provjera pristupa (TanStack Router)
    providers/       # QueryClient, kasnije sesija i tema
    layouts/         # Public, a zatim Competitor, Organizer, Admin
  features/          # jedna mapa po funkcionalnoj cjelini
    competitions/    # primjer: api.ts (omotači generiranih hookova i tipova), components/, pages/
    auth/ teams/ challenges/ submissions/ scoreboard/
    organizer/ infrastructure/ administration/
  components/
    ui/              # shadcn/ui komponente
    shared/          # zajedničke komponente (stanja učitavanja/pogreške, 404)
  api/
    generated/       # Orval izlaz — ne mijenjati ručno
    client.ts        # centralna HTTP konfiguracija (Orval mutator)
  lib/
    validation/      # Zod sheme
    realtime/        # SSE / EventSource
    datetime.ts      # UTC iz API-ja → lokalni prikaz
  tests/
```

Svaka nova funkcionalnost slijedi uzorak iz `features/competitions`: `api.ts` ponovno izvozi generirane hookove, ključeve upita i tipove pod nazivima te cjeline, a komponente i stranice uvoze samo iz njega, uz prikaz stanja učitavanja, praznog rezultata i pogreške.

`features/competitions/api.ts` dohvaća `GET /api/competitions`, pa za prikaz natjecanja lokalno mora biti pokrenut backend.
