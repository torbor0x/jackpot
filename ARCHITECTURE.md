# JackpotEx Architecture Documentation

## Overview

JackpotEx is a provably fair weighted random holder draw system for SPL tokens on Solana. It runs automated hourly draws where token holders can win SOL prizes, with optional team distribution splits.

## Core Components

### 1. Vercel KV Storage (`lib/kv.ts`)

**Purpose**: Persistent storage for draw records, burn statistics, and system state.

**Storage Modes**:
- `auto` (default): Uses local file storage in development, Vercel KV in production
- `local`: Always uses local file storage (`.local-kv/jackpotex-kv.json`)
- `remote`: Always uses Vercel KV (requires `KV_REST_API_URL` and `KV_REST_API_TOKEN`)

**Data Schema**:
```typescript
// Draw Records
- jackpotex-regular-draws: Array of RegularDraw | TeamDistributionDraw (last 9)
- jackpotex-initial-draw: InitialDraw | null (initial setup draw)
- initial-round-completed: boolean (tracks if initial draw happened)

// Burn Tracking
- jackpotex-burn-stats: BurnStats (cached burn statistics)
- jackpotex-burn-trigger-paid: number (last paid burn trigger level)

// Team Distribution
- jackpotex-team-distribution: TeamDistributionRecord (latest team split)
```

**Key Functions**:
- `getDraws()`: Retrieves combined draw history (initial + regular + team)
- `addDraw(draw)`: Adds new draw record, maintains max 9 regular draws
- `getBurnStatsCache()` / `setBurnStatsCache()`: Burn statistics caching
- `getBurnTriggerPaid()` / `setBurnTriggerPaid()`: Burn trigger tracking

### 2. Solana Integration (`lib/solana.ts`)

**Purpose**: Solana blockchain connection, wallet management, and VRF randomness.

**Configuration**:
- `MAINNET_ENDPOINT`: HTTP RPC endpoint (required)
- `MAINNET_WSS_ENDPOINT`: WebSocket RPC endpoint (required for VRF)
- `PAYER_SECRET_KEY`: Base58-encoded private key (required)
- `TOKEN_MINT`: SPL token mint address (required)
- `TOKEN_NAME`: Token display name (required)
- `JACKPOT_WEBSITE_URL`: Website URL for memos (required)
- `PRIZE_LAMPORTS`: Prize amount in lamports (required)
- `RESERVE_LAMPORTS_FOR_FEES`: SOL to reserve for transaction fees (required)
- `MIN_DISTRIBUTION_LAMPORTS`: Minimum balance required to run draws (default: 1 SOL)
- `SPLIT_DISTRIBUTION_LAMPORTS`: Amount for team splits (default: PRIZE_LAMPORTS)

**Key Functions**:
- `requestVrfRandomness(maxWaitMs)`: Requests randomness from ORAO VRF with fallback
- `toSol(lamports)`: Converts lamports to SOL string

**VRF Behavior**:
- Uses ORAO Network VRF for provable randomness
- Waits up to 60 seconds for fulfillment
- Falls back to crypto.randomBytes if `VRF_REQUIRED=false` and VRF fails
- Returns request transaction, fulfillment transaction, and random bytes

### 3. Holder Snapshot System (`lib/holders.ts`)

**Purpose**: Fetches and processes token holder balances for weighted random selection.

**Process**:
1. Queries all token accounts for the mint (supports both Token and Token-2022 programs)
2. Aggregates balances by owner address
3. Excludes specified wallets (e.g., liquidity pools)
4. Sorts by balance (descending), takes top 100 holders
5. Re-sorts alphabetically by owner for deterministic selection

**Key Functions**:
- `getHolderSnapshotByOwner(mint)`: Returns array of HolderWeight (owner, amountRaw)
- `pickWeightedWinner(snapshot, randomBytes)`: Selects winner using weighted random

**Selection Algorithm**:
```
totalWeight = sum of all holder balances
randomValue = randomBytes mod totalWeight
winner = first holder where cumulative balance >= randomValue
```

### 4. Distribution System (`lib/distribution.ts`)

**Purpose**: Handles team wallet distribution splits.

**Team Wallets**:
Configured via `TEAM_WALLETS` environment variable as a JSON array of wallet addresses.

Example with 3 team members:
```bash
TEAM_WALLETS=["wallet1_address","wallet2_address","wallet3_address"]
```

The system supports any number of team members (1 or more). If not set, it uses a default example with 3 wallets.

**Key Functions**:
- `splitLamportsEvenly(total, count)`: Splits lamports evenly with remainder distributed
- `buildSplitDistributionTransaction(total)`: Creates transfer transaction to team wallets
- `runSplitDistribution(total)`: Executes team distribution transaction
- `getTeamDistributionFromTx(signature)`: Parses completed distribution transaction

### 5. Pumpfun Integration (`lib/pumpfun.ts`)

**Purpose**: Claims creator fees from Pumpfun trading pools.

**Configuration**:
- `PUMPFUN_CLAIM_ENABLED`: Enable/disable claiming (default: true)
- `PUMPFUN_CLAIM_PROVIDER`: "sdk" or "portal" (default: sdk)
- `PUMPFUN_PRIORITY_FEE_SOL`: Priority fee in SOL (default: 0.000001)
- `PUMPFUN_CLAIM_POOL`: Pool name - "pump", "pump-amm", "auto", "meteora-dbc" (default: pump)
- `PUMPFUN_CLAIM_MINT`: Mint to claim (optional, defaults to TOKEN_MINT)
- `PUMPFUN_CLAIM_MODE`: "collect" or "distribute" (default: collect)
- `PUMPFUN_CREATOR_PUBLIC_KEY`: Creator wallet override (optional, defaults to payer)

**Claim Methods**:
1. **SDK Mode** (`sdk`): Uses `@pump-fun/pump-sdk` directly
   - Collect mode: Calls `collectCoinCreatorFeeInstructions`
   - Distribute mode: Calls `buildDistributeCreatorFeesInstructions`
2. **Portal Mode** (`portal`): Uses Pumpportal API
   - POST to `https://pumpportal.fun/api/trade-local`
   - Returns VersionedTransaction to sign and submit

**Key Functions**:
- `claimCreatorFees()`: Executes claim based on configured provider and mode
- `getCreatorRewardsBalanceLamports()`: Gets current vault balance
- `getMinimumDistributableFeeInfo()`: Gets distributable fee information

### 6. Burn Tracking (`lib/burn.ts`)

**Purpose**: Calculates and tracks token burn statistics for forced jackpot triggers.

**Burn Calculation**:
```
totalSupply = 1,000,000,000 tokens (fixed)
currentSupply = from mint account
burned = totalSupply - currentSupply
burnedPercent = (burned / totalSupply) * 100
```

**Trigger Ladder**:
```
Trigger 1: 10,000 tokens burned
Trigger 2: 60,000 tokens burned (+50,000)
Trigger 3: 160,000 tokens burned (+100,000)
Trigger 4: 310,000 tokens burned (+150,000)
Formula: threshold(n) = 10,000 + 50,000 * (n-1) * n / 2
```

**Key Functions**:
- `computeBurnedFromCurrentSupply()`: Calculates burn statistics
- `computeBurnTriggerWindow()`: Calculates progress to next trigger
- `getBurnStats(mint)`: Fetches and builds complete burn stats

### 7. Deployer Burn (`lib/deployer-burn.ts`)

**Purpose**: Burns excess tokens from deployer wallet on each draw cycle.

**Configuration**:
- `DEPLOYER_TOKEN_RESERVE_UI`: Tokens to keep in deployer ATA (UI amount, default: 0)

**Process**:
1. Gets deployer's token balance
2. Calculates burnable amount = balance - reserve
3. Creates and executes burn instruction if burnable > 0
4. Supports both Token and Token-2022 programs

### 8. Gist Integration (`lib/gist.ts`)

**Purpose**: Stores holder snapshots in public GitHub Gists for verification.

**Configuration**:
- `GITHUB_TOKEN`: GitHub personal access token (required)

**Key Functions**:
- `uploadSnapshotToGist(snapshot)`: Creates/updates public gist with snapshot JSON

**Gist Structure**:
- Public gist (anonymous or authenticated)
- Filename: `snapshot.json`
- Contains raw holder snapshot array
- Returns both raw URL and gist URL for verification

## API Endpoints

### `/api/cron-draw` (Hourly Draw)

**Schedule**: `0 * * * *` (every hour)

**Authentication**: 
- Query param `secret=$CRON_SECRET` for cron
- Query param `manual=$MANUAL_TRIGGER_SECRET` for manual trigger
- Optional `mode=team` or `mode=holder` to force branch

**Process Flow**:
1. **Authorization**: Validate secret
2. **Deployer Burn**: Burn excess tokens from deployer wallet
3. **Burn Check**: Get burn stats, check if trigger level increased
4. **Balance Check**: Verify payer has sufficient SOL (>= MIN_DISTRIBUTION_LAMPORTS)
5. **Branch Decision**:
   - If burn trigger increased: **Forced Holder Draw** (guaranteed payout)
   - Else: 50/50 random between **Team Distribution** or **Holder Draw**
6. **Team Distribution** (if selected):
   - Build split transaction to 3 team wallets
   - Execute transaction
   - Record in KV as team distribution
7. **Holder Draw** (if selected or forced):
   - Fetch holder snapshot (top 100 by balance)
   - Upload snapshot to public Gist
   - Request VRF randomness
   - Pick weighted winner using snapshot + randomness
   - Build payout transaction with memo containing verification data
   - Execute transaction
   - Record in KV as regular draw

**Response**:
```json
{
  "ok": true,
  "burn": { "burnedRaw": "...", "tx": "..." },
  "result": { /* draw or distribution result */ },
  "debug": { /* balance info */ }
}
```

### `/api/cron-claim` (15-Minute Claim)

**Schedule**: `*/15 * * * *` (every 15 minutes)

**Authentication**: Same as cron-draw

**Process Flow**:
1. **Authorization**: Validate secret
2. **Pre-claim Snapshot**: Record creator vault balance, WSOL balance, SOL balance
3. **Execute Claim**: Call `claimCreatorFees()` based on configuration
4. **Post-claim Snapshot**: Record balances again
5. **Calculate**: Determine claimed amounts
6. **Return**: Detailed claim results

**Response**:
```json
{
  "ok": true,
  "claimTx": "...",
  "claimedLamports": 123456,
  "claimedWsolLamports": "789",
  "beforeLamports": 1000000,
  "afterLamports": 1123456,
  "vaultBeforeLamports": "5000",
  "vaultAfterLamports": "4000",
  "minimumRequiredLamports": "1000",
  "distributableFeesLamports": "4000",
  "canDistribute": true,
  "isGraduated": false
}
```

## Draw Verification

The system is designed to be fully verifiable:

1. **Snapshot**: Stored in public Gist with raw URL
2. **Randomness**: VRF transactions on-chain (request + fulfillment)
3. **Memo**: Payout transaction includes:
   - Winner address
   - Prize amount
   - Burn trigger status
   - VRF transaction links
   - Snapshot URL
   - Verification instructions

**Verification Process**:
```bash
npm run verify:draw -- \
  --draw ./regular-draw.json \
  --expectedWinner <winner-pubkey>
```

Or from snapshot + random hex:
```bash
npm run verify:draw -- \
  --snapshot https://gist.githubusercontent.com/.../snapshot.json \
  --randomHex <randomValueHex> \
  --expectedWinner <winner-pubkey>
```

The verification script:
1. Downloads/fetches snapshot
2. Sorts by owner (same as backend)
3. Recomputes weighted selection with same random value
4. Confirms winner matches

## Security Considerations

### Critical Secrets (Never expose in client code):
- `PAYER_SECRET_KEY`: Private key for SOL payouts
- `CRON_SECRET`: Protects cron endpoints
- `MANUAL_TRIGGER_SECRET`: Protects manual trigger
- `GITHUB_TOKEN`: GitHub API access
- `KV_REST_API_TOKEN`: Vercel KV access

### Balance Guards:
- `MIN_DISTRIBUTION_LAMPORTS`: Prevents draws when balance too low (default: 1 SOL)
- `RESERVE_LAMPORTS_FOR_FEES`: Keeps SOL for transaction fees (default: 0.1 SOL)
- Payout amount = balance - reserve

### VRF Security:
- `VRF_REQUIRED=true`: Enforces VRF, fails if unavailable
- `VRF_REQUIRED=false`: Allows fallback to local randomness if VRF fails
- Fallback logged in transaction memo

### Transaction Safety:
- All transactions built with explicit signers
- Memo instructions for on-chain verification
- Transaction simulation mode available (`SIMULATE_TRANSACTIONS=true`)

## Known Vulnerabilities

The following security vulnerabilities exist in the dependency tree but are in transitive Solana-related packages. These are widely-used libraries and fixing them would require breaking changes:

- **bigint-buffer**: Buffer overflow vulnerability (via @solana/web3.js dependency chain)
- **uuid**: Missing buffer bounds check (via rpc-websockets dependency chain)

These vulnerabilities are in deep dependencies of the Solana ecosystem and are outside the direct control of this project. Monitor for updates from the Solana and @solana/web3.js teams.

## Environment Variables Reference

See `.env.example` for complete list. Key variables:

| Variable                    | Required | Default              | Description                                      |
| --------------------------- | -------- | -------------------- | ------------------------------------------------ |
| MAINNET_ENDPOINT            | Yes      | -                    | Solana RPC HTTP endpoint                         |
| MAINNET_WSS_ENDPOINT        | No       | -                    | Solana RPC WebSocket endpoint (required for VRF) |
| PAYER_SECRET_KEY            | Yes      | -                    | Base58-encoded private key                       |
| TOKEN_MINT                  | Yes      | -                    | SPL token mint address                           |
| TOKEN_NAME                  | Yes      | -                    | Token display name                               |
| JACKPOT_WEBSITE_URL         | Yes      | -                    | Website URL for memos                            |
| PRIZE_LAMPORTS              | Yes      | -                    | Prize amount in lamports                         |
| RESERVE_LAMPORTS_FOR_FEES   | Yes      | -                    | SOL to reserve for fees                          |
| MIN_DISTRIBUTION_LAMPORTS   | No       | 1 SOL                | Minimum balance for draws                        |
| SPLIT_DISTRIBUTION_LAMPORTS | No       | PRIZE_LAMPORTS       | Team split amount                                |
| TEAM_WALLETS                | No       | defaults (3 wallets) | JSON array of team wallet addresses              |
| DEPLOYER_TOKEN_RESERVE_UI   | No       | 0                    | Tokens to keep in deployer ATA                   |
| PUMPFUN_CLAIM_ENABLED       | No       | true                 | Enable pumpfun claiming                          |
| PUMPFUN_CLAIM_PROVIDER      | No       | sdk                  | Claim method (sdk/portal)                        |
| PUMPFUN_CLAIM_POOL          | No       | pump                 | Pool name for claims                             |
| PUMPFUN_CLAIM_MODE          | No       | collect              | Claim mode (collect/distribute)                  |
| VRF_REQUIRED                | No       | true                 | Enforce VRF randomness                           |
| KV_MODE                     | No       | auto                 | KV storage mode                                  |
| CRON_SECRET                 | Yes      | -                    | Cron endpoint protection                         |
| MANUAL_TRIGGER_SECRET       | Yes      | -                    | Manual trigger protection                        |
| GITHUB_TOKEN                | Yes      | -                    | GitHub API for Gists                             |
| KV_REST_API_URL             | No       | -                    | Vercel KV URL                                    |
| KV_REST_API_TOKEN           | No       | -                    | Vercel KV token                                  |
| FORCE_SHOW_COUNTDOWN        | No       | true                 | Show countdown timer                             |
| SIMULATE_TRANSACTIONS       | No       | false                | Simulation mode only                             |
