# A. Pregled aktivnosti grupe

## A.1 Evidencija sastanaka

> Članovi tima:  
GI = Goran Ivančić; 
BM = Borna Mišetić; 
IV = Ivona Herout; 
DL = Dora Lendvaj; 
LH = Luka Horvatić; 
RP = Roko Perković; 
GV = Goran Vukmanović

| Datum i sudionici | Glavna tema | Donesena odluka ili zadatak  | Poveznica na zadatak ili  rezultat, ako postoji |
| --- | --- | --- | --- |
| 19.10.2026, svi | Podjela posla | Odlučeno ime i tko radi koji dio zadatka | [README-u — Članovi tima](../README.md#team-members) | 
| 26.10.2026, svi | Pregled zahtjeva i arhitekture | Razmotreni glavni korisnički scenariji, funkcionalni zahtjevi i podjela sustava na backend, frontend, bazu podataka i infrastrukturu | [Analiza zahtjeva](2-Analiza-zahtjeva.md), [Arhitektura](4-Arhitektura-i-oblikovanje.md) |
| 29.10.2026, GI, BM, DL, GV | Tehnička koordinacija backenda i infrastrukture | Dogovoriti način povezivanja API-ja, baze podataka, objektne pohrane i infrastrukture za pokretanje zadataka | [Arhitektura i oblikovanje](4-Arhitektura-i-oblikovanje.md) |
| 29.10.2026, LH, RP | Dizajn korisničkog sučelja | Uskladiti prikaz natjecanja, zadataka i organizacijskog sučelja s planiranim funkcionalnostima aplikacije | [Figma prototip ](https://www.figma.com/design/ubGWgXKZ0uyvmXWl6UKQwf/Ulovko-frontend?node-id=0-1&t=UrAUsCsYQEoU3rNZ-1) |
| 12.11.2026, svi | Pregled napretka i daljnji zadaci | Pregledati dovršene dijelove, uočene probleme i ovisnosti među podsustavima te raspodijeliti zadatke za sljedeću iteraciju | [GitHub Issues](https://github.com/goranovi-pijuni/ulovko/issues) |


## A.2 Plan rada

| Razdoblje/Tjedan | Glavni planirani rad | Odgovorni članovi | Poveznica na zadatke |
| --- | --- | --- | --- |
| 3. tjedan | HTTP tunel na k3s instanci | GI |  |
| 3. tjedan | Figma dizajn stranice | LH, RP |  |
| 3. tjedan | Relacijski model | BM |  | 
| 4. tjedan | Implementacija autentikacije, korisničkih profila i sustava ovlasti | IV | [Backend](../backend/) |
| 4. tjedan | Implementacija upravljanja natjecanjima i učitavanja CTF zadataka | DL | [Backend](../backend/) |
| 4. tjedan | Razvoj Challenge Runnera za izgradnju i pokretanje kontejneriziranih zadataka | GI | [Runner](../runner/), [Infrastruktura](../infra/) |
| 5. tjedan | Implementacija bodovanja, rasporeda objave zadataka i Discord integracije | GV | [Backend](../backend/) |
| 5. tjedan | Razvoj natjecateljskog sučelja | LH | [Frontend](../frontend/) |
| 6. tjedan | Razvoj organizacijskog i administracijskog sučelja | RP | [Frontend](../frontend/) |
| 6. thedan | Integracija podsustava, ispitivanje funkcionalnosti i ispravak uočenih pogrešaka | Svi | [Ispitivanje](5-Ispitivanje.md), [GitHub Issues](https://github.com/goranovi-pijuni/ulovko/issues) |


## A.3 Aktivnosti i doprinosi članova

| Aktivnost ili rezultat | Član | Prijavljeni sati | Reprezentativni rezultat ili poveznica |
| --- | --- | --- | --- |
| Postavljanje infrastrukture, mrežne dostupnosti i razvoj Challenge Runnera | GI | 20h | [Runner](../runner/), [Infrastruktura](../infra/) |
| Oblikovanje relacijskog modela, rad s bazom podataka i objektnom pohranom | BM | 14h | [DB](../db/), [Backend](../backend/) |
| Implementacija korisničkih računa, autentikacije i sustava ovlasti | IV | 12h | [Backend](../backend/) |
| Implementacija backend funkcionalnosti za natjecanja i zadatke, uključujući obradu ZIP paketa | DL | 12h | [Backend](../backend/) |
| Dizajn i razvoj korisničkog sučelja za natjecatelje | LH | 14h | [Frontend](../frontend/) |
| Dizajn i razvoj organizacijskog i administracijskog sučelja | RP | 13h | [Frontend](../frontend/) |
| Implementacija bodovanja, rasporeda objave zadataka i Discord integracije | GV | 12h | [Backend](../backend/) |

(Prijavljeni sati predstavljaju retrospektivnu procjenu.)

## A.4 Pregled promjena u repozitoriju

- [GitHub repozitorij – Ulovko](https://github.com/goranovi-pijuni/ulovko)
- [GitHub Contributors](https://github.com/goranovi-pijuni/ulovko/graphs/contributors)
- [GitHub Activity](https://github.com/goranovi-pijuni/ulovko/activity)
- [GitHub Issues](https://github.com/goranovi-pijuni/ulovko/issues)



## A.5 Ključni inženjerski izazovi i rješenja


| Izazov | Poduzeta radnja | Ishod ili preostalo ograničenje |
| --- | --- | --- |
| Organizacija pokretanja mrežnih servisa za CTF zadatke | Postavljena je demonstracijska infrastruktura temeljena na K3s-u, s demonstracijskim HTTP i TCP servisima | Osnovna infrastruktura je postavljena, potrebno je dovršiti automatizirano pokretanje servisa iz paketa zadatka |
| Razdvajanje javnih datoteka zadatka od datoteka potrebnih za izvođenje | Definirana je struktura ZIP paketa s `config.yaml`, `public/` i `deploy/` direktorijima | Potrebno je osigurati validaciju strukture arhive i kontrolu pristupa privatnim datotekama |
| Usklađivanje podatkovnog modela s funkcionalnostima aplikacije | Definiran je relacijski model za korisnike, timove, natjecanja, zadatke i rješenja | Model je potrebno prilagođavati tijekom implementacije i integracije pojedinih modula |
| Automatska objava zadataka prema rasporedu | Predviđena je funkcionalnost rasporeda početka i završetka natjecanja te objave zadataka; otvoren je zadatak za scheduler | Potrebno je dovršiti implementaciju i ispitati ponašanje u različitim vremenskim uvjetima |
| Integracija zasebnih dijelova sustava | Razvoj je podijeljen na backend, frontend, bazu podataka i infrastrukturu | Potrebno je uskladiti API sučelja i podatkovne strukture te provesti integracijska ispitivanja |
| Pouzdana pohrana ZIP paketa zadataka | Predviđena je uporaba Cloudflare R2 objektne pohrane za datoteke zadataka | Potrebno je dovršiti povezivanje metapodataka zadatka s lokacijom pohranjenih datoteka i provjeriti postupak čišćenja nakon neuspjelog uploada |



---
