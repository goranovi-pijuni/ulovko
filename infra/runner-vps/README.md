# Ulovko runner VPS provisioning

Konfiguracija zasebnog VPS servera za pokretanje CTF zadataka pomoću K3s klastera i FastAPI Challenge Runnera. K3s i FastAPI pokreću se kao zasebni systemd servisi. Demonstracijski HTTP i TCP servisi služe za provjeru infrastrukture.

## Preduvjeti

- VPS koji koristi Linux sa systemd i root pristupom (Debian/Ubuntu; lokalno testiranje moguće i na Arch Linuxu)
- Instaliran `curl`, Git i pristup internetu; `provision.sh` po potrebi instalira dodatne alate
- TCP port 22 za SSH pristup
- SSH javni ključ za GitHub Actions objavu, kao i kod `app-vps` instalacije
- Zaštićena mrežna veza od aplikacijskog VPS-a do runner API-ja (privatna mreža ili WireGuard)

## Prva instalacija

1. Generirati ključ za GitHub Actions (može se koristiti i postojeći ključ, ali zaseban je preporučen):

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/ulovko-runner-deploy -C ulovko-runner-ci
   ```

   Javni ključ (`.pub`) **ne** dodaje se u Git. Prenijeti ga jednokratno na runner VPS, kao što je učinjeno za aplikacijski VPS. Primjer, ako se za inicijalno postavljanje koristi root SSH pristup:

   ```bash
   scp ~/.ssh/ulovko-runner-deploy.pub root@<RUNNER_VPS>:/root/ulovko-runner-deploy.pub
   ```

2. Preuzeti Git repozitorij na runner VPS i iz korijena repozitorija pokrenuti:

   ```bash
   sudo bash infra/runner-vps/provision.sh --deploy-key /root/ulovko-runner-deploy.pub
   ```

   `--deploy-key` radi jednako kao na `app-vps`: skripta kopira javni ključ u `/home/deploy/.ssh/authorized_keys`. Pri kasnijem ponovnom pokretanju `provision.sh` argument se može izostaviti; postojeći `authorized_keys` ostaje nepromijenjen. Nema dodatnog `deploy.pub` u repozitoriju.

   Skripta instalira ili provjerava K3s, čeka spremnost klastera, primjenjuje `access.yaml`, instalira `uv`, stvara korisnike `deploy` i `ctf-runner`, postavlja systemd servise i automatsku obnovu Kubernetes tokena. FastAPI se ne pokreće prije prve objave koda.

3. U GitHub Actions okruženju **production** konfigurirati sljedeće Secrets:

   | Naziv | Vrijednost |
   | --- | --- |
   | `RUNNER_DEPLOY_HOST` | Adresa runner VPS-a za SSH |
   | `RUNNER_DEPLOY_SSH_KEY` | Privatni ključ iz koraka 1 |
   | `RUNNER_DEPLOY_KNOWN_HOSTS` | Provjeren SSH host ključ runner VPS-a |
   | `RUNNER_API_TOKEN` | Zajednički nasumični token za backend i FastAPI (`openssl rand -hex 32`) |
   | `APP_ENV` | Cjelokupna konfiguracija aplikacijskog backenda u formatu `KEY=value` (npr. baza, OIDC, R2, `NODE_ENV`); bez `RUNNER_API_TOKEN` i `RUNNER_API_URL` |

   Host ključ potrebno je provjeriti neovisno prije spremanja u `known_hosts`.

4. U istom okruženju konfigurirati GitHub Actions Variables:

   | Naziv | Vrijednost |
   | --- | --- |
   | `RUNNER_BIND_HOST` | Privatna IP adresa runner VPS-a ili `127.0.0.1` za lokalni pristup (zadano) |
   | `RUNNER_API_URL` | URL koji backend koristi za kontakt s runner API-jem, uključujući `:8000` ako je potrebno |
   | `RUNNER_TCP_HOST` | Javni TCP hostname, npr. `tcp.chal.ulovko.fun` (opcionalno) |
   | `RUNNER_HTTP_SCHEME` | `http` ili `https` (opcionalno; bez vrijednosti koristi se TLS konfiguracija Ingressa) |

   Runner API ne treba izlagati javnom internetu. HTTP je prihvatljiv samo preko zaštićene privatne veze; inače koristiti TLS. Postavljanje privatne veze i vanjskog firewalla ovisi o VPS pružatelju i nije dio ovog provisionera.

5. U GitHub Actions pokrenuti **Runner CD** (`workflow_dispatch`) ili spojiti promjene runnera na `main`. CI provjerava Python i infrastrukturu; CD prenosi kod, instalira ovisnosti iz `uv.lock`, obnavlja Kubernetes token, ponovno pokreće FastAPI i provjerava `/health` i `/nodes`.

6. Aplikacijski VPS koristi vlastiti `infra/app-vps/provision.sh`, koji instalira `infra/app-vps/ctf-backend.service`. U servisu se koristi jedna centralna datoteka za **sve** backend varijable:

   ```ini
   EnvironmentFile=-/opt/ctf/backend/.env
   ```

   Ako je aplikacijski VPS ranije provisioniran sa starom verzijom systemd jedinice, primijeniti ažurirani `app-vps` provisioning **jednom**. Nije potreban `ctf-backend.service.d`, dodatna skripta niti datoteka `runner.env` na aplikacijskom VPS-u.

   **Backend CD** pri svakoj objavi sastavlja `/opt/ctf/backend/.env`: najprije puni sadržaj GitHub secreta `APP_ENV`, zatim dodaje zajednički `RUNNER_API_TOKEN` i `RUNNER_API_URL` iz odgovarajućih GitHub postavki. Time se može dodavati konfiguracija baze, prijave, R2 i budućih integracija bez zasebnih `.env` datoteka. Izmjena `APP_ENV` mora sadržavati sve varijable koje backend treba; ovo nije inkrementalni merge s prethodnom datotekom.

## Demonstracijski servisi

Postaviti demonstracijske HTTP i TCP servise:

```bash
bash infra/runner-vps/scripts/deploy-demo.sh
```

Provjeriti rade li servisi:

```bash
bash infra/runner-vps/scripts/smoke-test.sh <VPS_IP>
```

Skripta provjerava HTTP odgovor na portu 80 i TCP komunikaciju na portu 30080. Za prikaz stanja klastera:

```bash
bash infra/runner-vps/scripts/status.sh
```

## Automatska objava

`runner-ci.yml` provjerava Python kod (`uv`, Ruff, testovi; `ruff` i `pytest` trebaju biti u razvojnim ovisnostima `runner/pyproject.toml`) i infrastrukturu (Bash, ShellCheck, Kustomize). Kod promjena aplikacije, RBAC-a, skripti za objavu ili systemd jedinica, nakon uspješnog CI automatski se pokreće `runner-deploy.yml`.

Runner CD prenosi Python kod izravno u `/opt/ctf/runner`, a `deploy.sh` instalira ovisnosti pomoću `uv sync --locked --no-dev`, postavlja konfiguraciju, obnavlja Kubernetes token i ponovno pokreće `ctf-runner.service`. Virtualno okruženje `/opt/ctf/runner/.venv` ostaje sačuvano prilikom prijenosa koda. Postupak je namjerno jednak objavi backenda: nema mapa `staging`, `releases` niti poveznice `current`. U slučaju neuspješne objave GitHub Actions javlja pogrešku; automatski povrat na prethodno izdanje nije predviđen, nego je potrebno vratiti promjenu u Gitu i ponovno objaviti. Promjene K3s instalacijske konfiguracije **ne** primjenjuju se automatski jer mogu utjecati na cijeli klaster.

Ako je VPS već provisioniran starijom verzijom koja koristi `staging`, `releases` i `current`, jednom ponovno pokrenuti ažurirani `provision.sh` kako bi se instalirao novi privilegirani `deploy.sh`. Ovo nije potrebno za novu instalaciju.

Runner koristi `/etc/ulovko/runner.env` za **sve svoje** varijable, a backend koristi samo `/opt/ctf/backend/.env` za **sve svoje** varijable. Kubernetes kubeconfig je zasebna datoteka jer sadrži pristupne podatke za Kubernetes API. Sadržaj env datoteka dolazi iz GitHub Actions postavki; nijedna se ne stavlja u `dist/` koji se zamjenjuje pri svakoj objavi.

`RUNNER_API_TOKEN` zajednički je GitHub Actions secret. Promjena secreta sama po sebi ne pokreće deploy; za rotaciju zajedničkog tokena pokrenuti i Runner CD i Backend CD. Budući da aplikacije zasad prihvaćaju jedan token, tijekom takve promjene moguć je kratki prekid komunikacije.

FastAPI koristi ograničeni Kubernetes ServiceAccount `runner-system/runner-api`. Token se izdaje kroz TokenRequest API pri svakoj objavi i automatski obnavlja systemd timerom. Token i kubeconfig ostaju na runner VPS-u; ne prenose se u GitHub Secrets. Obnova ponovno pokreće FastAPI jer se Kubernetes klijent konfigurira pri pokretanju procesa; buduće dugotrajne build operacije treba izdvojiti iz procesa API-ja.

**Sigurnost:** zaštititi granu `main`, produkcijsko GitHub Actions okruženje i pristup secretima. Odobrena runner objava ima široke ovlasti jer može ažurirati Kubernetes RBAC i privilegirane pomoćne skripte.

## Što izmjenjuje

- Instalira native K3s ako već nije instaliran
- Postavlja `infra/runner-vps/k3s/config.yaml` na `/etc/rancher/k3s/config.yaml`
- Provjerava spremnost K3s klastera i primjenjuje namespace te runner RBAC
- Instalira `uv` i Linux korisnike `deploy` i `ctf-runner`
- Na zahtjev `--deploy-key` instalira SSH javni ključ u `/home/deploy/.ssh/authorized_keys`
- Postavlja systemd jedinice `ctf-runner.service` i `ctf-runner-token.*`
- Ograničava `sudo` pristup deployment korisnika na `/usr/local/sbin/ctf-runner-deploy`
- Prenosi aplikaciju u `/opt/ctf/runner`, instalira ovisnosti i generira runner konfiguracijske datoteke

Ako je K3s već instaliran, skripta ga neće ponovno instalirati. Ako se postojeći `config.yaml` razlikuje od konfiguracije u repozitoriju, skripta prekida izvođenje kako ne bi nenamjerno promijenila postojeći klaster.

## Provjera i ograničenja

```bash
sudo systemctl status k3s
sudo systemctl status ctf-runner.service
sudo systemctl status ctf-runner-token.timer
sudo journalctl -u ctf-runner.service -n 100 --no-pager
sudo journalctl -u ctf-runner-token.service -n 100 --no-pager

sudo k3s kubectl get nodes -o wide
sudo k3s kubectl -n ctf-demo get deployments,pods,services,ingresses

bash infra/runner-vps/scripts/smoke-test.sh <VPS_IP>
```

Za uklanjanje demonstracijskih servisa:

```bash
bash infra/runner-vps/scripts/remove-demo.sh
```

Kubernetes API nije potrebno javno izlagati. Port 6443 može ostati zatvoren prema internetu dok se klasterom upravlja lokalno na VPS-u. Vanjski DNS i firewall konfiguriraju se odvojeno, a izrada i pokretanje stvarnih CTF zadataka slijede u idućoj fazi runnera.
