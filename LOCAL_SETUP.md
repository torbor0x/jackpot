# Local Development Guide

This guide covers setting up and running JackpotEx locally for development and testing.

## Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 9 or higher (comes with Node.js)
- **Git**: For cloning the repository
- **Solana Wallet**: For testing payouts (can use testnet or devnet)
- **RPC Endpoint**: Solana RPC provider (can use free tiers)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/jackpot.git
cd jackpot
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js 16
- Solana Web3.js and SPL Token libraries
- ORAO VRF
- Jupiter API
- Vercel KV
- Pumpfun SDK

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

#### Required Variables

```bash
# Solana RPC (use devnet for testing)
MAINNET_ENDPOINT=https://api.devnet.solana.com
MAINNET_WSS_ENDPOINT=wss://api.devnet.solana.com

# Payer wallet (generate a new wallet for testing)
# You can generate one using: solana-keygen new --outfile ~/.config/solana/id.json
PAYER_SECRET_KEY=your_base58_private_key_here

# Token configuration
TOKEN_MINT=YourTokenMintAddressHere
TOKEN_NAME=YourTokenName

# Website URL (can be localhost for testing)
JACKPOT_WEBSITE_URL=http://localhost:3000

# Prize configuration (in lamports, 1 SOL = 1,000,000,000 lamports)
PRIZE_LAMPORTS=100000000
RESERVE_LAMPORTS_FOR_FEES=100000000

# Secrets (generate strong random strings)
CRON_SECRET=generate_long_random_string_here
MANUAL_TRIGGER_SECRET=generate_another_long_random_string_here

# GitHub token for gist creation (create at github.com/settings/tokens)
GITHUB_TOKEN=ghp_your_github_pat_here
```

#### Optional Variables (for development)

```bash
# Use local file storage instead of Vercel KV
KV_MODE=local

# Disable VRF for faster testing (uses local randomness)
VRF_REQUIRED=false

# Enable simulation mode (no actual transactions)
SIMULATE_TRANSACTIONS=true

# Always show countdown timer
FORCE_SHOW_COUNTDOWN=true

# Minimum balance for distributions (lower for testing)
MIN_DISTRIBUTION_LAMPORTS=10000000

# Team wallet addresses (JSON array, supports any number of team members)
TEAM_WALLETS=["wallet1_address","wallet2_address","wallet3_address"]

# Deployer token reserve
DEPLOYER_TOKEN_RESERVE_UI=0

# Pumpfun configuration
PUMPFUN_CLAIM_ENABLED=false
PUMPFUN_PRIORITY_FEE_SOL=0.000001
PUMPFUN_CLAIM_POOL=pump
PUMPFUN_CLAIM_PROVIDER=sdk
PUMPFUN_CLAIM_MODE=collect
```

### 4. Generate Test Wallet (Optional)

If you don't have a Solana wallet, you can generate one:

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.4/install)"

# Generate new keypair
solana-keygen new --outfile ~/.config/solana/jackpot-payer.json

# Get the private key in base58 format
solana-keygen pubkey ~/.config/solana/jackpot-payer.json
solana-keygen inspect ~/.config/solana/jackpot-payer.json
```

Copy the base58 private key to your `.env` file.

### 5. Fund Your Wallet (for testing)

**For Devnet**:
```bash
# Request airdrop
solana airdrop 2 ~/.config/solana/jackpot-payer.json --url devnet
```

**For Mainnet**:
Send SOL to your wallet address from an exchange or another wallet.

## Running the Application

### Development Mode

Start the development server with hot reload:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build

Build and run the production version:

```bash
npm run build
npm start
```

## Testing

### Run All Tests

```bash
npm test
```

The test suite includes:
- Unit tests for core logic
- Integration tests with mocked Solana interactions
- Verification tests for draw fairness

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Live Integration Tests

These tests interact with the actual blockchain (requires real configuration):

```bash
npm run test:live
```

**Warning**: This will execute real transactions on the configured network.

## Manual Testing

### Test Draw Endpoint

Start the dev server, then test the draw endpoint:

```bash
# Test with holder draw mode
curl "http://localhost:3000/api/cron-draw?manual=YOUR_MANUAL_TRIGGER_SECRET&mode=holder"

# Test with team distribution mode
curl "http://localhost:3000/api/cron-draw?manual=YOUR_MANUAL_TRIGGER_SECRET&mode=team"
```

### Test Claim Endpoint

```bash
curl "http://localhost:3000/api/cron-claim?manual=YOUR_MANUAL_TRIGGER_SECRET"
```

### Test Public Info Endpoint

```bash
curl "http://localhost:3000/api/public-info"
```

## Local KV Storage

When `KV_MODE=local`, data is stored in `.local-kv/jackpotex-kv.json`.

### View KV Data

```bash
cat .local-kv/jackpotex-kv.json
```

### Reset KV Data

```bash
rm .local-kv/jackpotex-kv.json
```

### KV Data Structure

```json
{
  "jackpotex-regular-draws": [],
  "jackpotex-initial-draw": null,
  "initial-round-completed": false,
  "jackpotex-burn-stats": null,
  "jackpotex-burn-trigger-paid": 0,
  "jackpotex-team-distribution": null
}
```

## Simulation Mode

Set `SIMULATE_TRANSACTIONS=true` in `.env` to test without executing real transactions.

### What Gets Simulated

- Solana transactions (payouts, burns, claims)
- VRF randomness requests
- All blockchain interactions

### What Still Works

- Holder snapshot fetching
- Weighted winner selection
- Gist uploads
- KV storage operations
- All business logic

### Example Response in Simulation Mode

```json
{
  "ok": true,
  "result": {
    "type": "regular",
    "winner": "...",
    "prizeLamports": 100000000,
    "payoutTx": "simulated_signature_abc123",
    "vrfRequestTx": "simulated_vrf_request",
    "vrfFulfilledTx": "simulated_vrf_fulfillment"
  }
}
```

## Debugging

### Enable Verbose Logging

Add console.log statements in the code or use the built-in logging:

```typescript
console.log("Debug info:", { someData });
```

### Check Environment Variables

```bash
# In Node.js REPL
node -e "console.log(process.env.MAINNET_ENDPOINT)"
```

### Verify Solana Connection

Create a test script `test-connection.js`:

```javascript
const { Connection } = require("@solana/web3.js");
const endpoint = process.env.MAINNET_ENDPOINT;
const connection = new Connection(endpoint);

connection.getLatestBlockhash().then(
  (hash) => console.log("Connected:", hash),
  (err) => console.error("Failed:", err)
);
```

Run with:
```bash
node test-connection.js
```

### Check Wallet Balance

```bash
solana balance ~/.config/solana/jackpot-payer.json --url devnet
```

## Common Issues

### Port Already in Use

If port 3000 is already in use:

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
npm run dev -- -p 3001
```

### Module Not Found Errors

If you get module not found errors:

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Type Errors

If you get TypeScript errors:

```bash
# Run type check
npm run typecheck

# Clear TypeScript cache
rm -rf .next tsconfig.tsbuildinfo
npm run dev
```

### Environment Variables Not Loading

Restart the dev server after changing `.env`:

```bash
# Stop the server (Ctrl+C)
# Start again
npm run dev
```

### KV Storage Issues

If local KV has issues:

```bash
# Reset local KV
rm -rf .local-kv
# Restart dev server
npm run dev
```

### RPC Connection Issues

If RPC connection fails:

1. Verify your RPC endpoint is correct
2. Check if you've hit rate limits
3. Try a different RPC provider
4. For devnet, use the public endpoint: `https://api.devnet.solana.com`

## Development Workflow

### 1. Make Changes

Edit the code in your preferred editor.

### 2. Type Check

```bash
npm run typecheck
```

### 3. Run Tests

```bash
npm test
```

### 4. Test Locally

```bash
npm run dev
```

Test the changes in the browser or via API endpoints.

### 5. Build Check

```bash
npm run build
```

Ensure the production build succeeds.

### 6. Commit Changes

```bash
git add .
git commit -m "Description of changes"
git push
```

## Code Structure

```
jackpot/
├── app/
│   ├── api/
│   │   ├── cron-draw/       # Hourly draw endpoint
│   │   ├── cron-claim/      # 15-min claim endpoint
│   │   ├── debug-claim/     # Debug claim endpoint
│   │   └── debug-tx/        # Debug transaction endpoint
│   ├── components/          # React components
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Homepage
├── lib/
│   ├── solana.ts            # Solana connection & VRF
│   ├── holders.ts           # Holder snapshot logic
│   ├── distribution.ts      # Team distribution logic
│   ├── pumpfun.ts           # Pumpfun integration
│   ├── burn.ts              # Burn calculation
│   ├── deployer-burn.ts     # Deployer burn logic
│   ├── kv.ts                # KV storage abstraction
│   ├── gist.ts              # GitHub Gist integration
│   ├── swap.ts              # Jupiter swap logic
│   ├── tx.ts                # Transaction submission
│   └── public-info.ts       # Public info endpoint
├── scripts/
│   ├── verify-draw.ts       # Draw verification script
│   └── generate-live-snapshot.ts  # Snapshot generation
├── tests/                   # Test files
├── types.ts                 # TypeScript types
└── package.json
```

## Useful Scripts

### Verify a Draw

```bash
npm run verify:draw -- --draw ./regular-draw.json --expectedWinner <winner-pubkey>
```

### Generate Live Snapshot

```bash
npm run snapshot:live
```

### Lint Code

```bash
npm run lint
```

## Performance Tips

### Use Turbo Mode

The dev server uses Turbo by default for faster builds:

```bash
npm run dev
```

### Cache Dependencies

Ensure `node_modules` is not in `.gitignore` incorrectly for your setup.

### Use Local KV

For development, `KV_MODE=local` is faster than connecting to remote KV.

### Disable VRF for Testing

Set `VRF_REQUIRED=false` to skip VRF requests during development.

## Security for Local Development

### Never Commit Secrets

Ensure `.env` is in `.gitignore` (it should be by default).

### Use Testnet

Use devnet or testnet for development to avoid accidentally spending real SOL.

### Separate Wallets

Use a dedicated wallet for development, never your main wallet.

### Review Transactions

Even in simulation mode, review the code to ensure transactions are correct.

## Next Steps

After local setup is working:

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
2. Read [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
3. Review the test suite to understand expected behavior
4. Test with simulation mode first, then real transactions on devnet
5. Deploy to Vercel for production use
