import { Transaction, type Signer, type VersionedTransaction } from "@solana/web3.js";
import { connection } from "@/lib/solana";

function simulatedSig(label: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `simulated-${label}-${Date.now()}-${rand}`;
}

function simulateEnabled(): boolean {
  return process.env.SIMULATE_TRANSACTIONS === "true";
}

async function waitForSignature(sig: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await connection.getSignatureStatuses([sig], { searchTransactionHistory: true });
    const info = status.value[0];
    if (info?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(info.err)}`);
    }
    if (info?.confirmationStatus === "confirmed" || info?.confirmationStatus === "finalized") {
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Transaction confirmation timeout: ${sig}`);
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

  if (!params.tx.recentBlockhash) {
    const latest = await connection.getLatestBlockhash("confirmed");
    params.tx.recentBlockhash = latest.blockhash;
  }
  if (!params.tx.feePayer) {
    params.tx.feePayer = params.signers[0]?.publicKey;
  }
  params.tx.sign(...params.signers);
  const sig = await connection.sendRawTransaction(params.tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3
  });
  await waitForSignature(sig);
  return sig;
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
  await waitForSignature(sig);
  return sig;
}
