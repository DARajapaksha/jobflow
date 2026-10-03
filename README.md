# Jobflow

Job board with employer and job-seeker roles. React + Node.js/Express + PostgreSQL.
See [docs/DESIGN.md](docs/DESIGN.md) for architecture, UML, schema, API and wireframes.

## Local setup

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Configure and run the API
cd server
cp .env.example .env
npm install
npm run migrate      # create tables
npm run seed         # demo data
npm run dev          # http://localhost:5000/api/health
```

Demo logins (dev only), password `Password123!`:
`employer@jobflow.dev`, `employer2@jobflow.dev`, `seeker@jobflow.dev`

Reset everything: `npm run db:reset`
