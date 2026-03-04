import bs58 from "bs58";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

type PublicInfo = {
  tokenName: string;
  tokenMint: string | null;
  currentDrawSol: number | null;
  payerPubkey: string | null;
};

export async function getPublicInfo(): Promise<PublicInfo> {
  const tokenName = process.env.TOKEN_NAME ?? "Jackpot";
  const tokenMint = process.env.TOKEN_MINT ?? null;

  const endpoint = process.env.MAINNET_ENDPOINT;
  const secret = process.env.PAYER_SECRET_KEY;
  const reserve = Number(process.env.RESERVE_LAMPORTS_FOR_FEES ?? "0");

  if (!endpoint || !secret) {
    return { tokenName, tokenMint, currentDrawSol: null, payerPubkey: null };
  }

  try {
    const connection = new Connection(endpoint, "confirmed");
    const payer = Keypair.fromSecretKey(bs58.decode(secret));
    const payerPubkey = new PublicKey(payer.publicKey).toBase58();
    const balance = await connection.getBalance(new PublicKey(payer.publicKey), "confirmed");
    const drawLamports = Math.max(0, balance - reserve);
    const currentDrawSol = drawLamports / LAMPORTS_PER_SOL;

    return { tokenName, tokenMint, currentDrawSol, payerPubkey };
  } catch {
    return { tokenName, tokenMint, currentDrawSol: null, payerPubkey: null };
  }
}
