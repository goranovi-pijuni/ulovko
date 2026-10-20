# Ulovko — platforma za CTF natjecanja

> **Status:** Projekt je u fazi planiranja i početnog razvoja.

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

**Javno dostupna aplikacija:** Još nije postavljena. Adresa će biti dodana nakon prvog javnog postavljanja.

<a id="quick-start"></a>
## Brzi početak / instalacija

Postupak instalacije još nije definiran jer tehnološki odabir i povezivanje početnih komponenti nisu dovršeni. Ovdje će se nakon prvog funkcionalnog prototipa nalaziti **provjerene** naredbe za pokretanje iz čistog klona repozitorija, zajedno s primjerom konfiguracije bez tajnih podataka.

## Tehnologije

| Tehnologija ili usluga | Predviđena uloga | Razlog ili otvoreno pitanje |
| --- | --- | --- |
| PostgreSQL | Relacijski podaci o korisnicima, timovima, natjecanjima i rješenjima | Tim poznaje PostgreSQL, važni su integritet podataka i upiti za rezultate. |
| Cloudflare R2 bucket storage | ZIP arhive zadataka i javni prilozi | Datoteke je lakše spremati kroz ovakvu tehnologiju nego direktno u bazu. |
| Docker i K3s | Izgradnja i pokretanje kontejneriziranih zadataka | Cilj je koristiti postojeću orkestraciju. |
| OpenID Connect / OAuth 2.0 | Prijava vanjskim identitetom | Konkretan pružatelj identiteta bit će dogovoren. |
| Discord webhooks | Obavijesti o događajima u natjecanju | Domenski relevantna vanjska integracija. |

Frontend i backend tehnologije bit će navedene nakon dogovora i prvog prototipa.

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

Plan je pratiti posao kroz GitHub Issues i pull requestove. Prije paralelnog razvoja dogovorit će se API sučelja, pravila za promjene sheme baze i način pregledavanja promjena. Evidencija zadataka i doprinosa članova ažurirat će se tijekom razvoja.

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
