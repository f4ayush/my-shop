# My Pharmacy — online store

Next.js 15 (App Router, TypeScript) + Tailwind CSS 4 + Prisma 6 + PostgreSQL 16.

## Requirements
- Node.js 20.9+ (22 LTS recommended)
- Docker Desktop (for the local Postgres)

## First-time setup
```bash
cp .env.example .env      # local dev values only
npm run db:up             # start Postgres on 127.0.0.1:5432
npm install               # also runs prisma generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev               # http://localhost:3000
```

## Scripts
| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run typecheck` | TypeScript check |
| `npm run db:up` / `db:down` | Start / stop the Postgres container |
| `npm run db:migrate` | Create & apply a migration from `prisma/schema.prisma` |
| `npm run db:seed` | Load sample data (idempotent) |
| `npm run db:studio` | Browse the database in Prisma Studio |

## Notes
- Prices are stored in **paise** (integers).
- Seed products, drug schedules and GST rates are **samples** — confirm real values with your pharmacist/CA.
- Schedule X items must never be sold online.
