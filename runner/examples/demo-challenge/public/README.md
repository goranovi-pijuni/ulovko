# Demonstracijski CTF zadatak

Ovaj zadatak služi za provjeru izgradnje i pokretanja CTF servisa.

Dostupna su dva servisa:

- **web1 (HTTP):** početna stranica vraća `CTF HTTP demo OK`, a `/health` vraća `ok`.
- **test (TCP):** nakon spajanja šalje `CTF TCP demo OK`, a zatim vraća primljene podatke (echo).
