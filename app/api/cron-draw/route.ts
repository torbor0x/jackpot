import { NextRequest, NextResponse } from "next/server";
import {
  ALON_PUBKEY,
  JACKPOT_WEBSITE_URL,
  PRIZE_LAMPORTS,
  RESERVE_LAMPORTS_FOR_FEES,
  TOKEN_MINT,
  connection,
  payer,
  requestVrfRandomness
} from "@/lib/solana";
import { toSol } from "@/lib/format";
import { addDraw, getInitialDone, setInitialDone } from "@/lib/kv";
import { getHolderSnapshotByOwner, pickWeightedWinner } from "@/lib/holders";
import { uploadSnapshotToGist } from "@/lib/gist";
import { getPayerTokenBalanceRaw, swapAllSolToToken } from "@/lib/swap";
import type { InitialDraw, RegularDraw } from "@/types";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createMemoInstruction } from "@solana/spl-memo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const MANUAL_TRIGGER_SECRET = process.env.MANUAL_TRIGGER_SECRET ?? "";

function isAuthorized(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get("secret");
  const manual = req.nextUrl.searchParams.get("manual");
  return (secret && secret === CRON_SECRET) || (manual && manual === MANUAL_TRIGGER_SECRET) || false;
}

async function ensureAta(owner: PublicKey): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(TOKEN_MINT, owner);
  const info = await connection.getAccountInfo(ata);
  if (!info) {
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(payer.publicKey, ata, owner, TOKEN_MINT)
    );
    await sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });
  }
  return ata;
}

async function runInitialBuyback(): Promise<InitialDraw> {
  const balance = await connection.getBalance(payer.publicKey, "confirmed");
  const amountToSwap = balance - RESERVE_LAMPORTS_FOR_FEES;
  if (amountToSwap <= 0) {
    throw new Error("Payer balance is below reserve; cannot run initial buyback");
  }

  const before = await getPayerTokenBalanceRaw(TOKEN_MINT.toBase58());
  const { swapTx } = await swapAllSolToToken(TOKEN_MINT.toBase58(), amountToSwap);
  const after = await getPayerTokenBalanceRaw(TOKEN_MINT.toBase58());

  const bought = after - before;
  if (bought <= 0n) {
    throw new Error("No tokens bought in initial swap");
  }

  const payerAta = await ensureAta(payer.publicKey);
  const alonAta = await ensureAta(ALON_PUBKEY);

  const memo = `Built the thing boss | ${JACKPOT_WEBSITE_URL} | love from Jackpot team`;

  const tx = new Transaction().add(
    createTransferInstruction(payerAta, alonAta, payer.publicKey, bought),
    createMemoInstruction(memo, [payer.publicKey])
  );

  const transferTx = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed"
  });

  const draw: InitialDraw = {
    type: "initial",
    timestamp: new Date().toISOString(),
    swapTx,
    transferTx,
    to: ALON_PUBKEY.toBase58(),
    sentTokensRaw: bought.toString(),
    note: "Initial round complete"
  };

  await addDraw(draw);
  await setInitialDone(true);
  return draw;
}

async function runRegularDraw(): Promise<RegularDraw> {
  const slot = await connection.getSlot("confirmed");

  const snapshot = await getHolderSnapshotByOwner(TOKEN_MINT);
  const gist = await uploadSnapshotToGist(snapshot);

  const vrf = await requestVrfRandomness(60_000);
  const picked = pickWeightedWinner(snapshot, vrf.randomBytes);

  const winner = new PublicKey(picked.winner);
  const memo = [
    "🎲 Jackpot Random Holder Draw",
    `Winner: ${winner.toBase58()}`,
    `Prize: ${toSol(PRIZE_LAMPORTS)} SOL`,
    `VRF Request: https://solscan.io/tx/${vrf.requestTx}`,
    `VRF Fulfilled: https://solscan.io/tx/${vrf.fulfilledTx}`,
    `Snapshot: ${gist.rawUrl}`,
    "Verify: download JSON + re-run weighted selection"
  ].join("\n");

  const payoutTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: winner,
      lamports: PRIZE_LAMPORTS
    }),
    createMemoInstruction(memo, [payer.publicKey])
  );

  const payoutSig = await sendAndConfirmTransaction(connection, payoutTx, [payer], {
    commitment: "confirmed"
  });

  const draw: RegularDraw = {
    type: "regular",
    timestamp: new Date().toISOString(),
    slot,
    winner: winner.toBase58(),
    prizeLamports: PRIZE_LAMPORTS,
    payoutTx: payoutSig,
    vrfRequestTx: vrf.requestTx,
    vrfFulfilledTx: vrf.fulfilledTx,
    snapshotRawUrl: gist.rawUrl,
    snapshotGistUrl: gist.gistUrl,
    totalWeightRaw: picked.totalWeight.toString(),
    randomValueHex: vrf.randomHex
  };

  await addDraw(draw);
  return draw;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const initialDone = await getInitialDone();
    const result = initialDone ? await runRegularDraw() : await runInitialBuyback();

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    console.error("cron-draw error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown_error" },
      { status: 500 }
    );
  }
}
