## Pretpostavke vezane uz bazu podataka

### PermissionRequests
> Atribut verdictTime je nullable jer postoji mogućnost da administrator još uvijek nije došao do odluke za request. Dakle result = false i verdictTime = null bi bio slučaj gdje se verdict još čeka, a result = false i verdictTime = nekiDatum bi značilo da je verdict bio negativan.

### Challenges
> Atribut points je nullable jer zadatak ne mora nužno biti statički bodovan pa null implicira da će se za njega preko tablice Solutions računat dinamičko bodovanje.

### Competitions
> Atributi max, min i decay odnose se na parametre za računanje dinamičkog bodovanja. Način bodovanja zadataka danog natjecanja ne mora biti dinamičan pa su atributi nullable.
