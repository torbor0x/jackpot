import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  SPLIT_DISTRIBUTION_LAMPORTS,
  TEAM_WALLET_JESSE,
  TEAM_WALLET_PEACHIE,
  TEAM_WALLET_TORBOR,
  payer
} from "@/lib/solana";
import { submitLegacyTransaction } from "@/lib/tx";

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

export async function runSplitDistribution(): Promise<string> {
  const tx = buildSplitDistributionTransaction(SPLIT_DISTRIBUTION_LAMPORTS);
  return submitLegacyTransaction({ tx, signers: [payer], label: "split-distribution" });
}
