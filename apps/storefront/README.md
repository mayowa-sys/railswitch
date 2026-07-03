# Demo Storefront

Next.js app for live demo presentations. Simulates a real merchant checkout flow integrating with RailSwitch.

## Getting Started

```bash
npm install && npm run dev
```

Open [http://localhost:3200](http://localhost:3200).

## Features

- Product display with pricing
- Checkout flow with card tokenization
- Subscription creation via RailSwitch API
- Payment method management
- Invoice display

## Demo

Run `python3 scripts/seed-demo.py` first to set up the FitCore Nigeria demo data.

The storefront connects to the local gateway at `http://localhost:8000`.
