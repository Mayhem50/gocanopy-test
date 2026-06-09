# GoCanopy Test

Monorepo TypeScript/Node.js avec Turbo pour le serveur HTTP, le front Vite et les modules `bank`, `scan`, `projection` et `models`.

## Prerequisites

- Node.js `24` (`.nvmrc`)
- `pnpm` `10.14.0`
- Docker Desktop ou un Docker Engine compatible

## Installation

```bash
pnpm install
cp .env.example .env
```

Les variables de `.env.example` pointent toutes vers le PostgreSQL local exposé par `docker-compose.yml` sur `127.0.0.1:5433`, et vers l'API locale sur `http://127.0.0.1:9080`.

## Tout demarrer

La commande la plus simple est :

```bash
pnpm dev
```

Cette commande :

1. demarre PostgreSQL avec Docker
2. applique le schema Drizzle sur la base locale
3. lance l'API `@gocanopy/server` sur `http://127.0.0.1:9080`
4. lance le front `@gocanopy/web`

Une fois lance :

- front: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:9080`
- healthcheck API: `http://127.0.0.1:9080/health`

## Demarrage manuel

Si tu veux separer l'infra, l'API et le front :

```bash
pnpm infra:start
pnpm db:migrate
pnpm server:dev
pnpm web:dev
```

Arret de l'infra :

```bash
pnpm infra:stop
```

## Verification

Pour verifier le repo complet :

```bash
pnpm verify
```

Ou, commande par commande :

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
