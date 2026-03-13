import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { TOKEN_MINT, connection, payer } from "@/lib/solana";
import { submitLegacyTransaction, submitVersionedTransaction } from "@/lib/tx";

const PUMPFUN_API = "https://pumpportal.fun/api/trade-local";
const DEFAULT_PROVIDER = "sdk";

function claimEnabled(): boolean {
  return (process.env.PUMPFUN_CLAIM_ENABLED ?? "true").toLowerCase() === "true";
}

function claimProvider(): string {
  return (process.env.PUMPFUN_CLAIM_PROVIDER ?? DEFAULT_PROVIDER).toLowerCase();
}

function priorityFeeSol(): string {
  return process.env.PUMPFUN_PRIORITY_FEE_SOL ?? "0.000001";
}

function claimPool(): string | null {
  const pool = (process.env.PUMPFUN_CLAIM_POOL ?? "").trim();
  if (pool.length > 0) {
    return pool;
  }
  // Default to "pump" per PumpPortal docs if not explicitly set.
  return "pump";
}

function claimMint(): string | null {
  const mint = (process.env.PUMPFUN_CLAIM_MINT ?? "").trim();
  return mint.length > 0 ? mint : TOKEN_MINT.toBase58();
}

function claimCreatorPublicKey(): PublicKey {
  const override = (process.env.PUMPFUN_CREATOR_PUBLIC_KEY ?? "").trim();
  return override.length > 0 ? new PublicKey(override) : payer.publicKey;
}

function claimMode(): "collect" | "distribute" {
  const mode = (process.env.PUMPFUN_CLAIM_MODE ?? "collect").toLowerCase();
  return mode === "distribute" ? "distribute" : "collect";
}

async function claimViaSdk(): Promise<string> {
  const sdk = new OnlinePumpSdk(connection);
  const mode = claimMode();

  if (mode === "distribute") {
    const mint = new PublicKey(claimMint() ?? TOKEN_MINT.toBase58());
    const result = await sdk.buildDistributeCreatorFeesInstructions(mint);
    if (!result.instructions.length) {
      throw new Error("No creator fee distribution instructions returned");
    }
    const tx = new Transaction().add(...result.instructions);
    return submitLegacyTransaction({ tx, signers: [payer], label: "pumpfun-distribute" });
  }

  const creator = claimCreatorPublicKey();
  const instructions = await sdk.collectCoinCreatorFeeInstructions(creator, payer.publicKey);
  if (!instructions.length) {
    throw new Error("No creator fee instructions returned");
  }
  const tx = new Transaction().add(...instructions);
  return submitLegacyTransaction({ tx, signers: [payer], label: "pumpfun-claim" });
}

async function claimViaPortal(): Promise<string> {
  const payload = new URLSearchParams({
    action: "collectCreatorFee",
    publicKey: payer.publicKey.toBase58(),
    priorityFee: priorityFeeSol()
  });
  const pool = claimPool();
  if (pool) {
    payload.set("pool", pool);
  }
  const mint = claimMint();
  if (mint) {
    payload.set("mint", mint);
  }

  const res = await fetch(PUMPFUN_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pumpfun claim failed: ${res.status} ${text}`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  const tx = VersionedTransaction.deserialize(bytes);
  tx.sign([payer]);

  const sig = await submitVersionedTransaction({ tx, label: "pumpfun-claim" });
  return sig;
}

export async function claimCreatorFees(): Promise<string | null> {
  if (!claimEnabled()) {
    return null;
  }
  return claimProvider() === "portal" ? claimViaPortal() : claimViaSdk();
}

export async function getCreatorRewardsBalanceLamports(): Promise<bigint> {
  const sdk = new OnlinePumpSdk(connection);
  const balance = await sdk.getCreatorVaultBalanceBothPrograms(claimCreatorPublicKey());
  return BigInt(balance.toString());
}

export async function getMinimumDistributableFeeInfo(
  mintOverride?: string
): Promise<{
  minimumRequiredLamports: string;
  distributableFeesLamports: string;
  canDistribute: boolean;
  isGraduated: boolean;
}> {
  const sdk = new OnlinePumpSdk(connection);
  const mint = new PublicKey(mintOverride ?? claimMint() ?? TOKEN_MINT.toBase58());
  const res = await sdk.getMinimumDistributableFee(mint);
  return {
    minimumRequiredLamports: res.minimumRequired?.toString?.() ?? "0",
    distributableFeesLamports: res.distributableFees?.toString?.() ?? "0",
    canDistribute: Boolean((res as any).canDistribute),
    isGraduated: Boolean((res as any).isGraduated)
  };
}
