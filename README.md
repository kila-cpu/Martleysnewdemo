# Martley's staff app & workshop admin

- `/` — phone staff app (walk-around checks, defects, job sheets)
- `/admin/` — desktop admin (checks register, defects, workshop schedule and TV screen, job cards, parts & stock, customers, fleet, team, settings)

Demo PINs: staff app **1111**, admin **3333** (Mark, or Leanne, workshop manager).

## Run locally

```bash
python3 server.py 4331
```

Then open http://localhost:4331. No dependencies.

## Deploy on Railway

Railway picks up `railway.json` and starts `python3 server.py` on `$PORT`.

Data lives in `DATA_DIR` (default `./data`), which is wiped on every redeploy unless you
attach a **volume**: add one mounted at `/data` and set the variable `DATA_DIR=/data`.
On first start the data is created from `seed-state.json`; delete `state.json` in the
volume to reset the demo.
