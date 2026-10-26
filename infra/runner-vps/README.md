# Ulovko runner VPS provisioning

Konfiguracija zasebnog VPS servera za pokretanje CTF zadataka pomoću K3s klastera. Trenutačno uključuje demonstracijske HTTP i TCP servise.

## Preduvjeti

- VPS koji koristi Linux sa systemd i root pristupom (testirano na Debian/Ubuntu)
- Instaliran `curl` i pristup internetu
- TCP port 22 za SSH pristup

## Prva instalacija

1. Preuzeti git repozitorij na runner VPS

2. Na VPS-u iz korijena repozitorija pokrenuti:

   ```bash
   sudo bash infra/runner-vps/provision.sh
   ```

   Skripta instalira K3s i čeka da klaster bude spreman. Istu komandu moguće je pokrenuti više puta ako postojeća konfiguracija nije promijenjena.

3. Postaviti demonstracijske HTTP i TCP servise:

   ```bash
   bash infra/runner-vps/scripts/deploy-demo.sh
   ```

4. Provjeriti rade li servisi:

   ```bash
   bash infra/runner-vps/scripts/smoke-test.sh <VPS_IP>
   ```

   Skripta provjerava HTTP odgovor na portu 80 i TCP komunikaciju na portu 30080.

5. Za prikaz stanja klastera:

   ```bash
   bash infra/runner-vps/scripts/status.sh
   ```

## Što izmjenjuje

- Instalira native K3s ako već nije instaliran
- Postavlja konfiguraciju `infra/runner-vps/k3s/config.yaml` na `/etc/rancher/k3s/config.yaml`
- Omogućuje K3s systemd servis kroz službeni instalacijski postupak
- Provjerava je li K3s aktivan i čeka da Kubernetes čvor bude spreman

Ako je K3s već instaliran, skripta ga neće ponovno instalirati. Ako se postojeći `config.yaml` razlikuje od konfiguracije u repozitoriju, skripta prekida izvođenje kako ne bi nenamjerno promijenila postojeći klaster.

Demonstracijski servisi postavljaju se zasebnom skriptom `deploy-demo.sh` koja koristi Kubernetes manifeste iz `infra/runner-vps/k8s/base`.

## Provjera i ograničenja

```bash
sudo systemctl status k3s
sudo journalctl -u k3s -n 100 --no-pager

sudo k3s kubectl get nodes -o wide
sudo k3s kubectl -n ctf-demo get deployments,pods,services,ingresses

bash infra/runner-vps/scripts/smoke-test.sh <VPS_IP>
```

Za uklanjanje demonstracijskih servisa:

```bash
bash infra/runner-vps/scripts/remove-demo.sh
```

Skripta uklanja demonstracijske deploymente, servise i ingress, ali ostavlja K3s klaster i namespace `ctf-demo`.

Kubernetes API nije potrebno javno izlagati. Port 6443 može ostati zatvoren prema internetu dok se klasterom upravlja lokalno na VPS-u.

Skripta ne postavlja DNS, vanjski firewall niti produkcijski Challenge Runner. Trenutačno služi za uspostavljanje i provjeru osnovne Kubernetes infrastrukture.

GitHub Actions `runner-ci.yml` provjerava shell skripte i Kustomize manifeste. Automatska objava na runner VPS trenutačno nije konfigurirana.
