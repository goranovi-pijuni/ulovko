# Ulovko Challenge Runner

FastAPI aplikacija za upravljanje CTF zadacima na zasebnom K3s serveru. Runner trenutačno dohvaća stanje čvorova i radnih opterećenja, grupira pokrenute servise po natjecanjima i zadacima te asinkrono gradi OCI slike iz izvora spremljenih na Cloudflare R2. Nakon izgradnje runner može uvesti OCI slike u lokalni K3s i pokrenuti servise prema konfiguraciji zadatka; infrastruktura i postupak instalacije opisani su u [infra/runner-vps/README.md](../infra/runner-vps/README.md).

## Struktura

```text
runner/
├── examples/
│   └── demo-challenge/
├── src/runner/
│   ├── main.py
│   ├── auth.py
│   ├── kube.py
│   ├── routes/
│   │   ├── nodes.py
│   │   ├── workloads.py
│   │   ├── challenges.py
│   │   ├── builds.py
│   │   └── deploy.py
│   └── services/
│       ├── package.py
│       ├── r2.py
│       ├── builder.py
│       ├── build_jobs.py
│       ├── inventory.py
│       └── deployer.py
├── tests/
├── pyproject.toml
└── uv.lock
```

`package.py` parsira i validira opis servisa, `r2.py` preuzima i provjerava ulazne datoteke, `builder.py` poziva BuildKit, a `build_jobs.py` održava trajni red poslova i pokreće izgradnju. `inventory.py` i rute `/challenges` čitaju postojeće Kubernetes resurse; ne služe kao baza podataka o natjecanjima.

## Format zadatka na Cloudflare R2

Svako natjecanje ima vlastiti R2 bucket nazvan prema `competition_id`, a svaki zadatak unutar njega koristi prefiks `task_id/`. Runner za izgradnju preuzima točno dva objekta:

```text
R2 bucket: demo-competition
└── demo-challenge/
    ├── config.yml
    └── deploy.zip
```

Arhiva `deploy.zip` mora imati direktorij `deploy/` u svojem korijenu:

```text
deploy/
├── web1/
│   ├── Dockerfile
│   └── server.py
└── test/
    ├── Dockerfile
    └── server.py
```

Primjer `config.yml`:

```yaml
services:
  web1:
    type: http
    path: web1
    port: 8080

  test:
    type: tcp
    path: test
    port: 5000
```

`type` je `http` ili `tcp`, `path` je putanja build konteksta relativna u odnosu na `deploy/`, a `port` je unutarnji port kontejnera. Svaki servis mora imati vlastiti Dockerfile; runner odbija nepoznata polja, neispravne portove, izlazak iz dozvoljenih putanja i nepodržane ZIP zapise. **Manifest ne sadrži podatke o flagovima** jer njima upravlja aplikacijski backend, a ne runner.

Lokalni primjer nalazi se u `examples/demo-challenge/` i koristi naziv `config.yaml`. Pri prijenosu na R2 isti se sadržaj sprema pod ključem `<task_id>/config.yml`, jer trenutačni R2 dohvat očekuje upravo taj naziv. Direktorij `public/` iz lokalnog primjera namijenjen je igračima i ne uključuje se u Docker build kontekste ni u R2 `deploy.zip`. Upute za primjer nalaze se u [examples/README.md](examples/README.md).

## Izgradnja slika

Build API ne izvodi Dockerfileove u FastAPI procesu. `POST /builds` zapisuje posao s jedinstvenim `build_id`, a zasebni proces `runner.services.build_jobs` preuzima poslove redom, dohvaća R2 objekte, validira konfiguraciju i pokreće rootless BuildKit za svaki servis. Za izgradnju se ne koristi Docker Engine ni `sudo buildctl`.

Stanja posla su `queued`, `running`, `succeeded` i `failed`. Red poslova i rezultati na runner VPS-u spremljeni su u `/var/lib/ctf-runner/builds`; ako se FastAPI ponovno pokrene, poslovi ostaju na disku, a prekinuti posao workera vraća se u red i ponovno obrađuje. Worker gradi jedan zadatak u određenom trenutku.

```text
/var/lib/ctf-runner/builds/<build_id>/
├── job.json
├── config.yml
└── images/
    ├── web1.oci.tar
    ├── web1.log
    ├── test.oci.tar
    ├── test.log
    └── images.json
```

Datoteka `config.yml` i OCI arhive ostaju dostupne nakon uspješne izgradnje; privremeno raspakirani izvori brišu se nakon obrade. `images.json` povezuje imena servisa s nazivima arhiva. Izgradnja sama po sebi ne stvara Kubernetes resurse; arhive se uvoze tek na zahtjev `POST /challenges/{competition_id}/{task_id}/deploy`.

## HTTP API

Svi navedeni endpointi osim `/health` koriste zaglavlje `Authorization: Bearer <RUNNER_API_TOKEN>`. Popis i status buildova nisu javni, a zahtjev za izgradnju prima identifikatore zadatka umjesto proizvoljnih lokalnih putanja ili pristupnih ključeva.

| Metoda | Putanja | Namjena |
| --- | --- | --- |
| `GET` | `/health` | Osnovna provjera dostupnosti API-ja |
| `GET` | `/nodes` | Stanje K3s čvorova |
| `GET` | `/workloads` | Kubernetes Deploymenti i pripadajući Podovi |
| `GET` | `/challenges` | Pregled izazova grupiranih po natjecanju i zadatku |
| `GET` | `/challenges/{competition_id}` | Pregled jednog natjecanja |
| `GET` | `/challenges/{competition_id}/{task_id}` | Detalji servisa, spremnosti i dostupnih krajnjih točaka |
| `POST` | `/builds` | Predaja novog posla izgradnje; HTTP 202 |
| `GET` | `/builds/{build_id}` | Stanje posla, pogreška i izlazne arhive |
| `GET` | `/builds/{build_id}/logs/{service}` | Zadnjih 64 KiB BuildKit zapisnika pojedinog servisa |
| `POST` | `/challenges/{competition_id}/{task_id}/deploy` | Uvoz izgrađenih OCI slika i pokretanje servisa u K3s-u; HTTP 202 |
| `DELETE` | `/challenges/{competition_id}/{task_id}` | Brisanje resursa tog zadatka iz K3s-a |

Primjer predaje zadatka koji se nalazi u bucketu `demo-competition` pod prefiksom `demo-challenge/`:

```bash
curl -s \
  -H "Authorization: Bearer $RUNNER_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"competition_id":"demo-competition","task_id":"demo-challenge"}' \
  http://127.0.0.1:8000/builds | jq
```

Odgovor sadrži `build_id` i početno stanje `queued`. Za dohvat stanja i zapisnika zamijeniti `BUILD_ID` identifikatorom iz odgovora:

```bash
curl -s -H "Authorization: Bearer $RUNNER_API_TOKEN" \
  http://127.0.0.1:8000/builds/BUILD_ID | jq

curl -s -H "Authorization: Bearer $RUNNER_API_TOKEN" \
  http://127.0.0.1:8000/builds/BUILD_ID/logs/web1
```

Prikaz izazova u `/challenges` temelji se na Kubernetes oznakama već pokrenutih resursa. Izgrađen zadatak neće se pojaviti dok se ne objavi u K3s-u.

Za registraciju ruta potrebno je u `runner/src/runner/main.py` dodati `from runner.routes import deploy` te `app.include_router(deploy.router, dependencies=[Depends(authenticate)])` uz postojeće rute. Novi `deployer.py` ne zahtijeva izmjene `builder.py`, `package.py` ni strukture R2 objekata.

## Objava izazova u K3s

Nakon uspješnog `POST /builds` pozvati `POST /challenges/{competition_id}/{task_id}/deploy` s odgovarajućim `build_id`. Runner učitava spremljeni `config.yml`, uvozi OCI arhive u K3s containerd i stvara po jedan Deployment i Service za svaki servis; HTTP servis dobiva Ingress na `https://` ili `http://<generirano-ime>.chal.ulovko.fun` (stvarna HTTPS konfiguracija nije uključena), a TCP servis dobiva automatski dodijeljen NodePort. Ovo je jednostavna objava na jednom K3s čvoru, bez privatne mreže među izazovima i bez automatskog ažuriranja već objavljenog zadatka.

```bash
curl -s -H "Authorization: Bearer $RUNNER_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"build_id":"BUILD_ID"}' \
  http://127.0.0.1:8000/challenges/demo-competition/demo-challenge/deploy | jq

curl -s -H "Authorization: Bearer $RUNNER_API_TOKEN" \
  http://127.0.0.1:8000/challenges/demo-competition/demo-challenge | jq
```

Ako je zadatak već objavljen, nova objava vraća HTTP 409; za promjenu slike prvo ga ukloniti, zatim ponovno objaviti. Uklanjanje ne briše spremljene buildove ni slike iz containerd cachea.

```bash
curl -s -X DELETE -H "Authorization: Bearer $RUNNER_API_TOKEN" \
  http://127.0.0.1:8000/challenges/demo-competition/demo-challenge | jq
```

Za uvoz slika build mora biti spremljen u `/var/lib/ctf-runner/builds`, jer privilegirana skripta namjerno koristi samo tu fiksnu lokaciju; raniji lokalni primjer s `RUNNER_BUILDS_DIR=$HOME/.local/state/ulovko/builds` služi samo za testiranje izgradnje, ne i Kubernetes objave. Za testiranje objave koristi se provisionirani servis i isti direktorij buildova kao na VPS-u.

Import slika koristi root-owned pomoćnu skriptu koju smije pokrenuti samo korisnik `ctf-runner` putem ograničenog `sudoers` pravila. K3s API se i dalje koristi isključivo kroz ograničeni ServiceAccount. Ova jednostavna verzija namijenjena je pouzdanim demo zadacima; prije dopuštanja proizvoljnih organizatorskih kontejnera nužni su jača izolacija i sigurnosna provjera privilegija i mreže.

## Lokalni razvoj

Iz direktorija `runner/` instalirati razvojne ovisnosti iz zaključane datoteke:

```bash
uv sync --locked
uv run --locked ruff check .
uv run --locked pytest -v
```

Za stvarnu izgradnju potreban je rootless BuildKit, instaliran pomoću postupka opisanog u [infrastrukturnom README-u](../infra/runner-vps/README.md). Prije pokretanja workera provjeriti da BuildKit odgovara na zajedničkom Unix socketu:

```bash
buildctl --addr unix:///run/ulovko-buildkit/buildkitd.sock debug workers
```

Lokalni demo može se izgraditi bez R2 pristupa i bez FastAPI-ja:

```bash
uv run python -m runner.services.builder examples/demo-challenge
```

Za rad kroz API potrebno je u ljusci postaviti `RUNNER_API_TOKEN`, `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID` i `R2_SECRET_ACCESS_KEY`. Cloudflare R2 koristi S3 Access Key ID i Secret Access Key, ne obični Cloudflare bearer API token. Endpoint ovisi o jurisdikciji bucketa, primjerice `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com` za EU jurisdikciju. Kubernetes rute dodatno zahtijevaju valjani `KUBECONFIG` za ograničeni ServiceAccount; API inicijalizira Kubernetes klijenta pri pokretanju.

Pokrenuti worker u prvom terminalu, iz direktorija `runner/`:

```bash
env RUNNER_BUILDS_DIR="$HOME/.local/state/ulovko/builds" \
  uv run python -m runner.services.build_jobs
```

Pokrenuti FastAPI u drugom terminalu s istim `RUNNER_BUILDS_DIR`:

```bash
env RUNNER_BUILDS_DIR="$HOME/.local/state/ulovko/builds" \
  uv run uvicorn runner.main:app --host 127.0.0.1 --port 8000
```

U trećem terminalu poslati `POST /builds` iz gornjeg primjera. Ako posao ostaje u stanju `queued`, provjeriti radi li zasebni worker, koristi li isti `RUNNER_BUILDS_DIR` i može li pristupiti BuildKit socketu. Ako posao prijeđe u `failed`, `GET /builds/{build_id}` i zapisnici servisa trebali bi pokazati problem s R2 objektima, konfiguracijom ili izgradnjom.

## Konfiguracija i ograničenja

U produkciji `ctf-runner.service` i `ctf-runner-builds.service` čitaju istu datoteku `/etc/ulovko/runner.env`, koju generira Runner CD iz GitHub Actions secrets i variables. `RUNNER_BUILDS_DIR` definira direktorij stanja buildova, `KUBECONFIG` pristup Kubernetes API-ju, a `RUNNER_CHALLENGE_NAMESPACE` namespace za čitanje radnih opterećenja. Postavke `RUNNER_HTTP_SCHEME` i `RUNNER_TCP_HOST` utječu na prikaz javnih krajnjih točaka. Instalacija, ovlasti i rotacija Kubernetes tokena obrađene su u [infra/runner-vps/README.md](../infra/runner-vps/README.md).

R2 arhive ograničene su maksimalnom veličinom i brojem datoteka, ali rootless BuildKit sam po sebi nije potpuna izolacija za neprijateljske Dockerfileove. Prije omogućavanja proizvoljnih organizatorskih uploadova potrebni su dodatna izolacija, ograničenje resursa i kontrola mrežnog pristupa. Ponovno pokretanje prekinutog posla trenutačno ponovno preuzima aktualne R2 objekte, pa za reproduktivnost izgradnji kasnije treba pohraniti njihove digest vrijednosti ili nepromjenjive verzije.

Prije produkcijskog izvršavanja neprijateljskih kontejnera potrebna je mrežna izolacija, sigurnija granica za import slika i upravljanje životnim ciklusom po natjecanjima.
