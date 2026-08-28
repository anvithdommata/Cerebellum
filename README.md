# Cerebellum Research Platform

A self-correcting, multi-engine investment research platform. Signal Engines
(Technical, Fundamental, Government & Policy, News/NLP, Social) each read
real market/filing/news data and emit a normalized [-1, 1] score. A
transparent weighted-ensemble meta-model ("Deep Cerebellar Nuclei") combines
them into return/volatility predictions per horizon (30/90/180/365 days).
Once a prediction's horizon matures, the Reflection loop ("Climbing Fibers" +
"Synaptic Plasticity") scores it against the realized outcome and adjusts
each engine's sector weight accordingly — so engines that are actually right
gain influence over time, and ones that aren't lose it.

Full design spec (the original 12-month vision this implements a working
slice of): see `docs/`.

## What's actually implemented

- **5 of the 12 originally-specified Signal Engines**: Technical, Fundamental,
  Government & Policy, News/NLP (Gemini-scored sentiment), and Social
  (architecture-complete but stubbed — see below).
- **SQLite storage** (Node's built-in `node:sqlite`, zero extra install) —
  see `docs/04_DATABASE.md` for the "real" Postgres schema this mirrors.
- **A weighted-linear meta-model** with exact, additive attribution per
  engine (not approximated SHAP) — see `src/server/metamodel/dcn.ts` for why.
- **The full self-correction loop**: Climbing Fibers (outcome scoring) +
  Synaptic Plasticity (EWHA weight updates, `docs/06` section 3.1) + a Mistake
  Journal for >3σ misses.
- **A historical backfill/backtest**: pulls years of daily prices +
  fundamentals, then walks forward week-by-week generating real historical
  predictions and running them through the reflection loop as they mature.
- **An in-app Settings tab** for entering API keys (writes to `.env.local`,
  applied live, never re-displayed).

## Not yet built

- The other 7 engines from `docs/02` (Insider Trading, Theme Inception,
  Historical Analogs, Expert/Developer Network, Public Figures, SEC EDGAR
  text/drift analysis, Thesis DAG).
- A live Social engine — Reddit/X APIs require paid/app-registered
  credentials that weren't available; the engine is fully wired to
  `social_sentiment_stream` and will start scoring the moment something
  writes real rows there.
- Postgres/partitioning, SHAP-based (vs. exact-linear) explainability,
  purged/embargoed walk-forward CV, brokerage integrations — all still
  Postgres/GBDT-era ideas in `docs/` that this SQLite/TS implementation
  intentionally simplified. See inline comments in `src/server/metamodel/`
  and `src/server/db/schema.ts` for the specific tradeoffs.

## Price data: multi-source with Stooq bulk base

Prices come from a tiered fallback chain, ordered cheapest-first so scarce
API quota is only spent when necessary:

1. **Stooq bulk files** (offline, in the DB from the local importer) — the base
   layer for deep history, zero API cost.
2. **FMP** (250/day) — primary API for covered tickers + recent-day updates.
3. **Alpha Vantage** (25/day) — all-ticker fallback, reserved for tickers
   nothing cheaper covers.
4. **Finnhub** — only used if you supply a paid key (free-tier candles 403).

Two efficiency mechanisms keep API usage low: **incremental fetch** (only bars
newer than the latest already stored — so re-running PRICES is nearly free once
backfilled) and **per-ticker source memory** (tries the provider that worked
last time first).

### One-time Stooq bulk import (all US tickers, full history)

1. Download the Stooq daily US bundle (`d_us_txt`) and **extract the .zip** —
   you'll get a folder tree of per-ticker `.txt` files.
2. From the project root, run the importer, pointing at the extracted folder:

   ```powershell
   node scripts/importStooq.mjs ".\Stooq Data\d_us_txt" ".\data\cerebellum.db"
   ```

   This loads every ticker's full daily history (~3 GB, 10–30 min). Bulk-imported
   tickers are marked inactive; **activate the ones you want to analyze in the
   Tickers tab** (activating also enriches the name/CIK from SEC and, because the
   history is already present, triggers no price API calls).

## Run locally

**Prerequisites:** Node.js **22.5+** (for `node:sqlite`).

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Go to the **Settings** tab and add API keys —
at minimum, **FMP** (prices/fundamentals) and a compliant **SEC User-Agent**
string. Gemini (News sentiment), SAM.gov, and Congress.gov are optional; the
engines that depend on them just report zero confidence until configured,
never a fabricated score.

Then, from the **Ingestion** tab, trigger **PRICES** to backfill daily price
history, then **FMP** for fundamentals. Or, to bootstrap the whole
self-correcting loop against years of real historical data in one shot:

```bash
curl -X POST http://localhost:3000/api/pipeline/backfill -H 'Content-Type: application/json' -d '{"years": 5}'
```

This runs in the background — poll `GET /api/ingestion/status` (the
`PIPELINE` entry) for progress. It can take a couple of minutes for 5 years
of weekly-cadence simulation across all tracked tickers.

Once you have history, `POST /api/pipeline/run` runs one live inference +
reflection cycle for today, and `GET /api/predictions/:ticker`,
`GET /api/weights`, and `GET /api/hypothesis-ledger` are there to inspect
results (a dedicated frontend for these is the natural next step — currently
they're API-only).
