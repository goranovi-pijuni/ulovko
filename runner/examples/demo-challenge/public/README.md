# Demonstracijski CTF zadatak

Ovaj zadatak služi za provjeru izgradnje, pokretanja i komunikacije između CTF servisa u istom Kubernetes namespaceu.

- **web1 (javni HTTP, port 8080):** `/health` vraća `ok`, a početna stranica uspostavlja vezu prema privatnom servisu `test:5000` i prikazuje njegov pozdrav i echo odgovor.
- **test (privatni TCP, port 5000):** šalje `CTF TCP demo OK` i vraća primljene podatke; nema javni NodePort ni Ingress.

Otvorite javni URL za `web1` i potražite retke `web1 -> test:5000` i `test echoed: hello from web1`. Tako se provjerava da `web1` može pristupiti privatnom servisu po simboličkom imenu `test`.
