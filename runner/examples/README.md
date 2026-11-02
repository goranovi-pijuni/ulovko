# Primjeri CTF zadataka

`demo-challenge/` je ogledni paket za razvoj Ulovko Challenge Runnera. Sadrži dva servisa i zasebne Docker build kontekste; opis konfiguracije, API-ja i načina izgradnje nalazi se u [runner/README.md](../README.md).

```text
demo-challenge/
├── config.yaml
├── public/
│   └── README.md
└── deploy/
    ├── web1/
    │   ├── .dockerignore
    │   ├── Dockerfile
    │   └── server.py
    └── test/
        ├── .dockerignore
        ├── Dockerfile
        └── server.py
```

`config.yaml` opisuje HTTP servis `web1` na portu 8080 i TCP servis `test` na portu 5000. Svaki servis ima vlastiti build kontekst unutar `deploy/`, pa datoteke drugog servisa nisu dio njegove izgradnje. `public/` je namijenjen igračima; runner njime ne upravlja i ne uključuje ga u slike. Podaci o flagovima ne nalaze se u runner konfiguraciji.

## Pokretanje bez kontejnera

HTTP servis koristi samo Python standardnu biblioteku:

```bash
python3 runner/examples/demo-challenge/deploy/web1/server.py
```

U drugom terminalu provjeriti:

```bash
curl -f http://127.0.0.1:8080/health
curl -f http://127.0.0.1:8080/
```

TCP servis pokrenuti zasebno:

```bash
python3 runner/examples/demo-challenge/deploy/test/server.py
```

Na port 5000 može se spojiti pomoću `nc`.

## Izgradnja i prijenos na R2

Iz direktorija `runner/` izgraditi obje OCI arhive pomoću instaliranog rootless BuildKita:

```bash
uv run python -m runner.services.builder examples/demo-challenge
```

Za ispitivanje build API-ja potrebno je pripremiti dvije R2 datoteke. Iz direktorija `runner/examples/demo-challenge/` zapakirati samo `deploy/`:

```bash
zip -qr deploy.zip deploy/
```

Runneru su za čitanje dovoljni R2 S3 ključevi s pravom Object Read; prijenos datoteka na R2 obavlja se zasebnim ovlaštenjem. Nakon prijenosa posao se pokreće putem `POST /builds`, kao što je opisano u [runner/README.md](../README.md).
