# JackpotEx

Provably fair weighted random holder draw website for a specific SPL token.

## Stack

- Next.js 16 (App Router, TypeScript, RSC)
- Solana Web3 + SPL Token + SPL Memo
- ORAO VRF
- Jupiter v6 (`@jup-ag/api`)
- GitHub Gist (Octokit)
- Vercel KV

## What It Does

- Informational homepage only (no trigger buttons).
- Shows token/project info and last 10 completed draws.
- First draw is one-time initial buyback:
  - Uses payer SOL balance minus `RESERVE_LAMPORTS_FOR_FEES`
  - Swaps SOL -> target token via Jupiter
  - Sends all bought tokens to `ALON_PUBKEY` with memo
- After initial round:
  - Hourly possible draws from holder snapshot
  - 50/50 branch:
    - Weighted holder draw, or
    - Silent split distribution to team wallets (`Torbor`, `Peachie`, `Jesse`) in a single transaction
  - ORAO VRF randomness
  - SOL prize transfer with proof memo
  - Stores draw result in KV
  - Snapshot stored in public Gist for verification
  - Burn tracker refreshed every 30 minutes (cached) for forced-jackpot progress

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment file:
   ```bash
   cp .env.example .env
   ```
3. Fill required env values in `.env`.
4. Run dev server:
   ```bash
   npm run dev
   ```

## Tests

Run full test suite:

```bash
npm test
```

The tests mock network + Solana side effects and validate flow logic without sending on-chain transactions.

## KV Modes (Local Dev vs Vercel)

`lib/kv.ts` supports three modes via `KV_MODE`:

- `KV_MODE=auto` (default): uses local file storage in non-production or when KV env vars are missing; uses Vercel KV when available in production.
- `KV_MODE=local`: always use local file storage.
- `KV_MODE=remote`: always use Vercel KV (fails if KV env vars are not configured).

Local file storage path:
- `.local-kv/jackpotex-kv.json`

Typical local development:
- Keep `KV_MODE=auto` or set `KV_MODE=local` in `.env`.

Typical Vercel production:
- Keep `KV_MODE=auto` and configure Upstash/Vercel KV integration env vars.

## Countdown Toggle

- `FORCE_SHOW_COUNTDOWN=true` shows the `Next chance of jackpot` timer even before initial round completes.
- Set `FORCE_SHOW_COUNTDOWN=false` in production if you only want countdown visible after initial round.

## Transaction Simulation Mode

- `SIMULATE_TRANSACTIONS=true` enables simulation-only mode for on-chain transaction execution paths.
- In simulation mode, the app simulates transactions and returns simulated signatures instead of broadcasting.

## Initial Buyback Swap Amount

- `INITIAL_BUYBACK_SWAP_LAMPORTS` controls how much SOL is swapped in the one-time initial buyback.
- The value is capped by available payer balance after reserve: `balance - RESERVE_LAMPORTS_FOR_FEES`.

## Split Distribution Config

- `TEAM_WALLET_TORBOR`, `TEAM_WALLET_PEACHIE`, `TEAM_WALLET_JESSE` configure backend-only split recipients.
- `SPLIT_DISTRIBUTION_LAMPORTS` controls total lamports split evenly across those 3 wallets.
- Split branch is intentionally not recorded in draw history.

## Burn Tracker Config

- Burn stats are cached in KV/local store and refreshed every 30 minutes.
- Burned amount is calculated as `1,000,000,000 - current mint supply` (mint-decimal aware).
- Burn trigger ladder is fixed: first at `10,000`, then every `50,000` tokens (`50k`, `100k`, `150k`, ...).

## Deploy On Vercel

1. Push repo to GitHub.
2. Import repo in Vercel.
3. Add environment variables from `.env.example` in Vercel Project Settings.
4. Deploy.

`vercel.json` already includes hourly cron:
- Schedule: `0 * * * *`
- Target: `/api/cron-draw?secret=$CRON_SECRET`

## Manual Trigger (dev)

```bash
curl "https://your-domain.com/api/cron-draw?manual=YOUR_MANUAL_TRIGGER_SECRET"
```

## Draw Verification

### Option A: Verify from draw JSON record

```bash
npm run verify:draw -- --draw ./regular-draw.json --expectedWinner <winner-pubkey>
```

### Option B: Verify from snapshot + random hex

```bash
npm run verify:draw -- \
  --snapshot https://gist.githubusercontent.com/.../snapshot.json \
  --randomHex <randomValueHex> \
  --expectedWinner <winner-pubkey>
```

The script re-sorts by owner (same as backend), recomputes weighted selection, and checks winner.

## Security Notes

- Never expose `PAYER_SECRET_KEY`, `CRON_SECRET`, `MANUAL_TRIGGER_SECRET`, `GITHUB_TOKEN` in client code.
- API route is protected by secret query params.
- Keep payer wallet minimally funded and rotate leaked secrets immediately.
