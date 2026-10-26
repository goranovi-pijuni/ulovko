# Ulovko — platforma za CTF natjecanja

> **Status:** Projekt je u fazi početnog razvoja. Osnovni backend i infrastruktura već su postavljeni, dok su glavne funkcionalnosti platforme još u razvoju.

Ulovko je web platforma za organizaciju i sudjelovanje u CTF natjecanjima, s naglaskom na automatizirano postavljanje zadataka koji zahtijevaju vlastite mrežne servise.

**Projekt na kolegiju:** Aplikaciju razvija studentski tim u sklopu kolegija [Programsko inženjerstvo](https://www.fer.unizg.hr/predmet/proinz) na Fakultetu elektrotehnike i računarstva Sveučilišta u Zagrebu.

## Opis aplikacije

Capture the Flag (CTF) natjecanja sastoje se od zadataka iz računalne sigurnosti, primjerice kriptografije, web sigurnosti, digitalne forenzike i obrnutog inženjerstva. Natjecatelji rješavanjem zadataka pronalaze zastavice (*flags*) te njihovom predajom osvajaju bodove. Osim samog sustava za prijave i bodovanje, organizatori često moraju pripremiti mrežne servise na kojima se pojedini zadaci izvršavaju.

Cilj Ulovka je objediniti te poslove. Organizator unaprijed priprema natjecanje i učitava zadatke, a platforma upravlja objavom sadržaja, rezultatima i, za kontejnerizirane zadatke, pokretanjem pripadajućih servisa.

**Planirane ključne funkcionalnosti:**

- Prijava vanjskim pružateljem identiteta te odvojene ovlasti natjecatelja, organizatora i administratora.
- Natjecanja s vlastitim timovima, rasporedom objave zadataka, predajom zastavica, statičkim ili dinamičkim bodovanjem i ljestvicom rezultata.
- Učitavanje ZIP paketa zadatka (`config.yaml`, `public/`, `deploy/`), uz odvajanje datoteka namijenjenih natjecateljima od datoteka za izvođenje.
- *Challenge Runner* za pokretanje kontejneriziranih HTTP i TCP servisa, dodjelu javnih adresa i portova te nadzor njihova rada.
- Povijest sudjelovanja i osnovna statistika te obavijesti putem Discorda.

Ovo je **planirani opseg**, a ne popis već implementiranih funkcionalnosti. Detalji su u [opsegu projekta](docs/1-Projekt.md) i [analizi zahtjeva](docs/2-Analiza-zahtjeva.md). Ostala projektna dokumentacija nalazi se u direktoriju [docs](docs/Home.md).

<a id="deployment"></a>
## Postavljanje (deployment)

**Javno dostupna aplikacija:** Backend API dostupan je na [api.ulovko.fun/api](https://api.ulovko.fun/api). Frontend još nije postavljen.

Infrastruktura je podijeljena na dva VPS poslužitelja:

- **App VPS:** NestJS backend pokrenut kao systemd servis, uz Caddy za HTTPS i reverse proxy.
- **Runner VPS:** K3s klaster za izvođenje kontejneriziranih CTF zadataka. Trenutačno su postavljeni demonstracijski HTTP i TCP servisi.

Konfiguracija i upute za postavljanje nalaze se u [infra/app-vps](infra/app-vps/README.md) i [infra/runner-vps](infra/runner-vps/README.md).

<a id="quick-start"></a>
## Brzi početak / instalacija

### Lokalni razvoj

Za lokalno pokretanje backenda potrebni su Node.js 22 i npm.

```bash
cd backend
npm ci
npm run start:dev
```

Backend se pokreće na `http://localhost:3000`. Trenutačno nije potrebna dodatna `.env` datoteka.

Za pokretanje testova i provjeru izgradnje:

```bash
npx vitest run
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

Backend koristi GitHub Actions za automatsko testiranje i objavu promjena na `main` grani. Infrastruktura runner VPS-a provjerava se zasebnim CI postupkom.

## Tehnologije

| Tehnologija ili usluga | Uloga | Status ili razlog odabira |
| --- | --- | --- |
| NestJS / Node.js | Backend aplikacija i REST API | U uporabi, strukturirani razvoj backenda |
| Caddy / systemd | HTTPS, reverse proxy i upravljanje backend servisom | U uporabi na aplikacijskom VPS-u |
| GitHub Actions | Automatsko testiranje i deployment | U uporabi za CI/CD |
| PostgreSQL | Relacijski podaci o korisnicima, timovima, natjecanjima i rješenjima | Planirano, integritet podataka i upiti za rezultate |
| Cloudflare R2 bucket storage | ZIP arhive zadataka i javni prilozi | Planirano, odvajanje datoteka od relacijske baze |
| Docker i K3s | Izgradnja i pokretanje kontejneriziranih zadataka | K3s demonstracijska infrastruktura postavljena |
| OpenID Connect / OAuth 2.0 | Prijava vanjskim identitetom | Konkretan pružatelj identiteta bit će dogovoren |
| Discord webhooks | Obavijesti o događajima u natjecanju | Planirano |

Frontend tehnologije bit će navedene nakon dogovora i prvog prototipa.

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

Posao se prati kroz GitHub Issues i pull requestove. Promjene na glavnoj grani (`main`) podliježu automatskim provjerama putem GitHub Actions, a objava backenda automatizirana je nakon uspješnih provjera.

Prije daljnjeg paralelnog razvoja dogovorit će se API sučelja, pravila za promjene sheme baze i način pregledavanja promjena. Evidencija zadataka i doprinosa članova ažurirat će se tijekom razvoja.

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
