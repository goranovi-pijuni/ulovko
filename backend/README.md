# Upute za pokretanje backend-a:

## Instalacija ovisnosti
1. Instalirati node (provjeriti instalaciju naredbom "node -v" u terminalu)
2. Instalacija nestjs: pokrenuti terminal u ulovko projektu, upisati naredbu: nestjs: npm i -g @nestjs/cli

## Pokretanje backend projekta
- Otvoriti terminal i pozicionirati se u ulovko/backend
- Naredba npm run start:dev
		- aplikacija se pokreće na http://localhost:3000/api

## Izrada vlastitih modula
- Otvoriti terminal i pozicionirate se u ulovko/backend
- Redom pokrenuti naredbe (u navedenim naredbama, [ime] označuje ime novog modula):
	- nest g module [ime]
	- nest g controller [ime] 
	- nest g service [ime]
- Novi modul (zajedno s controllerom i service/providerom) pojavit će se u novom direktoriju unutar direktorija src
