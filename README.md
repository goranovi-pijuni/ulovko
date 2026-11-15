# Ulovko — platforma za CTF natjecanja

> **Aplikacija:** [ulovko.fun](https://ulovko.fun) · **API dokumentacija:** [Swagger](https://ulovko.fun/api/docs)

Ulovko je web platforma za organizaciju i sudjelovanje u CTF natjecanjima, s naglaskom na automatizirano postavljanje zadataka koji zahtijevaju vlastite mrežne servise.

**Projekt na kolegiju:** Aplikaciju razvija studentski tim u sklopu kolegija [Programsko inženjerstvo](https://www.fer.unizg.hr/predmet/proinz) na Fakultetu elektrotehnike i računarstva Sveučilišta u Zagrebu.

## Opis aplikacije

Capture the Flag (CTF) natjecanja sastoje se od zadataka iz računalne sigurnosti, primjerice kriptografije, web sigurnosti, digitalne forenzike i obrnutog inženjerstva. Natjecatelji rješavanjem zadataka pronalaze zastavice (*flags*) te njihovom predajom osvajaju bodove. Osim samog sustava za prijave i bodovanje, organizatori često moraju pripremiti mrežne servise na kojima se pojedini zadaci izvršavaju.

Cilj Ulovka je objediniti te poslove. Organizator unaprijed priprema natjecanje i učitava zadatke, a platforma upravlja objavom sadržaja, rezultatima i, za kontejnerizirane zadatke, pokretanjem pripadajućih servisa.

**Ključne funkcionalnosti platforme:**

- Prijava vanjskim pružateljem identiteta te odvojene ovlasti natjecatelja, organizatora i administratora.
- Natjecanja s vlastitim timovima, rasporedom objave zadataka, predajom zastavica, statičkim ili dinamičkim bodovanjem i ljestvicom rezultata.
- Učitavanje ZIP paketa zadatka (`config.yaml`, `public/`, `deploy/`), uz odvajanje datoteka namijenjenih natjecateljima od datoteka za izvođenje.
- *Challenge Runner* za pokretanje kontejneriziranih HTTP i TCP servisa, dodjelu javnih adresa i portova te nadzor njihova rada.
- Povijest sudjelovanja i osnovna statistika te obavijesti putem Discorda.

Opseg i zahtjevi opisani su u [opsegu projekta](docs/1-Projekt.md) i [analizi zahtjeva](docs/2-Analiza-zahtjeva.md). Ostala projektna dokumentacija nalazi se u direktoriju [docs](docs/Home.md).

<a id="deployment"></a>
## Postavljanje (deployment)

**Javno dostupna aplikacija:** [ulovko.fun](https://ulovko.fun) · **Backend API:** [ulovko.fun/api](https://ulovko.fun/api) · **Swagger:** [ulovko.fun/api/docs](https://ulovko.fun/api/docs).

Infrastruktura je podijeljena na dva VPS poslužitelja:

- **App VPS:** React/Vite frontend koji poslužuje Caddy, NestJS backend kao systemd servis, PostgreSQL baza podataka te HTTPS i reverse proxy.
- **Runner VPS:** Challenge Runner i K3s za izgradnju, pokretanje i mrežno izlaganje kontejneriziranih CTF zadataka.

Konfiguracija i upute za postavljanje nalaze se u [infra/app-vps](infra/app-vps/README.md) i [infra/runner-vps](infra/runner-vps/README.md).

<a id="quick-start"></a>
## Brzi početak / instalacija

### Lokalni razvoj

Za lokalni razvoj potrebni su Node.js 22, npm i PostgreSQL. Backend učitava konfiguraciju iz `backend/.env`: za rad su potrebni podaci za bazu (`DATABASE_URL`) i sesije (`SESSION_SECRET`), a za Google prijavu odgovarajući `GOOGLE_CLIENT_*` i `GOOGLE_CALLBACK_URL`. Funkcionalnosti pohrane i izvođenja zadataka dodatno koriste R2 i Runner postavke; produkcijska konfiguracija opisana je u [uputama za aplikacijski VPS](infra/app-vps/README.md).

Backend:

```bash
cd backend
npm ci
npm run start:dev
```

Frontend (u drugom terminalu):

```bash
cd frontend
npm ci
npm run dev
```

Backend sluša na `http://localhost:3000`, a frontend na `http://localhost:5173`. Vite prosljeđuje pozive na `/api` lokalnom backendu. Dokumentacija API-ja dostupna je na `http://localhost:3000/api/docs`.

Provjera aplikacije:

```bash
# iz direktorija backend/
npm test
npm run lint
npm run build

# iz direktorija frontend/
npm run typecheck
npm run lint
npm run build
```

### Postavljanje na VPS

Postavljanje infrastrukture automatizirano je pomoću skripti za inicijalno konfiguriranje poslužitelja:

```bash
# App VPS
sudo bash infra/app-vps/provision.sh --deploy-key /putanja/do/javnog-kljuca.pub

# Runner VPS
sudo bash infra/runner-vps/provision.sh
```

Skripte se pokreću na odgovarajućim VPS poslužiteljima, iz korijenskog direktorija kloniranog repozitorija.

Detaljni preduvjeti, konfiguracija SSH ključeva, DNS-a i GitHub Actions nalaze se u pripadajućoj dokumentaciji:

- [App VPS — instalacija i deployment](infra/app-vps/README.md)
- [Runner VPS — instalacija i provjera K3s klastera](infra/runner-vps/README.md)

GitHub Actions provjerava promjene kroz pull requestove te nakon spajanja u `main` objavljuje frontend, backend i runner odgovarajućim postupcima.

## Tehnologije

| Tehnologija ili usluga | Uloga |
| --- | --- |
| React, TypeScript, Vite | Frontend aplikacija |
| TanStack Router, TanStack Query, Tailwind CSS | Navigacija, komunikacija s API-jem i stilovi |
| NestJS / Node.js | Backend aplikacija i REST API |
| Swagger / OpenAPI, Orval | Dokumentacija API-ja i generiranje frontend klijenta |
| PostgreSQL, Drizzle ORM | Relacijski podaci o korisnicima, timovima, natjecanjima i rješenjima |
| Cloudflare R2 | Pohrana ZIP arhiva i datoteka zadataka |
| BuildKit, K3s | Izgradnja i izvođenje kontejneriziranih zadataka |
| Google OAuth 2.0 | Prijava korisnika putem vanjskog identiteta |
| Caddy, systemd | HTTPS, usmjeravanje i upravljanje servisima |
| GitHub Actions | CI/CD |
| Discord webhooks | Obavijesti o događajima u natjecanju (planirano) |

<a id="team-members"></a>
## Članovi tima

| Član | Predloženo područje odgovornosti |
| --- | --- |
| Goran Ivančić | Infrastruktura i Challenge Runner |
| Borna Mišetić | Baza podataka, SQL i objektna pohrana |
| Ivona Herout | Backend: korisnici, ovlasti i timovi |
| Dora Lendvaj | Backend: natjecanja i zadaci |
| Luka Horvatić | Frontend: natjecateljsko sučelje |
| Roko Perković | Frontend: organizacijsko i administracijsko sučelje |
| Goran Vukmanović | Backend: bodovanje, raspored i Discord integracija |

## Doprinos projektu

Posao se prati kroz GitHub Issues i pull requestove. Promjene se razvijaju na zasebnim granama i spajaju u zaštićenu granu `main` nakon provjera. GitHub Actions provodi CI/CD, a API ugovori dokumentiraju se putem OpenAPI-ja. Evidencija zadataka i doprinosa članova ažurira se tijekom razvoja.

<a id="license"></a>
## Licenca

Izvorni programski kod projekta Ulovko dostupan je pod [MIT licencom](LICENSE).

Dokumentacijski predložak kolegija Programsko inženjerstvo autora Vlade Sruka i njegovi prilagođeni dijelovi koriste se pod licencom [CC BY-NC-SA 4.0](docs/LICENSE).

Licence platforme ne obuhvaćaju automatski sadržaj CTF zadataka koje učitavaju organizatori.

<a id="ai-usage"></a>
## Uporaba umjetne inteligencije

Projekt slijedi FER-ova [pravila o primjerenoj uporabi umjetne inteligencije](https://www.fer.unizg.hr/_download/repository/Policy%20on%20the%20appropriate%20use%20of%20artificial%20intelligence%20at%20the%20faculty%20of%20electrical%20engineering%20and%20computing%5B1%5D.pdf).

<a id="code-of-conduct-and-support"></a>
## Kodeks ponašanja

Članovi tima pridržavaju se pravila kolegija, FER-ova kodeksa ponašanja i [Etičkog kodeksa IEEE-a](https://www.ieee.org/about/corporate/governance/p7-8.html). Za pravila suradnje pogledajte [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), uz prethodnu provjeru i prilagodbu preuzetog predloška.

---

Struktura dokumentacije prilagođena je predlošku kolegija Programsko inženjerstvo FER-a autora [Vlade Sruka](https://www.fer.unizg.hr/vlado.sruk), licenciranom pod [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Licenca predloška ne određuje automatski licencu studentskog projekta.
