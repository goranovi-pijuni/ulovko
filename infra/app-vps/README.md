# Ulovko — aplikacijski VPS

Konfiguracija zajedničkog Debian/Ubuntu VPS-a za **NestJS backend i React/Vite frontend**. Obje aplikacije koriste isti Caddy i isti korisnički račun za GitHub Actions deployment, ali se izgrađuju i deployaju neovisno.

## Arhitektura

| Komponenta | Javna adresa | Način izvođenja | Lokacija na VPS-u |
| --- | --- | --- | --- |
| Backend (NestJS) | `https://ulovko.fun/api` | Node.js 22, `ctf-backend.service`, port `127.0.0.1:3000` | `/opt/ctf/backend` |
| Frontend (React/Vite SPA) | `https://ulovko.fun` | Statičke datoteke koje poslužuje Caddy | `/opt/ctf/frontend/dist` |
| Reverse proxy i HTTPS | `ulovko.fun` (+ redirekcija `api.ulovko.fun`) | Caddy (automatski TLS) | `/etc/caddy/Caddyfile` |

Caddy prosljeđuje `/api` zahtjeve s **`ulovko.fun`** backendu bez uklanjanja prefiksa `/api`, a ostale zahtjeve poslužuje kao frontend SPA (TanStack Router). Stara poddomena `api.ulovko.fun` preusmjerava na istu domenu.

Backend zahtijeva aktivan Node.js proces, a frontend ne: Vite se izgrađuje u GitHub Actions, a na VPS se prenose samo datoteke iz `dist/`. Za frontend nisu potrebni Node.js na VPS-u, Docker ni zaseban systemd servis.

## Preduvjeti

- Debian/Ubuntu VPS sa systemdom i root pristupom.
- DNS zapis `ulovko.fun` (i po želji `api.ulovko.fun` za redirekciju) koji upućuje na taj VPS. Provjeriti i AAAA zapise ako postoje.
- Otvoreni TCP portovi 22, 80 i 443 (lokalni i vanjski firewall, ako se koriste).
- Repozitorij s `infra/app-vps/provision.sh`, `Caddyfile` i `ctf-backend.service`.
- SSH ključ kojim će GitHub Actions pristupati korisničkom računu `deploy`.

**Backend ne mora biti deployan prije prvog provisioninga.** Skripta omogućuje njegov systemd servis, a pokreće ga kada postoji `dist/main.js`. Isto vrijedi za frontend: Caddy konfiguracija može postojati prije prve objave `dist/index.html`.

## Prva instalacija VPS-a

1. Klonirati repozitorij na VPS.
2. Na lokalnom računalu generirati SSH ključ za GitHub Actions i prenijeti **javni** dio na VPS:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/ulovko_actions -N ''
   scp ~/.ssh/ulovko_actions.pub root@VPS_IP:/root/ulovko_actions.pub
   ```

3. Na VPS-u, iz korijena repozitorija, pokrenuti provisioning:

   ```bash
   sudo bash infra/app-vps/provision.sh --deploy-key /root/ulovko_actions.pub
   ```

4. U GitHub Actions secrets postaviti podatke za **oba** deploy workflowa:

   - `DEPLOY_HOST` — IP adresa ili hostname VPS-a.
   - `DEPLOY_SSH_KEY` — sadržaj **privatnog** ključa `~/.ssh/ulovko_actions`.
   - `DEPLOY_KNOWN_HOSTS` — provjereni zapis javnog SSH host ključa VPS-a.

   Workflows koriste GitHub environment `production`; secrets moraju biti dostupni workflowima u tom environmentu (ili kao repository secrets). Ako je backend deployment već konfiguriran, postojeći ključ i secrets mogu se ponovno koristiti za frontend.

5. Nakon uspješnog provisioninga objaviti aplikacije putem njihovih GitHub Actions workflowa (push promjena u `backend/**` i `frontend/**` na `main`, odnosno odgovarajući novi commit koji pokreće deploy).

### Što radi `provision.sh`

Skripta instalira Node.js 22, Caddy, PostgreSQL, Git, rsync, SSH i ostale potrebne pakete te:

- stvara korisnika `ctfapi` za pokretanje backenda i korisnika `deploy` za SSH/rsync;
- priprema lokalnu PostgreSQL bazu `ulovko` s odvojenim korisnicima `ulovko_app` i `ulovko_migrator`;
- priprema `/opt/ctf/backend` i `/opt/ctf/frontend/dist` za prijenos putem korisnika `deploy`;
- instalira i omogućuje `ctf-backend.service` iz repozitorija;
- dopušta korisniku `deploy` samo potrebne `sudo systemctl restart/is-active ctf-backend.service` naredbe;
- postavlja zajednički Caddyfile za **obje** domene i pokreće/ponovno učitava Caddy;
- po potrebi dodaje zadani javni SSH ključ korisniku `deploy`;
- dopušta HTTP i HTTPS kroz UFW ako je UFW dostupan.

Prije prve zamjene postojećeg `/etc/caddy/Caddyfile` stvara se sigurnosna kopija `/etc/caddy/Caddyfile.pre-ulovko` (ako takva kopija još ne postoji).

## CI/CD — backend

Datoteke: `.github/workflows/backend-ci.yml` i `.github/workflows/backend-deploy.yml`.

- Na promjene u `backend/**` ili `db/**` CI instalira ovisnosti (`npm ci`), pokreće Vitest testove i izrađuje NestJS build. Provjere se pokreću na PR-ovima i pushu na `main`.
- Nakon uspješnog CI-ja, push u `main` s promjenom u `backend/**` ili `db/**` poziva backend deploy workflow.
- Deploy prvo provjeri i primijeni promjene sheme preko SSH tunela (Drizzle Kit), zatim ponovno izgrađuje backend i šalje `backend/dist/`, `package.json` i `package-lock.json` u `/opt/ctf/backend`, zatim na VPS-u pokreće `npm ci --omit=dev`.
- Na kraju pokreće `sudo systemctl restart ctf-backend.service` i provjerava da je servis aktivan.

Backend se izvršava pod korisnikom `ctfapi`, a Caddy prosljeđuje zahtjeve s `https://ulovko.fun/api` na `127.0.0.1:3000`. Backendov `dist/` **nije** direktorij iz kojeg Caddy poslužuje statički frontend.

Za Google prijavu backend deploy dodatno koristi repository variables `GOOGLE_CLIENT_ID` i `GOOGLE_CALLBACK_URL` (`https://ulovko.fun/api/auth/google/callback`) te repository secrets `GOOGLE_CLIENT_SECRET` i `SESSION_SECRET` (npr. generirati s `openssl rand -hex 32`). Istu povratnu adresu potrebno je registrirati u Google Cloud OAuth postavkama. Prijava koristi session cookie; trenutačni in-memory session store gubi sesije nakon ponovnog pokretanja backenda.

### Baza podataka (Drizzle)

`db/schema.ts` je izvor sheme, a backend koristi Drizzle ORM. Provisioning ne postavlja lozinke PostgreSQL korisnika: nakon prve instalacije postaviti ih interaktivno naredbom `sudo -u postgres psql` (`\password ulovko_app`, `\password ulovko_migrator`). PostgreSQL ostaje dostupan lokalno; port 5432 ne treba otvarati prema internetu.

U GitHub Actions repository secrets postaviti `DB_APP_URL` (korisnik `ulovko_app`, `127.0.0.1:5432`) i `DB_MIGRATION_URL` (korisnik `ulovko_migrator`, `127.0.0.1:15432` preko SSH tunela). Deploy workflow sastavlja backend `.env` iz zasebnih secrets/variables; `APP_ENV` nije potreban. Backend CI provjerava `db/**` promjene na testnoj PostgreSQL bazi, a CD prije objave poziva `drizzle-kit push`. Prije rizičnih promjena baze napraviti backup i pregledati ispis predviđenog SQL-a; `--force` se ne koristi.

## CI/CD — frontend

Datoteke: `.github/workflows/frontend-ci.yml` i `.github/workflows/frontend-deploy.yml`.

- Na promjene u `frontend/**` CI postavlja Node.js 22, pokreće `npm ci`, `npm run typecheck`, `npm run lint` i `npm run build`. Provjere se pokreću na PR-ovima i pushu na `main`.
- Nakon uspješnog CI-ja, push u `main` s promjenom u `frontend/**` poziva frontend deploy workflow.
- Deploy ponovno izrađuje frontend i prenosi **samo** `frontend/dist/` u `/opt/ctf/frontend/dist/` koristeći `rsync --delete`.
- Nema instalacije Node.js paketa na VPS-u ni restarta servisa; Caddy poslužuje nove datoteke čim su prenesene.

Frontend koristi relativni API put `/api` i Vite razvojni proxy, pa lokalno i u produkciji šalje zahtjeve na isti origin. Trenutačna mock implementacija natjecanja ne zahtijeva API komunikaciju.

Frontend i API koriste isti origin (`ulovko.fun`), pa CORS za njihovu međusobnu komunikaciju nije potreban. Za kolačiće sesije i dalje treba odgovarajuća konfiguracija i CSRF zaštita.

## Ažuriranje postojećeg VPS-a

Za promjene u `infra/app-vps/` (primjerice novi Caddyfile ili izmjene systemd konfiguracije) ažurirati checkout na VPS-u i ponovno pokrenuti:

```bash
sudo bash infra/app-vps/provision.sh
```

Skripta je predviđena za ponovno pokretanje. Ako `deploy` već ima autorizirani ključ, `--deploy-key` nije potreban. **GitHub Actions deploy workflowi za backend i frontend ne primjenjuju automatski infrastrukturne izmjene** — nakon promjene Caddyfilea ili provisioninga potrebna je ova naredba.

Za promjene samo u aplikacijskom kodu dovoljan je uobičajeni CI/CD odgovarajuće aplikacije.

## Provjera i otklanjanje problema

```bash
# Servisi i konfiguracija
sudo systemctl status ctf-backend caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo journalctl -u ctf-backend -n 50 --no-pager
sudo journalctl -u caddy -n 50 --no-pager

# Preneseni buildovi
ls -l /opt/ctf/backend/dist/main.js
ls -l /opt/ctf/frontend/dist/index.html

# Javne adrese
curl -i https://ulovko.fun/api
curl -I https://ulovko.fun/
curl -I https://ulovko.fun/competitions
curl -I https://ulovko.fun/api
```

- `ulovko.fun/api` prosljeđuje se NestJS-u; konačni HTTP status ovisi o tome postoji li na backendu ruta `/api`. Odgovor 502 obično znači da backend nije dostupan na `127.0.0.1:3000`.
- `ulovko.fun/competitions` treba dobiti SPA `index.html`, koji potom obrađuje TanStack Router.
- `api.ulovko.fun` preusmjerava se na `ulovko.fun`; nije zaseban API origin.
- Nepostojeće datoteke pod `/assets/*` vraćaju 404 umjesto HTML-a aplikacije.
- Ako frontend još nije deployan, početna stranica neće biti dostupna dok ne postoji `dist/index.html`.

Skripta ne postavlja DNS, GitHub Actions secrets ni vanjski firewall pružatelja usluge. PostgreSQL lozinke i sigurnosne kopije konfiguriraju se zasebno; ostali aplikacijski servisi nisu obuhvaćeni.
