# Primjeri CTF zadataka

`demo-challenge/` je ogledni paket za razvoj Ulovko Challenge Runnera.
Isti raspored datoteka koristit ce se za ZIP koji organizator salje na platformu:

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

`config.yaml` opisuje dva servisa. `path` je relativan direktoriju
`deploy/`, a `port` je unutarnji TCP port kontejnera. `http` koristi HTTP
usmjeravanje, dok `tcp` koristi izravni TCP pristup. Polje `flag.static`
trenutno je primjer konfiguracije; sam demo ne implementira zastavicu.

Svaki direktorij unutar `deploy/` predstavlja samostalan Docker build
context. Prilikom izgradnje imagea za `web1` ne smiju se kopirati datoteke
iz `test/`, i obratno. `public/` je namijenjen igracima i nikada se ne smije
automatski ukljuciti u Docker build context.

## Provjera bez Docker/BuildKit alata

Svaki server koristi iskljucivo standardnu Python biblioteku. Iz korijena
repozitorija moze se privremeno pokrenuti:

```bash
python3 runner/examples/demo-challenge/deploy/web1/server.py
```

U drugom terminalu:

```bash
curl -f http://127.0.0.1:8080/health
curl -f http://127.0.0.1:8080/
```

TCP servis:

```bash
python3 runner/examples/demo-challenge/deploy/test/server.py
```

U drugom terminalu spojiti se pomocu `nc` na port 5000.

