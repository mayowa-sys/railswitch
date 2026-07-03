# Merchant Dashboard

Next.js app for managing subscriptions, plans, customers, and viewing revenue metrics.

## Getting Started

```bash
npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- Overview with MRR, ARR, churn rate, recovery rate
- Plans management (CRUD)
- Customers list with search
- Subscriptions with lifecycle actions (pause, resume, cancel)
- Invoice history
- Audit log with live polling
- Failed payment queue
- Webhook management
- Settings with API key display

## Configuration

Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ENGINE_URL=http://localhost:3001
```

## Demo

Run `python3 scripts/seed-demo.py` to populate with FitCore Nigeria demo data (250 customers, 5 plans, 250 subscriptions).

Login: `demo@railswitch.dev` / `demo123456`
