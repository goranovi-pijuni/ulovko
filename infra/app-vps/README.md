# Ulovko app VPS provisioning

Konfiguracija VPS servera za 

## Preduvjeti

- VPS koji koristi Debian/Ubuntu (za apt) sa systemd i root pristupom
- Par SSH ključeva za github actions
- DNS za `api.ulovko.fun` usmjeren prema VPS-u
- NestJS backend postavljen na `127.0.0.1:3000`
- TCP portovi 22, 80, 443 dopušteni u firewallu

## Prva instalacija

1. Preuzeti git repozitorij na VPS
2. Generirati SSH par ključeva za GitHub Actions, primjer lokanog generiranja:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/ulovko_actions -N ''
   scp ~/.ssh/ulovko_actions.pub root@VPS_IP:/root/ulovko_actions.pub
   ```

3. Na VPS-u iz repozitorija:

   ```bash
   sudo bash infra/app-vps/provision.sh --deploy-key /root/ulovko_actions.pub
   ```

   Istu komandu moguće je pokrenuti više puta

4. Konfiguracija GitHub Actions secrets:
   - `DEPLOY_HOST`: VPS IP ili hostname
   - `DEPLOY_SSH_KEY`: **privatni ključ** `~/.ssh/ulovko_actions`
   - `DEPLOY_KNOWN_HOSTS`: Konfiguracija known hosts prema javnom ključu VPS-a

## Što izmijenjuje

- Instalirava Node.js 22, Caddy, Git, rsync, i SSH
- Postavlja usere `deploy` i `ctfapi`
- Postavlja `/opt/ctf/backend` za `deploy` usera.
- Dozvoljava `deploy` da pokrene `systemctl restart/is-active ctf-backend.service` pomoću sudo bez lozinke.
- Instalirava `ctf-backend.service` i Caddyfile.
- Omogućuje Caddy, konfigurira UFW, i omogućuje pokretanje backend servisa

Caddy file prepisuje postojeći ali ga sprema kao `Caddy.pre-ulovko` za backup

## Provjera i ograničenja

```bash
sudo systemctl status ctf-backend caddy
sudo journalctl -u ctf-backend -f
sudo journalctl -u caddy -f
sudo caddy validate --config /etc/caddy/Caddyfile
curl -i https://api.ulovko.fun/api
```

Ako backend nije postavljen Caddy će vratiti status 502.

GitHub Actions deploy workflow uploada `backend/dist`, `backend/package.json`, i `backend/package'lock.json` u `/opt/ctf/backend` kroz user `deploy` te restart-a `ctf-backend.service`

Skripta ne postavlja DNS, GitHub Actions secrets, vanjski firewall stoga je potrebno manualno postaviti
