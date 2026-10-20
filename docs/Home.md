# Ulovko — Projektna dokumentacija

**Kolegij:** [Programsko inženjerstvo](https://www.fer.unizg.hr/predmet/proinz), Fakultet elektrotehnike i računarstva Sveučilišta u Zagrebu  
**Akademska godina:** 2026./2027.
**Tim:** Goranovi pijuni (grupa 5.1)
**Nastavnik:** Vlado Sruk
**Asistent / demonstrator:** Lovro Bosnar

## Pregled projekta

Ulovko je planirana web platforma za organizaciju i sudjelovanje u Capture the Flag (CTF) natjecanjima iz računalne sigurnosti. Natjecateljima omogućuje rad u timovima, pristup zadacima, predaju zastavica i praćenje rezultata, dok organizatori mogu unaprijed pripremiti natjecanja, raspored i bodovanje. Poseban dio projekta je *Challenge Runner*, koji bi na temelju konfiguracije zadatka automatski izgradio i pokrenuo potrebne kontejnere te omogućio pristup njihovim HTTP i TCP servisima.

Projekt je u fazi početnog oblikovanja i razvoja. Navedene funkcionalnosti predstavljaju **planirani opseg**, a ne tvrdnju da su već implementirane.

**Aplikacija i lokalno pokretanje:** [README — Brzi početak](../README.md#quick-start)  
**Javno dostupna aplikacija:** [README — Postavljanje](../README.md#deployment) *(javni URL još nije dostupan)*  
**Opseg i zahtjevi:** [Opseg projekta](1-Projekt.md) · [Analiza zahtjeva](2-Analiza-zahtjeva.md)

## Članovi tima i uloge

Projekt razvija sedam članova. Početna podjela obuhvaća infrastrukturu i Challenge Runner, bazu podataka i objektnu pohranu, tri backend cjeline te natjecateljsko i organizacijsko/administracijsko korisničko sučelje.

Imena članova i predložena područja odgovornosti nalaze se u [README-u — Članovi tima](../README.md#team-members). Podjela se može mijenjati tijekom razvoja.

## Kazalo dokumentacije

| Stranica | Sadržaj |
| --- | --- |
| [1. Opseg projekta](1-Projekt.md) | Problem, cilj, korisnici, granice i postojeći pristupi |
| [2. Analiza zahtjeva](2-Analiza-zahtjeva.md) | Funkcijski i nefunkcijski zahtjevi, kriteriji prihvaćanja i ograničenja |
| [3. Obrasci uporabe](3-Obrasci-uporabe.md) | Ključni korisnički scenariji i ponašanje sustava |
| [4. Arhitektura i oblikovanje](4-Arhitektura-i-oblikovanje.md) | Komponente, model podataka, API sučelja, odluke i dijagrami |
| [5. Ispitivanje](5-Ispitivanje.md) | Ispitni slučajevi, provedba, rezultati i poznata ograničenja |
| [6. Postavljanje, instalacija i konfiguracija](6-Postavljanje-instalacija-i-konfiguracija.md) | Lokalno pokretanje, javna infrastruktura i konfiguracija |
| [7. Zaključak i budući rad](7-Zakljucak-i-buduci-rad.md) | Ostvareni rezultati, nedovršeni dijelovi i daljnji razvoj |
| [A. Pregled aktivnosti grupe](A-Pregled-aktivnosti-grupe.md) | Aktivnosti članova, suradnja i doprinosi |

## Ključne točke projekta

| Kontrolna točka | Demonstracija | Video |
| --- | --- | --- |
| Iteracija 1 | *Poveznica će se dodati nakon prve predaje* | *Još nije dostupan* |
| Demo 2 | *Poveznica će se dodati nakon demonstracije* | *Još nije dostupan* |
| Završni pregled | *Poveznica će se dodati nakon završne predaje* | *Još nije dostupan* |

PDF inačice službenih predaja čuvat će se u direktoriju [`deliverables/`](deliverables/).

## Organizacija projekta i razvojni proces

Razvoj je podijeljen prema funkcionalnim cjelinama, uz zajednički dogovor o podatkovnom modelu i API sučeljima. Posebno će se razdvojiti osnovna platforma za natjecanja od Challenge Runnera, tako da razvoj i ispitivanje aplikacije ne ovise o dovršetku kontejnerske infrastrukture.

**Planirani način rada:** GitHub Issues za zadatke i nedostatke, zasebne grane i pull requestovi za promjene te pregled i integracija međusobno ovisnih dijelova. Konkretan ritam sastanaka, pravila pregleda koda i poveznicu na ploču zadataka treba dopuniti kada ih tim dogovori.

**Evidencija aktivnosti:** [Pregled aktivnosti grupe](A-Pregled-aktivnosti-grupe.md).  
**Bilješke sastanaka:** `docs/meeting-notes/`, ako tim odluči voditi ih u repozitoriju.

## Pravila dokumentacije

Dokumentacija se vodi u povezanim Markdown datotekama unutar direktorija `docs/`. UML dijagrami izrađivat će se u PlantUML-u, s izvornim `.puml` datotekama u `docs/puml/` i čitljivim prikazima u `docs/assets/`. Dijagrami trebaju prikazivati dogovoreno ili implementirano ponašanje i arhitekturu, a ne pretpostavljene značajke.

Implementacijski detalji, postupak postavljanja i rezultati ispitivanja upisivat će se kada budu provjereni. Primjeri koji su dio nastavnog predloška ne smatraju se dokumentacijom aplikacije Ulovko.

## Akademski integritet, ponašanje i licenciranje

Za [izjavu o uporabi umjetne inteligencije](../README.md#ai-usage), [kodeks ponašanja](../README.md#code-of-conduct-and-support) i [status licence](../README.md#license) pogledajte README repozitorija. Licenca izvornog nastavnog predloška ne određuje automatski licencu studentskog koda. U dokumentaciju i repozitorij ne smiju se unositi lozinke, pristupni tokeni ili drugi povjerljivi podaci.

## Izjava o uporabi umjetne inteligencije

Ovaj odjeljak bilježi dosadašnju pomoć generativne umjetne inteligencije pri pripremi dokumentacije. Evidenciju treba dopunjavati prema stvarnoj uporabi tijekom razvoja. Projekt slijedi [FER-ova pravila o primjerenoj uporabi umjetne inteligencije](https://www.fer.unizg.hr/_download/repository/Policy%20on%20the%20appropriate%20use%20of%20artificial%20intelligence%20at%20the%20faculty%20of%20electrical%20engineering%20and%20computing%5B1%5D.pdf).

### Korišteni alati

| Alat | Model | Koristio/la | Namjena |
| --- | --- | --- | --- |
| | | | |

### Opseg doprinosa umjetne inteligencije

| Datoteka | Vrsta pomoći i rezultat | Ulaz i odluke tima | Provjera |
| --- | --- | --- | --- |
| | | |

### Provjera generiranog sadržaja

| Provjera | Trenutačno stanje | Što još treba napraviti |
| --- | --- | --- |
| | | |

### Uočene pogreške i ispravci

| Problem | Kako je pronađen | Rješenje |
| --- | --- | --- |
| | | |

