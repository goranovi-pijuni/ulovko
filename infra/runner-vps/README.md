# Ulovko runner VPS provisioning

Konfiguracija zasebnog VPS servera za pokretanje CTF zadataka pomoću K3s klastera, FastAPI Challenge Runnera i rootless BuildKita. Ovaj dokument opisuje instalaciju servera, systemd servise, konfiguraciju i automatsku objavu; razvoj aplikacije, R2 format zadataka i API opisani su u [runner/README.md](../../runner/README.md).

## Preduvjeti

- VPS koji koristi Linux sa systemd i root pristupom (Debian/Ubuntu; lokalno testiranje BuildKita moguće je i na Arch Linuxu)
- Instalirani Git i `curl` te pristup internetu; `provision.sh` po potrebi instalira dodatne alate
- TCP port 22 za SSH i SSH javni ključ namijenjen GitHub Actions objavi
- Zaštićena mrežna veza između aplikacijskog VPS-a i runner API-ja (privatna mreža, VPN ili odgovarajuća TLS konfiguracija)
- Cloudflare R2 S3 pristupni ključevi s pravom čitanja potrebnih objekata

## Prva instalacija

1. Generirati zaseban SSH ključ za objavu na runner VPS (moguće je koristiti i postojeći ključ, ali zaseban je preporučen):

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/ulovko-runner-deploy -C ulovko-runner-ci
   ```

   Javni ključ (`.pub`) ne dodaje se u Git. Prenijeti ga jednokratno na VPS, primjerice preko postojećeg root SSH pristupa:

   ```bash
   scp ~/.ssh/ulovko-runner-deploy.pub root@<RUNNER_VPS>:/root/ulovko-runner-deploy.pub
   ```

2. Preuzeti Git repozitorij na runner VPS te iz korijena repozitorija pokrenuti:

   ```bash
   sudo bash infra/runner-vps/provision.sh --deploy-key /root/ulovko-runner-deploy.pub
   ```

   Skripta instalira ili provjerava K3s, čeka spremnost čvora, primjenjuje `k8s/runner-api/access.yaml`, postavlja rootless BuildKit, instalira `uv`, stvara korisnike i konfigurira systemd. Argument `--deploy-key` postavlja javni ključ korisniku `deploy`; pri kasnijem ponovnom pokretanju provisioning skripte može se izostaviti jer postojeći SSH pristup ostaje sačuvan. FastAPI se ne pokreće prije prve objave aplikacije.

3. U GitHub Actions okruženju **production** postaviti Secrets:

   | Naziv | Svrha |
   | --- | --- |
   | `RUNNER_DEPLOY_HOST` | SSH adresa runner VPS-a |
   | `RUNNER_DEPLOY_SSH_KEY` | Privatni ključ za korisnika `deploy` |
   | `RUNNER_DEPLOY_KNOWN_HOSTS` | Provjereni SSH host ključ runner VPS-a |
   | `RUNNER_API_TOKEN` | Zajednički token kojim NestJS pristupa FastAPI-ju |
   | `R2_ACCESS_KEY_ID` | Cloudflare R2 S3 Access Key ID |
   | `R2_SECRET_ACCESS_KEY` | Cloudflare R2 S3 Secret Access Key |

   `RUNNER_API_TOKEN` može se generirati naredbom `openssl rand -hex 32`. SSH host ključ potrebno je neovisno provjeriti prije spremanja u `RUNNER_DEPLOY_KNOWN_HOSTS`. R2 ključ treba ograničiti na čitanje potrebnih objekata; ne treba mu pravo pisanja.

4. U istom okruženju postaviti Variables:

   | Naziv | Svrha |
   | --- | --- |
   | `RUNNER_BIND_HOST` | Adresa na kojoj FastAPI sluša; zadano `127.0.0.1` |
   | `RUNNER_API_URL` | Adresa runner API-ja dostupna aplikacijskom backendu, uključujući port ako je potreban |
   | `RUNNER_TCP_HOST` | Javni TCP hostname za prikaz krajnjih točaka, primjerice `tcp.chal.ulovko.fun` (opcionalno) |
   | `RUNNER_HTTP_SCHEME` | `http` ili `https` za prikaz HTTP krajnjih točaka (opcionalno) |
   | `R2_ENDPOINT_URL` | Cloudflare R2 S3 endpoint odgovarajućeg računa i jurisdikcije |

5. Pokrenuti **Runner CD** preko GitHub Actions (`workflow_dispatch`) ili spojiti promjene na `main`. Nakon uspješnog CI-ja workflow prenosi kod, instalira zaključane Python ovisnosti, postavlja konfiguraciju i systemd jedinice, osvježava Kubernetes pristupne podatke te provjerava rad FastAPI-ja. Nakon prve instalacije redovite objave ne zahtijevaju prijavu na VPS.

Aplikacijski VPS konfigurira se zasebno kroz `infra/app-vps/`. Njegov backend koristi centralnu datoteku `/opt/ctf/backend/.env`, koju Backend CD sastavlja iz `APP_ENV` i zajedničkih `RUNNER_API_TOKEN` / `RUNNER_API_URL` postavki; nije potrebna posebna datoteka za runner integraciju.

## Rootless BuildKit

Izgradnju kontejnerskih slika izvršava `ctf-buildkit.service` pod zasebnim Linux korisnikom `ctf-builder`. FastAPI i build worker koriste grupu `ulovko-build` za pristup Unix socketu `/run/ulovko-buildkit/buildkitd.sock`, bez `sudo buildctl` i bez Docker Enginea. Korisnik `ctf-builder` nema pristup Kubernetes kubeconfig datoteci runnera.

`provision.sh` poziva `scripts/install-buildkit.sh`, a ista se skripta može jednom pokrenuti na razvojnom Linux računalu:

```bash
sudo bash infra/runner-vps/scripts/install-buildkit.sh
```

Instalacijska skripta postavlja BuildKit, RootlessKit, potrebne korisnike i grupe, podređene UID/GID raspone te systemd servis. Nakon što lokalni korisnik dobije članstvo u grupi `ulovko-build`, potrebno je osvježiti prijavu kako bi novo članstvo vrijedilo i u ljusci.

Provjera komunikacije s rootless daemon procesom:

```bash
buildctl --addr unix:///run/ulovko-buildkit/buildkitd.sock debug workers
```

Na Ubuntu sustavima s AppArmor ograničenjima korisničkih namespaceova treba koristiti odgovarajući RootlessKit profil bez dvostrukih AppArmor attachmenta. Ne treba globalno isključivati AppArmor niti davati FastAPI-ju pristup rootful BuildKit daemonu.

## Automatska objava

`.github/workflows/runner-ci.yml` provjerava Python aplikaciju (instalacija iz `uv.lock`, Ruff i pytest) i infrastrukturu (Bash, ShellCheck i Kustomize). `.github/workflows/runner-deploy.yml` povezuje se preko SSH-a i prenosi aplikaciju izravno u `/opt/ctf/runner`, gdje se ovisnosti instaliraju pomoću `uv sync --locked --no-dev --no-editable`.

Privilegirani `scripts/deploy.sh` primjenjuje runner RBAC, instalira ažurirane systemd jedinice i konfiguraciju BuildKita, sprema varijable u `/etc/ulovko/runner.env`, obnavlja ograničeni Kubernetes token i ponovno pokreće `ctf-runner.service` te zasebni build worker. Zatim provjerava `/health` i autentificirani `/nodes` endpoint. Datoteka `/opt/ctf/runner/.venv` ostaje sačuvana između objava; ne koriste se direktoriji `staging`, `releases` ni poveznica `current`.

U slučaju neuspjeha GitHub Actions prijavljuje pogrešku. Automatski rollback nije predviđen; povrat na raniju verziju radi se vraćanjem promjene u Gitu i novom objavom. Promjene `k3s/config.yaml` ne primjenjuju se automatski jer mogu zahtijevati kontrolirano ponovno pokretanje K3s-a i utjecati na postojeće izazove.

Ako je VPS ranije provisioniran starijom verzijom pomoćnih skripti, ponovno pokrenuti ažurirani `provision.sh` kako bi se instalirao odgovarajući privilegirani `deploy.sh`. Za svježu instalaciju to nije potrebno ponavljati pri svakom deployu.

## Servisi i konfiguracija

| Jedinica ili datoteka | Namjena |
| --- | --- |
| `k3s.service` | Kubernetes klaster i njegovi kontejneri |
| `ctf-buildkit.service` | Rootless BuildKit daemon |
| `ctf-runner.service` | FastAPI aplikacija |
| `ctf-runner-builds.service` | Zasebni worker za red poslova izgradnje |
| `ctf-runner-token.service` / `.timer` | Periodična obnova Kubernetes tokena |
| `/etc/ulovko/runner.env` | Centralna konfiguracija FastAPI-ja i build workera |
| `/etc/ulovko/runner.kubeconfig` | Ograničene Kubernetes vjerodajnice za `runner-api` ServiceAccount |
| `/var/lib/ctf-runner/builds` | Trajna stanja poslova, zapisnici i OCI arhive |

Runner koristi Kubernetes ServiceAccount `runner-system/runner-api` s RBAC pravilima iz `k8s/runner-api/access.yaml`. Kubeconfig se generira na runner VPS-u, ne šalje se u GitHub Secrets i obnavlja se pri objavi te periodično kroz systemd timer. Obnova tokena može ponovno pokrenuti FastAPI, ali ne i neovisni build worker.

Zaštićeni `/etc/ulovko/runner.env` generira Runner CD iz GitHub postavki. Obuhvaća API autentifikaciju, R2 vjerodajnice, mrežne postavke i `KUBECONFIG`; nove varijable treba dodavati u isti mehanizam, a ne ručno na VPS-u. Promjena samog GitHub secreta ne pokreće objavu. Kod promjene zajedničkog `RUNNER_API_TOKEN` potrebno je pokrenuti i Runner CD i Backend CD, uz moguć kratki prekid komunikacije dok se obje strane ne ažuriraju.

## Demonstracijski Kubernetes servisi

Demonstracijski HTTP i TCP servisi u `k8s/base/` služe za provjeru K3s mreže i Kubernetes konfiguracije; ne predstavljaju automatsku objavu slika proizvedenih build API-jem.

```bash
bash infra/runner-vps/scripts/deploy-demo.sh
bash infra/runner-vps/scripts/smoke-test.sh <VPS_IP>
bash infra/runner-vps/scripts/status.sh
```

Za uklanjanje demonstracijskih resursa bez brisanja klastera:

```bash
bash infra/runner-vps/scripts/remove-demo.sh
```

## Provjera i ograničenja

```bash
sudo systemctl status k3s --no-pager
sudo systemctl status ctf-buildkit.service --no-pager
sudo systemctl status ctf-runner.service --no-pager
sudo systemctl status ctf-runner-builds.service --no-pager
sudo systemctl status ctf-runner-token.timer --no-pager
sudo journalctl -u ctf-runner.service -n 100 --no-pager
sudo journalctl -u ctf-runner-builds.service -n 100 --no-pager
sudo journalctl -u ctf-buildkit.service -n 100 --no-pager
sudo k3s kubectl get nodes -o wide
sudo k3s kubectl -n ctf-demo get deployments,pods,services,ingresses
```

Kubernetes API na portu 6443 ne mora biti dostupan s interneta. Vanjski DNS, firewall i privatna veza između VPS-ova konfiguriraju se odvojeno; runner API treba biti dostupan samo ovlaštenom backendu. Grana `main`, GitHub production okruženje i privilegirani deployment workflow moraju biti zaštićeni jer mogu mijenjati RBAC i sistemske servise.

Za strukturu izazova, pristup Cloudflare R2, rute `/builds` i lokalno testiranje aplikacije pogledati [runner/README.md](../../runner/README.md).
