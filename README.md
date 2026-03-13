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
 - Draws run immediately with hourly randomized payouts (no initial buyback).
 - Hourly possible draws from holder snapshot
  - 50/50 branch:
    - Weighted holder draw, or
    - Silent split distribution to team wallets (`Torbor`, `Peachie`, `Jesse`) in a single transaction
  - ORAO VRF randomness
  - SOL prize transfer with proof memo (uses full payer balance minus reserve)
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

- `FORCE_SHOW_COUNTDOWN=true` shows the `Next chance of jackpot` timer in all environments.
- Set `FORCE_SHOW_COUNTDOWN=false` if you want the timer hidden.

## Transaction Simulation Mode

- `SIMULATE_TRANSACTIONS=true` enables simulation-only mode for on-chain transaction execution paths.
- In simulation mode, the app simulates transactions and returns simulated signatures instead of broadcasting.

## Split Distribution Config

- `TEAM_WALLET_TORBOR`, `TEAM_WALLET_PEACHIE`, `TEAM_WALLET_JESSE` configure backend-only split recipients.
- `SPLIT_DISTRIBUTION_LAMPORTS` controls total lamports split evenly across those 3 wallets.
- Split branch is intentionally not recorded in draw history.

## Pumpfun Creator Fee Claim

- `PUMPFUN_CLAIM_ENABLED` toggles creator fee claim before each cycle.
- `PUMPFUN_PRIORITY_FEE_SOL` sets the priority fee for the claim transaction.
- `PUMPFUN_CLAIM_POOL` sets the pool for creator fee claims (`pump`, `pump-amm`, `auto`, or `meteora-dbc`).
- `PUMPFUN_CLAIM_MINT` optionally overrides which mint to claim; defaults to `TOKEN_MINT`.
- `PUMPFUN_CLAIM_PROVIDER` selects `sdk` (default) or `portal`.
- `PUMPFUN_CLAIM_MODE` selects `collect` (default) or `distribute` (fee sharing).

## VRF Settings

- `VRF_REQUIRED=true` enforces ORAO VRF; set to `false` to allow fallback randomness if VRF fails.
- `MAINNET_WSS_ENDPOINT` should be a WebSocket endpoint for your RPC (required for ORAO VRF fulfillment on providers that don’t support WS on the HTTP URL).

## Deployer Burn Reserve

- `DEPLOYER_TOKEN_RESERVE_UI` keeps this many tokens in the deployer ATA (UI amount, not raw).
- Any deployer token balance above this reserve is burned on each cron cycle.

## Burn Tracker Config

- Burned amount is calculated as `1,000,000,000 - current mint supply` (mint-decimal aware).
- Burn trigger ladder: first at `10,000`, then increments grow by `+50,000` each trigger
  (`10k`, `60k`, `160k`, `310k`, ...).

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

## Cron Claim (every 15 minutes)

```text
*/15 * * * * /api/cron-claim?secret=$CRON_SECRET
```

## Manual Claim (dev)

```bash
curl "https://your-domain.com/api/cron-claim?manual=YOUR_MANUAL_TRIGGER_SECRET"
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
- Set `RESERVE_LAMPORTS_FOR_FEES` to `0.1 SOL` to retain fees.
