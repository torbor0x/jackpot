import { createJupiterApiClient } from "@jup-ag/api";
import { NATIVE_MINT, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { connection, payer } from "@/lib/solana";
import { submitVersionedTransaction } from "@/lib/tx";

const jupiter = createJupiterApiClient();

export async function swapAllSolToToken(outputMint: string, amountLamports: number): Promise<{
  swapTx: string;
}> {
  const quote = await jupiter.quoteGet({
    inputMint: NATIVE_MINT.toBase58(),
    outputMint,
    amount: amountLamports,
    slippageBps: 100
  });

  if (!quote) {
    throw new Error("Jupiter quote failed");
  }

  const swapResp = await jupiter.swapPost({
    swapRequest: {
      userPublicKey: payer.publicKey.toBase58(),
      quoteResponse: quote,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true
    }
  });

  if (!swapResp.swapTransaction) {
    throw new Error("Jupiter swap transaction missing");
  }

  const tx = VersionedTransaction.deserialize(Buffer.from(swapResp.swapTransaction, "base64"));
  tx.sign([payer]);

  const sig = await submitVersionedTransaction({ tx, label: "jupiter-swap" });

  return { swapTx: sig };
}

export async function getPayerTokenBalanceRaw(mint: string): Promise<bigint> {
  const ata = getAssociatedTokenAddressSync(new PublicKey(mint), payer.publicKey);
  const maybe = await connection.getAccountInfo(ata);
  if (!maybe) {
    return 0n;
  }

  const acc = await getAccount(connection, ata);
  return acc.amount;
}
