# 1. Opseg projekta

> **Radna verzija.** Ovaj tekst opisuje predloženi opseg projekta Ulovko. Konačni opseg biti će definiran kroz rad na aplikaciji.

## 1.1 Problem i cilj projekta

Capture the Flag (CTF) natjecanja sastoje se od zadataka iz računalne sigurnosti, najčešće iz područja kriptografije, web sigurnosti, digitalne forenzike, obrnutog inženjerstva i iskorištavanja ranjivosti. Rješavanjem zadatka natjecatelj pronalazi zastavicu (*flag*) koju predaje sustavu i za to osvaja bodove. Natjecanja se često odvijaju timski, uz javnu ljestvicu rezultata i vremenski ograničeno trajanje.

Za organizaciju takvog natjecanja potrebna je aplikacija za prijave korisnika, timove, objavu zadataka, provjeru zastavica i bodovanje. Dio zadataka dodatno zahtijeva vlastite web aplikacije ili TCP servise koje organizator treba pokrenuti, mrežno izložiti i održavati dostupnima tijekom natjecanja. To je zaseban posao koji se često mora pripremati uz samu platformu za bodovanje.

**Cilj projekta Ulovko** je povezati ove dvije strane organizacije natjecanja. Organizator će moći unaprijed definirati natjecanje, učitati njegove zadatke i odrediti kada se objavljuju. Platforma će natjecateljima omogućiti pristup zadacima, predaju rješenja i praćenje poretka. Poseban dio projekta bit će *Challenge Runner*: podsustav koji iz deklarativne konfiguracije zadatka pokreće potrebne kontejnere, omogućuje pristup servisima i prati njihovo stanje.

Očekivana korist za organizatora je manje ručne konfiguracije infrastrukture za svaki zadatak i jedinstveno mjesto za upravljanje natjecanjem. Natjecateljima sustav pruža jedno sučelje za prijavu, timove, zadatke i rezultate. Ne pretpostavljamo unaprijed izmjerenu uštedu vremena, izvedivost automatiziranog postavljanja provjerit ćemo prototipom.

## 1.2 Ciljani korisnici i dionici

| Skupina korisnika ili dionika | Potreba ili interes relevantan za projekt |
| --- | --- |
| Posjetitelj | Pregledati javne informacije o natjecanjima prije prijave. |
| Natjecatelj | Prijaviti se putem vanjskog identiteta, sudjelovati u natjecanju, raditi u timu, preuzimati zadatke i predavati zastavice. |
| Organizator natjecanja | Pripremiti natjecanje i njegove zadatke, odrediti raspored, bodovanje i pravila te pratiti rezultate bez ručnog upravljanja svakim servisom. |
| Administrator platforme | Odobravati organizacijska prava, nadzirati rad sustava i imati pregled aktivnih servisa i pogrešaka. |
| Održavatelj infrastrukture | Postaviti sustav i provjeriti mrežnu dostupnost, sigurnosna ograničenja, pohranu podataka i životni ciklus kontejnera. Ovu zadaću može obavljati administrator. |

Korisnik može sudjelovati u više natjecanja, ali unutar svakog može biti član samo jednog tima. Timovi se osnivaju zasebno za pojedina natjecanja, a pristup se omogućuje pozivnicom ili kodom. Organizatorske ovlasti nisu automatske: registrirani korisnik podnosi zahtjev koji odobrava administrator.

## 1.3 Granice projekta

**Uključeno u planirani opseg:**

- Prijava vanjskim pružateljem identiteta (OpenID Connect / OAuth 2.0), korisnički profili i tri osnovne uloge: natjecatelj, organizator i administrator.
- Zahtjev za organizatorske ovlasti i administratorsko odobravanje.
- Više natjecanja koja se mogu odvijati istodobno, sa zasebnim timovima, rasporedom i rezultatima.
- Stvaranje timova, pozivnice odnosno pristupni kodovi i ograničenje članstva na jedan tim po natjecanju.
- Izrada natjecanja, objava zadataka prema rasporedu, predaja statičkih zastavica te statičko ili dinamičko bodovanje.
- Ljestvice rezultata, povijest sudjelovanja i osnovna statistika natjecanja.
- ZIP paket zadatka s `config.yaml`, `public/` i `deploy/`. Javni prilozi dostupni su natjecateljima, dok konfiguracija za izvođenje i izvori servisa nisu.
- Integracija s Discordom za obavijesti o događajima u natjecanju.
- **Ciljana funkcionalnost Challenge Runnera:** izgradnja kontejnerskih slika iz Dockerfileova, pokretanje zadatka u vrijeme njegove objave, automatsko izlaganje HTTP(S) i TCP servisa, privatna komunikacija servisa istog zadatka, nadzor stanja i zaustavljanje po završetku natjecanja.
- Jedna zajednička instanca kontejneriziranog zadatka po natjecanju, ne po natjecatelju ili timu.

Planirana struktura paketa:

```text
challenge.zip
├── config.yaml
├── public/
│   └── ...         # datoteke koje se daju natjecateljima
└── deploy/
    ├── web1/
    │   ├── Dockerfile
    │   └── src/
    └── test/
        ├── Dockerfile
        └── ...
```

`config.yaml` opisuje servise i njihove interne portove. Konačna shema nije još dogovorena. Za HTTP servis runner bi trebao vratiti HTTPS adresu oblika `<identifikator>.chal.example.com`, a za sirovi TCP servis adresu i automatski dodijeljeni port, primjerice `tcp.chal.example.com:31252`. Navedene adrese služe samo kao primjer. Servisi unutar istog zadatka trebali bi moći komunicirati privatnom mrežom odnosno internim imenima.

**Izvan opsega ili odgođeno:**

- Zasebna instanca zadatka za svakog natjecatelja ili tim, dinamičke zastavice i resetiranje privatnog stanja po timu.
- Višečvorna orkestracija, automatsko skaliranje, visoka dostupnost i složeno raspoređivanje resursa.
- Vlastiti sustav orkestracije kontejnera, namjera je koristiti postojeće alate.
- Složeni načini natjecanja poput Attack–Defense modela, sustav naplate i automatsko otvaranje infrastrukture kod pružatelja oblaka.
- Jamstvo sigurnog izvođenja proizvoljnog zlonamjernog koda u produkcijskom okruženju. Odobrenje organizatora, ograničenja kontejnera i mrežne politike smanjuju rizik, ali ne predstavljaju potpunu izolaciju na zajedničkom poslužitelju.

**Razdvajanje osnovnog sustava i tehničkog rizika:** Osnovna platforma mora podržavati statičke zadatke, timove, rješenja i rezultate i kada Challenge Runner nije dostupan. Automatsko postavljanje zadataka ostaje glavni tehnički cilj projekta, ali neće biti preduvjet za razvoj i ispitivanje ostatka aplikacije.

**Vanjske ovisnosti i tehnologije koje se razmatraju:**

- Vanjski pružatelj identiteta za prijavu, konkretan pružatelj još nije odabran.
- Discord webhooks za slanje obavijesti.
- Objektno spremište kompatibilno sa S3 API-jem, specifično Cloudflare R2, za datoteke zadataka.
- Sustav za izgradnju kontejnerskih slika, spremište slika i kontejnersko izvođenje; razmatra se Docker/K3s na jednom čvoru.
- DNS i TLS konfiguracija za javnu dostupnost web aplikacije te HTTP/TCP zadataka.

## 1.4 Postojeći pristupi i opravdanost projekta

Postojeće platforme, primjerice [CTFd](https://docs.ctfd.io/docs/overview/), već podržavaju upravljanje zadacima, timovima, zastavicama i rezultatima, a CTFd ima i mogućnosti za [postavljanje kontejneriziranih zadataka](https://ctfd.io/features/). Ulovko stoga ne polazi od tvrdnje da takva rješenja ne postoje. Projektni interes je u vlastitoj implementaciji cjelovitog tijeka od ZIP paketa s više servisa i rasporeda objave do pokretanja, dodjele HTTP/TCP adresa i nadzora putem istog sučelja što značajno olakšava održavanje natjecanja.

