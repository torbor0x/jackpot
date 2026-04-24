# JackpotEx Deployment Guide

## Vercel Deployment

This guide covers deploying JackpotEx to Vercel with Vercel KV (Redis) for persistent storage.

### Prerequisites

1. **GitHub Repository**: Your code must be pushed to GitHub
2. **Vercel Account**: Free tier is sufficient
3. **Vercel KV**: Create a KV database in Vercel
4. **Solana Wallet**: Funded wallet with SOL for payouts
5. **GitHub Personal Access Token**: For creating Gists (classic token with `gist` scope)
6. **RPC Provider**: Solana RPC endpoint (e.g., Alchemy, Helius, QuickNode)

### Step 1: Prepare Your Repository

Ensure your repository is clean and ready:

```bash
git status
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

### Step 3: Configure Environment Variables

In Vercel Project Settings → Environment Variables, add all variables from `.env.example`:

#### Required Variables

```bash
MAINNET_ENDPOINT=https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY
MAINNET_WSS_ENDPOINT=wss://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY
PAYER_SECRET_KEY=base58_encoded_private_key_here
TOKEN_MINT=YourTokenMintAddressHere
TOKEN_NAME=YourTokenName
JACKPOT_WEBSITE_URL=https://your-domain.vercel.app
PRIZE_LAMPORTS=100000000
RESERVE_LAMPORTS_FOR_FEES=100000000
CRON_SECRET=generate_long_random_string_here
MANUAL_TRIGGER_SECRET=generate_another_long_random_string_here
GITHUB_TOKEN=ghp_your_github_pat_here
```

#### Optional Variables (with recommended defaults)

```bash
MIN_DISTRIBUTION_LAMPORTS=1000000000
SPLIT_DISTRIBUTION_LAMPORTS=100000000
TEAM_WALLETS=["wallet1_address","wallet2_address","wallet3_address"]
DEPLOYER_TOKEN_RESERVE_UI=0
PUMPFUN_CLAIM_ENABLED=true
PUMPFUN_PRIORITY_FEE_SOL=0.000001
PUMPFUN_CLAIM_POOL=pump
PUMPFUN_CLAIM_PROVIDER=sdk
PUMPFUN_CLAIM_MODE=collect
VRF_REQUIRED=true
KV_MODE=auto
FORCE_SHOW_COUNTDOWN=true
SIMULATE_TRANSACTIONS=false
```

#### Vercel KV Variables (Auto-populated after KV integration)

After connecting Vercel KV, these will be automatically added:
```bash
KV_REST_API_URL=auto_populated
KV_REST_API_TOKEN=auto_populated
KV_REST_API_READ_ONLY_TOKEN=auto_populated
```

### Step 4: Connect Vercel KV

1. In your Vercel project, go to the "Storage" tab
2. Click "Create Database" → "KV"
3. Select the free tier (sufficient for this use case)
4. Click "Create"
5. Vercel will automatically add the KV environment variables to your project

### Step 5: Configure Cron Jobs

The project includes `vercel.json` with cron configurations. Vercel will automatically detect this:

```json
{
  "crons": [
    {
      "path": "/api/cron-claim?secret=$CRON_SECRET",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron-draw?secret=$CRON_SECRET",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Cron Schedule**:
- `/api/cron-claim`: Every 15 minutes (claims pumpfun creator fees)
- `/api/cron-draw`: Every hour on the hour (runs jackpot draw)

**Note**: The `$CRON_SECRET` placeholder will be automatically replaced with your `CRON_SECRET` environment variable.

### Step 6: Deploy

1. Click "Deploy" in Vercel
2. Wait for build to complete
3. Your site will be live at `https://your-project-name.vercel.app`

### Step 7: Verify Deployment

#### Check Cron Jobs

In Vercel dashboard:
1. Go to your project
2. Click "Cron Jobs" tab
3. Verify both cron jobs are listed and active

#### Manual Testing

Test the endpoints manually (replace with your actual secrets and domain):

```bash
# Test claim endpoint
curl "https://your-domain.vercel.app/api/cron-claim?manual=YOUR_MANUAL_TRIGGER_SECRET"

# Test draw endpoint (holder draw)
curl "https://your-domain.vercel.app/api/cron-draw?manual=YOUR_MANUAL_TRIGGER_SECRET&mode=holder"

# Test draw endpoint (team distribution)
curl "https://your-domain.vercel.app/api/cron-draw?manual=YOUR_MANUAL_TRIGGER_SECRET&mode=team"
```

#### Check Logs

In Vercel dashboard:
1. Go to your project
2. Click "Logs" tab
3. Filter by "cron-claim" or "cron-draw" to see execution logs

### Step 8: Configure Custom Domain (Optional)

1. In Vercel project settings, go to "Domains"
2. Add your custom domain
3. Update `JACKPOT_WEBSITE_URL` environment variable
4. Redeploy

## GitHub Actions Alternative

The project includes GitHub Actions workflows for cron jobs as an alternative to Vercel Cron:

### Files Located in `.github/workflows/`

- `cron-claim.yml`: Runs every 15 minutes
- `cron-draw.yml`: Runs every hour

### Setup GitHub Actions

1. Add these secrets to your GitHub repository settings:
   - `JACKPOTEX_BASE_URL`: Your deployed URL (e.g., `https://your-domain.vercel.app`)
   - `JACKPOTEX_CRON_SECRET`: Your `CRON_SECRET` value

2. The workflows will automatically trigger based on schedule

### Why Use GitHub Actions?

- More reliable cron execution
- Better logging and history
- Free for public repositories
- Can run even if Vercel is down

## Security Best Practices

### 1. Protect Your Secrets

- Never commit `.env` files
- Use strong random strings for `CRON_SECRET` and `MANUAL_TRIGGER_SECRET`
- Rotate secrets periodically
- Use read-only tokens where possible (e.g., KV read-only token for frontend)

### 2. Wallet Security

- Use a dedicated wallet for payouts (not your main wallet)
- Keep minimal SOL balance (just enough for payouts + fees)
- Enable withdrawal limits on your wallet
- Monitor wallet activity regularly

### 3. GitHub Token

- Create a personal access token with only `gist` scope
- Use a classic token (not fine-grained) for simplicity
- Rotate token if compromised

### 4. RPC Endpoint

- Use a reliable RPC provider (Alchemy, Helius, QuickNode)
- Monitor RPC usage and costs
- Have backup RPC endpoints ready

### 5. Environment Variable Protection

- All sensitive variables are server-side only
- Never expose `PAYER_SECRET_KEY`, `CRON_SECRET`, etc. in client code
- Use Vercel's environment variable protection (never expose to browser)

## Monitoring

### Key Metrics to Monitor

1. **Payer Wallet Balance**: Ensure sufficient SOL for payouts
2. **Cron Job Execution**: Verify jobs run on schedule
3. **Error Rates**: Monitor API endpoint errors
4. **Transaction Success**: Verify on-chain transactions succeed
5. **KV Storage**: Ensure data persistence works

### Monitoring Tools

- **Vercel Analytics**: Built-in performance monitoring
- **Vercel Logs**: Real-time log streaming
- **Solscan**: Monitor on-chain transactions
- **Solana RPC Logs**: Track RPC usage

## Troubleshooting

### Cron Jobs Not Running

**Symptoms**: No draws happening on schedule

**Solutions**:
1. Check Vercel Cron Jobs tab - are they enabled?
2. Verify `CRON_SECRET` is set correctly
3. Check logs for errors
4. Consider using GitHub Actions as alternative

### VRF Failing

**Symptoms**: Draw fails with VRF timeout

**Solutions**:
1. Ensure `MAINNET_WSS_ENDPOINT` is set (required for VRF)
2. Set `VRF_REQUIRED=false` to allow fallback randomness
3. Check ORAO Network status
4. Increase timeout in `requestVrfRandomness()` call

### KV Connection Issues

**Symptoms**: Data not persisting, KV errors

**Solutions**:
1. Verify `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
2. Set `KV_MODE=local` for testing without KV
3. Check Vercel KV status page
4. Ensure KV is in same region as deployment

### Pumpfun Claim Failing

**Symptoms**: Claim returns no rewards

**Solutions**:
1. Verify `PUMPFUN_CLAIM_ENABLED=true`
2. Check `PUMPFUN_CLAIM_POOL` matches your token's pool
3. Ensure token has trading volume (fees to claim)
4. Check `PUMPFUN_CREATOR_PUBLIC_KEY` is correct
5. Try switching between `sdk` and `portal` providers

### Balance Too Low

**Symptoms**: Draw fails with "balance below minimum"

**Solutions**:
1. Fund payer wallet with more SOL
2. Lower `MIN_DISTRIBUTION_LAMPORTS` temporarily
3. Lower `RESERVE_LAMPORTS_FOR_FEES` if appropriate
4. Check for stuck transactions

### Gist Upload Failing

**Symptoms**: Draw fails at snapshot upload

**Solutions**:
1. Verify `GITHUB_TOKEN` has `gist` scope
2. Check token hasn't expired
3. Ensure token is a classic PAT (not fine-grained)
4. Check GitHub API status

## Cost Estimation

### Vercel (Free Tier)

- **Hosting**: Free (up to 100GB bandwidth/month)
- **Serverless Functions**: Free (up to 100GB-hours/month)
- **KV Storage**: Free tier includes:
  - 256 MB storage
  - 10,000 commands/day
  - Sufficient for JackpotEx use case

### RPC Provider

- **Alchemy**: Free tier (300M compute units/month)
- **Helius**: Free tier (100K requests/day)
- **QuickNode**: Free tier (2M requests/month)

### Solana Fees

- **Transaction Fees**: ~0.000005 SOL per transaction
- **Draw Cycle**: ~2-3 transactions per hour (claim + burn + draw)
- **Monthly Estimate**: ~0.004 SOL in transaction fees

### ORAO VRF

- **Cost**: Pay per randomness request
- **Draw Cycle**: 1 request per hour
- **Monthly Estimate**: ~720 requests

## Backup and Recovery

### KV Data Backup

Vercel KV automatically replicates data, but you can export:

```bash
# Using Redis CLI
redis-cli -u $KV_REST_API_URL -a $KV_REST_API_TOKEN KEYS "*"
redis-cli -u $KV_REST_API_URL -a $KV_REST_API_TOKEN GET jackpotex-regular-draws
```

### Wallet Backup

- **Critical**: Securely backup your payer wallet private key
- Use hardware wallet for production if possible
- Store backup in multiple secure locations

### Configuration Backup

Keep a secure copy of your `.env` file (never commit to git):
- Use password manager
- Store encrypted backup
- Document all environment variables

## Production Checklist

Before going to production:

- [ ] All secrets set in Vercel environment variables
- [ ] Vercel KV connected and tested
- [ ] Cron jobs configured and verified
- [ ] Payer wallet funded with sufficient SOL
- [ ] GitHub token with gist scope created
- [ ] RPC endpoint tested and reliable
- [ ] `SIMULATE_TRANSACTIONS=false` (set to true for testing)
- [ ] `VRF_REQUIRED=true` (set to false for testing)
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up
- [ ] Backup procedures documented
- [ ] Team wallet addresses verified (TEAM_WALLETS JSON array)
- [ ] Token mint address verified
- [ ] Manual trigger tested
- [ ] Error logging reviewed
- [ ] Security audit completed

## Post-Deployment

### First Week Monitoring

1. Check every cron job execution
2. Verify all transactions succeed
3. Monitor wallet balance
4. Review error logs daily
5. Test manual trigger functionality

### Ongoing Maintenance

- Weekly: Review transaction history
- Monthly: Rotate secrets (optional but recommended)
- Quarterly: Review and update dependencies
- As needed: Adjust prize amounts and reserves

### Updates and Upgrades

When updating the codebase:

1. Test locally with `SIMULATE_TRANSACTIONS=true`
2. Deploy to preview environment first
3. Monitor logs after deployment
4. Have rollback plan ready
