import { createMemoInstruction } from "@solana/spl-memo";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createBurnInstruction,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_MINT, connection, payer } from "@/lib/solana";
import { submitLegacyTransaction } from "@/lib/tx";
import { tokenUiToRaw } from "@/lib/token-amount";

function parseTokenAmountRaw(value: unknown): bigint {
  const data = value as { parsed?: { info?: { tokenAmount?: { amount?: string } } } };
  const amountRaw = data?.parsed?.info?.tokenAmount?.amount ?? "0";
  return BigInt(String(amountRaw));
}

function parseTokenDecimals(value: unknown): number {
  const data = value as { parsed?: { info?: { tokenAmount?: { decimals?: number } } } };
  const decimals = data?.parsed?.info?.tokenAmount?.decimals;
  return typeof decimals === "number" ? decimals : 0;
}

export async function runDeployerTokenBurn(): Promise<{ burnedRaw: string; tx: string } | null> {
  const mintInfo = await connection.getAccountInfo(TOKEN_MINT);
  if (!mintInfo) {
    throw new Error(`Mint account not found: ${TOKEN_MINT.toBase58()}`);
  }

  const mintProgram = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;
  const payerAta = getAssociatedTokenAddressSync(TOKEN_MINT, payer.publicKey, false, mintProgram);
  const ataInfo = await connection.getAccountInfo(payerAta);
  if (!ataInfo) {
    return null;
  }

  const parsed = await connection.getParsedAccountInfo(payerAta, "confirmed");
  const amount = parseTokenAmountRaw(parsed.value?.data);
  if (amount <= 0n) {
    return null;
  }
  const decimals = parseTokenDecimals(parsed.value?.data);
  const reserveUi = Number(process.env.DEPLOYER_TOKEN_RESERVE_UI ?? "0");
  const reserveRaw = tokenUiToRaw(reserveUi, decimals);
  const burnAmount = amount > reserveRaw ? amount - reserveRaw : 0n;
  if (burnAmount <= 0n) {
    return null;
  }

  const memo = "JackpotEx deployer burn | cron";
  const tx = new Transaction().add(
    createBurnInstruction(payerAta, TOKEN_MINT, payer.publicKey, burnAmount, [], mintProgram),
    createMemoInstruction(memo, [payer.publicKey])
  );

  const sig = await submitLegacyTransaction({
    tx,
    signers: [payer],
    label: "deployer-burn"
  });

  return { burnedRaw: burnAmount.toString(), tx: sig };
}
