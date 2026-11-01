# Ulovko — aplikacijski VPS

Konfiguracija zajedničkog Debian/Ubuntu VPS-a za **NestJS backend i React/Vite frontend**. Obje aplikacije koriste isti Caddy i isti korisnički račun za GitHub Actions deployment, ali se izgrađuju i deployaju neovisno.

## Arhitektura

| Komponenta | Javna adresa | Način izvođenja | Lokacija na VPS-u |
| --- | --- | --- | --- |
| Backend (NestJS) | `https://api.ulovko.fun/api` | Node.js 22, `ctf-backend.service`, port `127.0.0.1:3000` | `/opt/ctf/backend` |
| Frontend (React/Vite SPA) | `https://ulovko.fun` | Statičke datoteke koje poslužuje Caddy | `/opt/ctf/frontend/dist` |
| Reverse proxy i HTTPS | Obje domene | Caddy (automatski TLS) | `/etc/caddy/Caddyfile` |

Caddy prosljeđuje `/api` zahtjeve s **`api.ulovko.fun`** backendu bez uklanjanja prefiksa `/api`. Na **`ulovko.fun`** poslužuje frontend i vraća `index.html` za klijentske rute (TanStack Router). Na frontend domeni **nema** `/api` proxyja.

Backend zahtijeva aktivan Node.js proces, a frontend ne: Vite se izgrađuje u GitHub Actions, a na VPS se prenose samo datoteke iz `dist/`. Za frontend nisu potrebni pnpm na VPS-u, Docker ni zaseban systemd servis.

## Preduvjeti

- Debian/Ubuntu VPS sa systemdom i root pristupom.
- DNS zapisi `api.ulovko.fun` i `ulovko.fun` koji upućuju na taj VPS. Provjeriti i AAAA zapise ako postoje.
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

Skripta instalira Node.js 22, Caddy, Git, rsync, SSH i ostale potrebne pakete te:

- stvara korisnika `ctfapi` za pokretanje backenda i korisnika `deploy` za SSH/rsync;
- priprema `/opt/ctf/backend` i `/opt/ctf/frontend/dist` za prijenos putem korisnika `deploy`;
- instalira i omogućuje `ctf-backend.service` iz repozitorija;
- dopušta korisniku `deploy` samo potrebne `sudo systemctl restart/is-active ctf-backend.service` naredbe;
- postavlja zajednički Caddyfile za **obje** domene i pokreće/ponovno učitava Caddy;
- po potrebi dodaje zadani javni SSH ključ korisniku `deploy`;
- dopušta HTTP i HTTPS kroz UFW ako je UFW dostupan.

Prije prve zamjene postojećeg `/etc/caddy/Caddyfile` stvara se sigurnosna kopija `/etc/caddy/Caddyfile.pre-ulovko` (ako takva kopija još ne postoji).

## CI/CD — backend

Datoteke: `.github/workflows/backend-ci.yml` i `.github/workflows/backend-deploy.yml`.

- Na promjene u `backend/**` CI instalira ovisnosti (`npm ci`), pokreće Vitest testove i izrađuje NestJS build. Provjere se pokreću na PR-ovima i pushu na `main`.
- Nakon uspješnog CI-ja, push u `main` s promjenom u `backend/**` poziva backend deploy workflow.
- Deploy ponovno izgrađuje backend, šalje `backend/dist/`, `package.json` i `package-lock.json` u `/opt/ctf/backend`, zatim na VPS-u pokreće `npm ci --omit=dev`.
- Na kraju pokreće `sudo systemctl restart ctf-backend.service` i provjerava da je servis aktivan.

Backend se izvršava pod korisnikom `ctfapi`, a Caddy prosljeđuje zahtjeve s `https://api.ulovko.fun/api` na `127.0.0.1:3000`. Backendov `dist/` **nije** direktorij iz kojeg Caddy poslužuje statički frontend.

## CI/CD — frontend

Datoteke: `.github/workflows/frontend-ci.yml` i `.github/workflows/frontend-deploy.yml`.

- Na promjene u `frontend/**` CI postavlja Node.js 22 i verziju pnpm-a iz `frontend/package.json`, pokreće `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint` i `pnpm build`. Provjere se pokreću na PR-ovima i pushu na `main`.
- Nakon uspješnog CI-ja, push u `main` s promjenom u `frontend/**` poziva frontend deploy workflow.
- Deploy ponovno izrađuje frontend i prenosi **samo** `frontend/dist/` u `/opt/ctf/frontend/dist/` koristeći `rsync --delete`.
- Nema instalacije Node.js paketa na VPS-u ni restarta servisa; Caddy poslužuje nove datoteke čim su prenesene.

Viteova produkcijska konfiguracija `frontend/.env.production` sadrži `VITE_API_ORIGIN=https://api.ulovko.fun`. Kada se API klijent poveže s backendom, zahtjevi trebaju ići na `https://api.ulovko.fun/api/...`, uz samo jedan `/api` prefiks. Trenutačna mock implementacija natjecanja ne zahtijeva API komunikaciju.

Budući da su `ulovko.fun` i `api.ulovko.fun` različiti originovi, prije stvarne integracije potrebno je na NestJS backendu dopustiti CORS za `https://ulovko.fun`. Ako autentikacija koristi kolačiće, potrebna je i odgovarajuća konfiguracija credentials/CSRF zaštite. Provisioning ne mijenja aplikacijski kod ni CORS postavke.

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
curl -i https://api.ulovko.fun/api
curl -I https://ulovko.fun/
curl -I https://ulovko.fun/competitions
curl -I https://ulovko.fun/api
```

- `api.ulovko.fun/api` prosljeđuje se NestJS-u; konačni HTTP status ovisi o tome postoji li na backendu ruta `/api`. Odgovor 502 obično znači da backend nije dostupan na `127.0.0.1:3000`.
- `ulovko.fun/competitions` treba dobiti SPA `index.html`, koji potom obrađuje TanStack Router.
- `ulovko.fun/api` namjerno vraća 404; ne prosljeđuje se na backend.
- Nepostojeće datoteke pod `/assets/*` vraćaju 404 umjesto HTML-a aplikacije.
- Ako frontend još nije deployan, početna stranica neće biti dostupna dok ne postoji `dist/index.html`.

Skripta ne postavlja DNS, GitHub Actions secrets ni vanjski firewall pružatelja usluge. Ne konfigurira bazu podataka ni druge aplikacijske servise izvan navedenog backenda i statičkog frontenda.
