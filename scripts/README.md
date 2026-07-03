# Scripts

Operational scripts for local development and demos.

## `seed-demo.py`

Seeds the database with FitCore Nigeria demo data:

- 1 merchant (demo@railswitch.dev / demo123456)
- 5 plans (Basic, Pro, Elite, Corporate, Basic Legacy)
- 250 customers with backdated creation dates
- 250 subscriptions (240 active, 5 cancelled, 3 paused, 2 trialing)
- 80 payment methods
- Multi-month invoice history

```bash
python3 scripts/seed-demo.py
```

Requires: Docker running with `infra-postgres-1` container, gateway on port 8000.
