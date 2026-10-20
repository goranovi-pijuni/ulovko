# 2. Analiza zahtjeva

Prioritet **Visok** znači da zahtjev pripada osnovnoj planiranoj funkcionalnosti ili ključnom tehničkom cilju. **Srednji** znači da se zahtjev može razvijati nakon osnovnog korisničkog tijeka ili mu se opseg može prilagoditi prema dostupnom vremenu.

## 2.1 Funkcijski zahtjevi

| ID | Opis | Prioritet | Izvor | Kriteriji prihvaćanja |
| --- | --- | --- | --- | --- |
| F-001 | Korisnik se može prijaviti putem vanjskog pružatelja identiteta koristeći OpenID Connect / OAuth 2.0. | Visok | Zahtjev kolegija | Uspješna prijava otvara korisničku sesiju, odustajanje ili neuspjela prijava ne dopušta pristup zaštićenim radnjama. |
| F-002 | Korisnik može zatražiti organizatorske ovlasti, a administrator može zahtjev odobriti ili odbiti. | Visok | Projektni prijedlog | Samo odobreni korisnik može otvoriti sučelje za stvaranje natjecanja i učitavanje zadataka. |
| F-003 | Posjetitelj može pregledati javno dostupna, nadolazeća i završena natjecanja. | Visok | Projektni prijedlog | Pregled prikazuje naziv, opis i relevantna vremena za javna natjecanja, privatni organizacijski podaci nisu vidljivi. |
| F-004 | Organizator može stvoriti i uređivati vlastita natjecanja, uključujući raspored, pravila i postavke. | Visok | Projektni prijedlog | Natjecanje se pohranjuje s valjanim postavkama, drugi organizator bez ovlasti ne može ga mijenjati. |
| F-005 | Korisnik može osnovati tim za natjecanje te omogućiti pristup pozivnicom ili kodom. | Visok | Projektni prijedlog | Pozvani korisnik može pristupiti timu, drugi pristup istom natjecanju odbija se ako već pripada jednom timu. |
| F-006 | Korisnik može sudjelovati u više natjecanja istodobno, sa zasebnim članstvima. | Visok | Projektni prijedlog | Članstvo u timu natjecanja A ne mijenja članstvo i mogućnosti pristupa u natjecanju B. |
| F-007 | Organizator može definirati zadatak s naslovom, opisom, kategorijom, zastavicom i postavkama bodovanja. | Visok | Projektni prijedlog | Valjan zadatak pohranjuje se uz određeno natjecanje, očekivana zastavica nije dostupna natjecateljskom API-ju. |
| F-008 | Sustav prima ZIP arhivu zadatka te obrađuje `config.yaml`, `public/` i `deploy/`. | Visok | Projektni prijedlog | Valjana arhiva se prihvaća, nevaljana struktura dobiva razumljivu pogrešku, izvori iz `deploy/` nisu dostupni natjecateljima. |
| F-009 | Sustav natjecateljima omogućuje preuzimanje javnih datoteka objavljenog zadatka. | Visok | Projektni prijedlog | Korisnik može preuzeti sadržaj `public/`, ali ne i privatne datoteke izvođenja ili još neobjavljene priloge. |
| F-010 | Organizator može odrediti vrijeme objave zadatka. | Visok | Projektni prijedlog | Zadatak prije vremena objave nije dostupan natjecateljima, a nakon objave postaje vidljiv bez ručne intervencije. |
| F-011 | Tim može predati zastavicu i dobiti rezultat provjere. | Visok | Projektni prijedlog | Točna zastavica evidentira rješenje, pogrešna ga ne evidentira, ponovljena točna predaja istog tima ne dodjeljuje dodatne bodove. |
| F-012 | Organizator može koristiti statičko bodovanje zadataka. | Visok | Projektni prijedlog | Nakon prvog uspješnog rješenja timu se pribraja zadani broj bodova. |
| F-013 | Organizator može koristiti dinamičko bodovanje s parametrima za pojedini zadatak. | Visok | Projektni prijedlog | Vrijednost zadatka mijenja se prema broju rješenja i zadanoj funkciji, rezultati svih timova računaju se dosljedno prema aktualnim vrijednostima. |
| F-014 | Sustav prikazuje ljestvicu rezultata natjecanja. | Visok | Projektni prijedlog | Nakon evidentiranja rješenja prikaz sadrži ažurne ukupne bodove i silazni poredak timova. |
| F-015 | Korisnik može pregledati svoju povijest natjecanja i rješenja, a organizator osnovnu statistiku natjecanja. | Srednji | Projektni prijedlog | Prikazuju se pripadajuća natjecanja, timovi, osvojeni bodovi i evidentirana rješenja, korisnik ne može pristupiti tuđim privatnim podacima. |
| F-016 | Sustav šalje dogovorene obavijesti putem Discord web-dojavnika. | Visok | Zahtjev kolegija (vanjska integracija) i projektni prijedlog | Događaj poput objave zadatka šalje poruku konfiguriranom kanalu, pogreška pri dostavi ne prekida bodovanje ili rad natjecanja. |
| F-017 | Challenge Runner može izraditi kontejnerske slike iz Dockerfileova navedenih u konfiguraciji zadatka. | Visok | Projektni prijedlog | Za paket s dva valjana servisa izgradnja izrađuje dvije dostupne slike ili vraća jasnu informaciju o neuspjehu. |
| F-018 | Challenge Runner pokreće jednu zajedničku instancu servisa zadatka za natjecanje pri njegovoj objavi. | Visok | Projektni prijedlog | Pri objavi zadatka pokreću se traženi servisi, a ponovljeni zahtjev ne stvara drugu istovjetnu instancu. |
| F-019 | Challenge Runner javno izlaže HTTP servis putem dodijeljene HTTPS adrese. | Visok | Projektni prijedlog | Servis s deklariranim HTTP portom dostupan je preko dodijeljene poddomene i ispravnog TLS certifikata. |
| F-020 | Challenge Runner javno izlaže TCP servis na automatski dodijeljenom portu. | Visok | Projektni prijedlog | Dva istodobna TCP servisa dobivaju upotrebljive i međusobno nekonfliktne javne portove. |
| F-021 | Servisi istog zadatka mogu međusobno komunicirati preko privatnih mrežnih imena. | Srednji | Projektni prijedlog | Primjer s dva servisa uspješno uspostavlja internu vezu bez korištenja javnih krajnjih točaka. |
| F-022 | Administrator vidi stanje pokrenutih izazova i može zatražiti ponovno pokretanje. | Visok | Projektni prijedlog | Prikaz pokazuje identitet zadatka, stanje, krajnje točke i pogreške, ovlašteni zahtjev za restart obrađuje se i bilježi. |
| F-023 | Runner zaustavlja i uklanja resurse izazova po završetku natjecanja. | Visok | Projektni prijedlog | Nakon završetka ne ostaju aktivni servisi tog natjecanja, a oslobođeni mrežni portovi mogu se ponovno koristiti. |
| F-024 | Natjecanja sa statičkim zadacima rade i ako Challenge Runner nije dostupan. | Visok | Odluka o granicama projekta | U simulaciji nedostupnog Runnera i dalje rade prijava, prikaz zadataka, predaja zastavica i bodovanje statičkih zadataka. |

## 2.2 Nefunkcijski zahtjevi

| ID | Opis | Prioritet | Izvor | Način provjere |
| --- | --- | --- | --- | --- |
| NF-01 | Zaštićene radnje moraju provjeravati ovlasti na poslužitelju, uključujući vlasništvo nad natjecanjem. | Visok | Sigurnost i projektni prijedlog | Pokušati uređivati tuđe natjecanje, učitati zadatak bez organizatorske uloge i pristupiti administratorskoj radnji. Svi pokušaji moraju biti odbijeni. |
| NF-02 | Učitana arhiva ne smije omogućiti čitanje ili pisanje izvan predviđenog prostora niti izlaganje privatnih datoteka zadatka. | Visok | Sigurnost | Testirati nevaljane putanje, simboličke poveznice, nedopuštenu strukturu i nedopušten pristup sadržaju `deploy/`. |
| NF-03 | Kontejneri zadataka izvode se uz ograničene ovlasti i resurse, a mrežni pristup drugim izazovima i internim komponentama platforme treba biti ograničen. | Visok | Sigurnost | Pregledati konfiguraciju sigurnosnih konteksta, resursnih ograničenja i mrežnih pravila, provesti pokušaje nedopuštenog pristupa iz testnog izazova. |
| NF-04 | Kvar ili nedostupnost Challenge Runnera ne smije onemogućiti osnovne funkcije natjecanja sa statičkim zadacima. | Visok | Pouzdanost | Zaustaviti mock/realni Runner i provjeriti da prijava, predaje zastavica i ljestvica i dalje rade. |
| NF-05 | Ponovljeni zahtjevi za objavu ili gašenje izazova ne smiju proizvesti duplicirane instance ili nepredviđene resurse. | Visok | Pouzdanost | Dvaput pozvati istu operaciju i provjeriti broj instanci, stanje sustava i evidenciju događaja. |
| NF-06 | Paralelne predaje iste točne zastavice ne smiju uzrokovati višestruku dodjelu bodova. | Visok | Integritet podataka | U testu istodobno poslati više predaja istog tima za isti zadatak i provjeriti jedno evidentirano rješenje. |
| NF-07 | Javno korisničko sučelje i javni HTTP servisi zadataka trebaju koristiti HTTPS. | Visok | Sigurnost | Pristupiti preko HTTPS-a i provjeriti valjanost certifikata i ispravnost usmjeravanja. |
| NF-08 | Instalacija i pokretanje aplikacije moraju biti reproducibilni iz repozitorija i dokumentiranih konfiguracijskih primjera bez uključivanja tajnih podataka. | Visok | Zahtjev kolegija i održivost | Drugi član tima slijedi upute nakon čistog kloniranja i pokreće aplikaciju te osnovnu provjeru. |

## 2.3 Dionici i akteri

| ID | Uloga / akter | Odnos prema sustavu | Relevantni zahtjevi |
| --- | --- | --- | --- |
| A-01 | Posjetitelj | Pregledava javne informacije bez prijave. | F-003 |
| A-02 | Natjecatelj | Sudjeluje u natjecanju, radi u timu, rješava zadatke. | F-001, F-005, F-006, F-009, F-011, F-014, F-015 |
| A-03 | Organizator | Priprema natjecanja i zadatke, prati njihove rezultate. | F-004, F-007, F-008, F-010, F-012, F-013, F-015 |
| A-04 | Administrator platforme | Odobrava ovlasti i upravlja nadzorom sustava. | F-002, F-022 |
| A-05 | Vanjski pružatelj identiteta | Sudjeluje u autentikacijskom postupku. | F-001 |
| A-06 | Discord usluga | Prima obavijesti putem web-dojavnika. | F-016 |

Challenge Runner je **unutarnji podsustav** predložene platforme, a ne dodatna korisnička uloga. Njegova komunikacija s backendom prikazat će se u arhitekturi i dijagramima slijeda.

## 2.4 Ograničenja i pretpostavke

| ID | Tip | Opis | Izvor | Inženjerska posljedica / provjera |
| --- | --- | --- | --- | --- |
| C-01 | Ograničenje | Prijava putem vanjskog identiteta uz OIDC / OAuth 2.0 obavezan je dio kolegija. | Zahtjev kolegija | Prijavu treba integrirati i testirati s odabranim pružateljem. |
| C-02 | Ograničenje | Potrebna je domenski relevantna vanjska integracija. | Zahtjev kolegija | Planiran je Discord webhook, uspješnu dostavu treba ispitati. |
| C-03 | Ograničenje | Projekt mora biti javno dostupan te imati dokumentaciju, modele sustava i testove. | Zahtjev kolegija | Planirati postavljanje i održavati `/docs`, `/docs/deliverables`, GitHub i ispitne scenarije. |
| C-04 | Ograničenje | Projekt treba uključiti objektno orijentirano oblikovanje i implementaciju. | Zahtjev kolegija | U backendu razdvojiti domenske modele, servise i pristup podacima, odluke dokumentirati. |
| C-05 | Ograničenje (projektna odluka) | Jedan korisnik pripada najviše jednom timu po natjecanju, istodobno može sudjelovati u više natjecanja. | Projektni prijedlog | Ograničenja provjeravati u poslovnoj logici i bazi podataka. |
| C-06 | Ograničenje (projektna odluka) | Jedna instanca kontejneriziranog zadatka zajednička je cijelom natjecanju, sa statičkom zastavicom. | Projektni prijedlog | Ne razvijati upravljanje instancama po timu, zadaci moraju biti prikladni za dijeljenje stanja. |
| AS-01 | Pretpostavka | K3s na jednom čvoru može zadovoljiti potrebe prototipa Runnera. | Tehnička pretpostavka | Rano provjeriti izgradnju i pokretanje HTTP i TCP zadatka. |
| AS-02 | Pretpostavka | Bit će dostupni DNS, TLS certifikati i javna mrežna konfiguracija za poddomene i TCP portove. | Infrastrukturna pretpostavka | Provjeriti DNS, otvorene portove, HTTPS i ograničenja pružatelja hostinga. |
| AS-03 | Pretpostavka | Izgradnja Dockerfileova može se sigurno odvojiti od aplikacijskog backenda u okviru studentskog prototipa. | Sigurnosna pretpostavka | Odabrati izdvojeni build proces i provjeriti ovlasti i pristup datotekama. |
| AS-04 | Pretpostavka | Objektno spremište kompatibilno sa S3 sučeljem odgovara potrebama za pohranu ZIP paketa. | Tehnička pretpostavka | Provjeriti pristup, troškove, ograničenja veličine i zamjenjivost lokalnim razvojnim spremištem. |

## 2.5 Značajne promjene zahtjeva

Značajne promjene bilježit će se nakon što tim usvoji početni opseg. Trenutačno nema potvrđenih promjena koje bi bilo smisleno prikazati kao donesene odluke.

| Datum | ID zahtjeva | Promjena i razlog | Dogovoreno s / dokaz |
| --- | --- | --- | --- |
| — | — | Još nema evidentiranih promjena nakon usvajanja početnih zahtjeva. | — |

## 2.6 Sljedivost zahtjeva

Sljedeća je tablica početna veza zahtjeva s planiranim modulima. Oznake obrazaca uporabe i ispita dodat će se tek nakon što stvarni dokumenti i testovi budu napisani, nije korisno unaprijed izmišljati njihove identifikatore.

| ID zahtjeva | Obrazac uporabe / ponašanje | Arhitekturna realizacija (planirana) | Ispitivanje ili provjera |
| --- | --- | --- | --- |
| F-001 | Prijava korisnika, detaljni UC na čekanju | Backend autentikacija, vanjski IdP | Integracijski test prijave (na čekanju) |
| F-002 | Zahtjev i odobravanje organizatorskog statusa, UC na čekanju | Backend ovlasti, administracijsko sučelje | Test dopuštenih i zabranjenih radnji (na čekanju) |
| F-005 | Izrada tima i pridruživanje, UC na čekanju | Backend timovi, baza podataka | Test ograničenja jednog članstva (na čekanju) |
| F-008 | Učitavanje paketa zadatka, UC na čekanju | Backend zadaci, objektna pohrana, parser | Test valjanih/nevaljanih ZIP arhiva (na čekanju) |
| F-011, F-012, F-013 | Predaja zastavice i bodovanje, UC na čekanju | Backend scoring, baza podataka | Test bodovanja i istodobnih predaja (na čekanju) |
| F-016 | Discord obavijesti | Backend događaji, Discord webhook | Integracijski test slanja i pogreške dostave (na čekanju) |
| F-017, F-018 | Izgradnja i objava zadatka | Runner API, build proces, orkestracija | End-to-end test izgradnje i pokretanja (na čekanju) |
| F-019, F-020, F-021 | Pristup HTTP/TCP servisima i interna komunikacija | Runner, mrežne usluge, ingress/portovi | Mrežni integracijski test (na čekanju) |
| F-022, F-023 | Nadzor i zaustavljanje servisa | Runner API, administracijsko sučelje | Test restarta i uklanjanja resursa (na čekanju) |
| F-024 | Natjecanje bez Runnera | Backend natjecanja i bodovanje | Test s nedostupnim Runnerom (na čekanju) |

## 2.7 Pregled zahtjeva

Povratne informacije s kontrolnih točaka unijet će se tek nakon stvarnih pregleda. Ne označavaju se kao provedene unaprijed.

| Kontrolna točka | Povratna informacija ili nalaz | Odluka o zahtjevu ili opsegu |
| --- | --- | --- |
| Iteracija 1 | Na čekanju | Na čekanju |
| Demo 2 | Na čekanju | Na čekanju |
| Završni pregled | Na čekanju | Na čekanju |
