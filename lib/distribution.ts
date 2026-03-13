import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { TEAM_WALLET_JESSE, TEAM_WALLET_PEACHIE, TEAM_WALLET_TORBOR, connection, payer } from "@/lib/solana";
import { submitLegacyTransaction } from "@/lib/tx";
import type { TeamRecipient } from "@/types";

export const TEAM_WALLETS: PublicKey[] = [TEAM_WALLET_TORBOR, TEAM_WALLET_PEACHIE, TEAM_WALLET_JESSE];

export function splitLamportsEvenly(totalLamports: number, walletCount: number): number[] {
  if (walletCount <= 0) {
    throw new Error("walletCount must be greater than zero");
  }
  if (totalLamports <= 0) {
    throw new Error("totalLamports must be greater than zero");
  }

  const base = Math.floor(totalLamports / walletCount);
  const remainder = totalLamports % walletCount;
  const parts = Array.from({ length: walletCount }, () => base);
  for (let i = 0; i < remainder; i += 1) {
    parts[i] += 1;
  }
  return parts;
}

export function buildSplitDistributionTransaction(totalLamports: number): Transaction {
  const allocations = splitLamportsEvenly(totalLamports, TEAM_WALLETS.length);
  const tx = new Transaction();

  TEAM_WALLETS.forEach((wallet, idx) => {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: wallet,
        lamports: allocations[idx]
      })
    );
  });

  return tx;
}

export async function runSplitDistribution(totalLamports: number): Promise<string> {
  const tx = buildSplitDistributionTransaction(totalLamports);
  return submitLegacyTransaction({ tx, signers: [payer], label: "split-distribution" });
}

export function buildPlannedRecipients(totalLamports: number): TeamRecipient[] {
  const allocations = splitLamportsEvenly(totalLamports, TEAM_WALLETS.length);
  return TEAM_WALLETS.map((wallet, idx) => ({
    address: wallet.toBase58(),
    lamports: allocations[idx]
  }));
}

export async function getTeamDistributionFromTx(signature: string): Promise<{
  recipients: TeamRecipient[];
  totalLamports: number;
  blockTime: number | null;
} | null> {
  try {
    const parsed = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    });
    if (!parsed) {
      return null;
    }
    const recipients: TeamRecipient[] = [];
    const walletSet = new Set(TEAM_WALLETS.map((w) => w.toBase58()));
    for (const ix of parsed.transaction.message.instructions as any[]) {
      const program = ix.program ?? "";
      const parsedIx = ix.parsed;
      if (program !== "system" || !parsedIx || parsedIx.type !== "transfer") {
        continue;
      }
      const info = parsedIx.info ?? {};
      const destination = String(info.destination ?? "");
      const lamports = Number(info.lamports ?? 0);
      if (!walletSet.has(destination) || !Number.isFinite(lamports) || lamports <= 0) {
        continue;
      }
      recipients.push({ address: destination, lamports });
    }
    if (recipients.length === 0) {
      return null;
    }
    const totalLamports = recipients.reduce((sum, r) => sum + r.lamports, 0);
    return { recipients, totalLamports, blockTime: parsed.blockTime ?? null };
  } catch {
    return null;
  }
}
