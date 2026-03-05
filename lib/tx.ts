import {
  sendAndConfirmTransaction,
  Transaction,
  type Signer,
  type VersionedTransaction
} from "@solana/web3.js";
import { connection } from "@/lib/solana";

function simulatedSig(label: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `simulated-${label}-${Date.now()}-${rand}`;
}

function simulateEnabled(): boolean {
  return process.env.SIMULATE_TRANSACTIONS === "true";
}

export async function submitLegacyTransaction(params: {
  tx: Transaction;
  signers: Signer[];
  label: string;
}): Promise<string> {
  if (simulateEnabled()) {
    const sim = await connection.simulateTransaction(params.tx);
    if (sim.value.err) {
      throw new Error(`Simulation failed for ${params.label}: ${JSON.stringify(sim.value.err)}`);
    }
    return simulatedSig(params.label);
  }

  return sendAndConfirmTransaction(connection, params.tx, params.signers, {
    commitment: "confirmed"
  });
}

export async function submitVersionedTransaction(params: {
  tx: VersionedTransaction;
  label: string;
}): Promise<string> {
  if (simulateEnabled()) {
    const sim = await connection.simulateTransaction(params.tx, { sigVerify: false });
    if (sim.value.err) {
      throw new Error(`Simulation failed for ${params.label}: ${JSON.stringify(sim.value.err)}`);
    }
    return simulatedSig(params.label);
  }

  const sig = await connection.sendRawTransaction(params.tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3
  });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}
