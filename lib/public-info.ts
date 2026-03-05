import bs58 from "bs58";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getBurnStats } from "@/lib/burn";
import type { BurnStats } from "@/types";

type PublicInfo = {
  tokenName: string;
  tokenMint: string | null;
  currentDrawSol: number | null;
  payerPubkey: string | null;
  burnStats: BurnStats | null;
};

export async function getPublicInfo(): Promise<PublicInfo> {
  const tokenNameRaw = process.env.TOKEN_NAME ?? "JackpotEx";
  const tokenName = tokenNameRaw === "Jackpot" ? "JackpotEx" : tokenNameRaw;
  const tokenMint = process.env.TOKEN_MINT ?? null;

  const endpoint = process.env.MAINNET_ENDPOINT;
  const secret = process.env.PAYER_SECRET_KEY;
  const reserve = Number(process.env.RESERVE_LAMPORTS_FOR_FEES ?? "0");

  if (!endpoint || !secret) {
    return { tokenName, tokenMint, currentDrawSol: null, payerPubkey: null, burnStats: null };
  }

  try {
    const connection = new Connection(endpoint, "confirmed");
    const payer = Keypair.fromSecretKey(bs58.decode(secret));
    const payerPubkey = payer.publicKey.toBase58();
    const [balance, burnStats] = await Promise.all([
      connection.getBalance(payer.publicKey, "confirmed"),
      tokenMint ? getBurnStats(new PublicKey(tokenMint)) : Promise.resolve(null)
    ]);
    const drawLamports = Math.max(0, balance - reserve);
    const currentDrawSol = drawLamports / LAMPORTS_PER_SOL;

    return { tokenName, tokenMint, currentDrawSol, payerPubkey, burnStats };
  } catch {
    return { tokenName, tokenMint, currentDrawSol: null, payerPubkey: null, burnStats: null };
  }
}
