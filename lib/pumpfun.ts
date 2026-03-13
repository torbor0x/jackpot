import { VersionedTransaction } from "@solana/web3.js";
import { TOKEN_MINT, payer } from "@/lib/solana";
import { submitVersionedTransaction } from "@/lib/tx";

const PUMPFUN_API = "https://pumpportal.fun/api/trade-local";

function claimEnabled(): boolean {
  return (process.env.PUMPFUN_CLAIM_ENABLED ?? "true").toLowerCase() === "true";
}

function priorityFeeSol(): string {
  return process.env.PUMPFUN_PRIORITY_FEE_SOL ?? "0.000001";
}

function claimPool(): string | null {
  const pool = (process.env.PUMPFUN_CLAIM_POOL ?? "").trim();
  return pool.length > 0 ? pool : null;
}

export async function claimCreatorFees(): Promise<string | null> {
  if (!claimEnabled()) {
    return null;
  }

  const body = new URLSearchParams({
    action: "collectCreatorFee",
    publicKey: payer.publicKey.toBase58(),
    mint: TOKEN_MINT.toBase58(),
    priorityFee: priorityFeeSol()
  });
  const pool = claimPool();
  if (pool) {
    body.set("pool", pool);
  }

  const res = await fetch(PUMPFUN_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
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
