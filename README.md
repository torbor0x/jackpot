# JackpotEx

Provably fair weighted random holder draw website for SPL tokens on Solana.

## Overview

JackpotEx is an automated jackpot system that runs hourly draws where token holders can win SOL prizes. The system is fully verifiable through on-chain data and public snapshots.

**Key Features**:
- Provably fair weighted random selection based on token holdings
- ORAO VRF for verifiable randomness
- Hourly automated draws via cron
- 50/50 split between holder draws and team distributions
- Pumpfun creator fee claiming
- Token burn tracking with forced jackpot triggers
- Complete verification through public Gists and on-chain memos

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture, data schemas, and core logic
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Vercel deployment guide with KV setup
- **[LOCAL_SETUP.md](./LOCAL_SETUP.md)** - Local development and testing guide

## Stack

- **Next.js 16** (App Router, TypeScript, RSC)
- **Solana Web3.js** + SPL Token + SPL Memo
- **ORAO VRF** - Verifiable randomness
- **Jupiter v6** (`@jup-ag/api`) - DEX integration
- **GitHub Gist** (Octokit) - Public snapshot storage
- **Vercel KV** - Persistent storage
- **Pumpfun SDK** - Creator fee claiming

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Solana wallet with SOL
- RPC provider (Alchemy, Helius, QuickNode)
- GitHub personal access token (gist scope)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/jackpot.git
cd jackpot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# See LOCAL_SETUP.md for detailed setup instructions
```

### Running Locally

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

Visit `http://localhost:3000` to see the application.

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run live integration tests (requires real configuration)
npm run test:live
```

The test suite mocks network and Solana interactions to validate flow logic without executing real transactions.

## How It Works

### Draw Process (Hourly)

1. **Deployer Burn**: Burns excess tokens from deployer wallet
2. **Burn Check**: Checks if burn trigger level increased (forces holder draw)
3. **Balance Check**: Verifies sufficient SOL for payout
4. **Branch Decision**:
   - If burn trigger increased: Guaranteed holder draw
   - Otherwise: 50/50 random between team distribution or holder draw
5. **Holder Draw** (if selected):
   - Fetches top 100 token holders by balance
   - Uploads snapshot to public Gist
   - Requests randomness from ORAO VRF
   - Selects weighted winner using snapshot + randomness
   - Transfers SOL with verification memo
6. **Team Distribution** (if selected):
   - Splits SOL evenly among 3 team wallets
   - Executes single transaction

### Claim Process (Every 15 minutes)

1. Checks Pumpfun creator fee vault balance
2. Claims accumulated fees via SDK or Portal API
3. Distributes or collects based on configuration

### Verification

Every draw is fully verifiable:
- Snapshot stored in public Gist
- VRF transactions on-chain
- Payout transaction includes verification memo
- Run `npm run verify:draw` to verify any draw

## Configuration

### KV Storage Modes

`lib/kv.ts` supports three modes via `KV_MODE`:

- `KV_MODE=auto` (default): Uses local file storage in development, Vercel KV in production
- `KV_MODE=local`: Always uses local file storage (`.local-kv/jackpotex-kv.json`)
- `KV_MODE=remote`: Always uses Vercel KV (requires `KV_REST_API_URL` and `KV_REST_API_TOKEN`)

### Key Environment Variables

See `.env.example` for complete list. Important variables:

- `MAINNET_ENDPOINT`: Solana RPC HTTP endpoint (required)
- `MAINNET_WSS_ENDPOINT`: Solana RPC WebSocket endpoint (required for VRF)
- `PAYER_SECRET_KEY`: Base58-encoded private key (required)
- `TOKEN_MINT`: SPL token mint address (required)
- `PRIZE_LAMPORTS`: Prize amount in lamports (required)
- `RESERVE_LAMPORTS_FOR_FEES`: SOL to reserve for transaction fees (required)
- `MIN_DISTRIBUTION_LAMPORTS`: Minimum balance for draws (default: 1 SOL)
- `CRON_SECRET`: Protects cron endpoints (required)
- `MANUAL_TRIGGER_SECRET`: Protects manual trigger (required)
- `GITHUB_TOKEN`: GitHub API for Gists (required)
- `VRF_REQUIRED`: Enforce VRF randomness (default: true)
- `SIMULATE_TRANSACTIONS`: Simulation mode only (default: false)
- `PUMPFUN_CLAIM_ENABLED`: Enable pumpfun claiming (default: true)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete environment variable reference.

## Deployment

### Live Example

A live deployment is available at: **https://www.jackpotex.fun/**

### Vercel Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete Vercel deployment guide including:

- Vercel project setup
- Environment variable configuration
- Vercel KV integration
- Cron job configuration
- GitHub Actions alternative
- Security best practices
- Troubleshooting

### Manual Trigger (Development)

```bash
# Test draw endpoint
curl "https://your-domain.com/api/cron-draw?manual=YOUR_MANUAL_TRIGGER_SECRET&mode=holder"

# Test claim endpoint
curl "https://your-domain.com/api/cron-claim?manual=YOUR_MANUAL_TRIGGER_SECRET"
```

## Verification

Every draw is fully verifiable through public data:

### Verify from Draw Record

```bash
npm run verify:draw -- --draw ./regular-draw.json --expectedWinner <winner-pubkey>
```

### Verify from Snapshot + Random Hex

```bash
npm run verify:draw -- \
  --snapshot https://gist.githubusercontent.com/.../snapshot.json \
  --randomHex <randomValueHex> \
  --expectedWinner <winner-pubkey>
```

The verification script re-sorts by owner (same as backend), recomputes weighted selection, and confirms the winner.

## Security

**Critical Security Notes**:

- Never expose `PAYER_SECRET_KEY`, `CRON_SECRET`, `MANUAL_TRIGGER_SECRET`, `GITHUB_TOKEN` in client code
- API routes are protected by secret query parameters
- Keep payer wallet minimally funded and rotate leaked secrets immediately
- Use a dedicated wallet for payouts (not your main wallet)
- Set `RESERVE_LAMPORTS_FOR_FEES` to retain SOL for transaction fees
- Set `MIN_DISTRIBUTION_LAMPORTS` to prevent draws when balance is too low

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed security considerations.

## Known Vulnerabilities

The following security vulnerabilities exist in the dependency tree (transitive Solana packages):

- **bigint-buffer**: Buffer overflow vulnerability (via @solana/web3.js)
- **uuid**: Missing buffer bounds check (via rpc-websockets)

These are in deep dependencies of the Solana ecosystem. Monitor for updates from the Solana and @solana/web3.js teams. See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to this project.

## Support

For issues, questions, or contributions, please open an issue on GitHub.
