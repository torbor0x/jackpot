import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { ParsedAccountData, PublicKey } from "@solana/web3.js";
import { connection } from "@/lib/solana";
import type { HolderWeight } from "@/types";

export async function getHolderSnapshotByOwner(mint: PublicKey): Promise<HolderWeight[]> {
  const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: mint.toBase58() } }
    ]
  });

  const byOwner = new Map<string, bigint>();

  for (const acc of accounts) {
    const data = acc.account.data as ParsedAccountData;
    const info = data.parsed?.info;
    if (!info) {
      continue;
    }

    const owner = String(info.owner);
    const amountRaw = String(info.tokenAmount?.amount ?? "0");
    const amount = BigInt(amountRaw);
    if (amount <= 0n) {
      continue;
    }

    byOwner.set(owner, (byOwner.get(owner) ?? 0n) + amount);
  }

  return [...byOwner.entries()]
    .map(([owner, amount]) => ({ owner, amountRaw: amount.toString() }))
    .sort((a, b) => a.owner.localeCompare(b.owner));
}

export function pickWeightedWinner(snapshot: HolderWeight[], randomBytes: Buffer): {
  winner: string;
  totalWeight: bigint;
} {
  if (snapshot.length === 0) {
    throw new Error("No holders found");
  }

  const total = snapshot.reduce((sum, h) => sum + BigInt(h.amountRaw), 0n);
  if (total <= 0n) {
    throw new Error("Total holder weight is zero");
  }

  const rnd = BigInt(`0x${randomBytes.toString("hex")}`) % total;

  let cursor = 0n;
  for (const h of snapshot) {
    cursor += BigInt(h.amountRaw);
    if (rnd < cursor) {
      return { winner: h.owner, totalWeight: total };
    }
  }

  return { winner: snapshot[snapshot.length - 1].owner, totalWeight: total };
}
