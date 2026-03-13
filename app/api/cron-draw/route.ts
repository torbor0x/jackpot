import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import {
  JACKPOT_WEBSITE_URL,
  RESERVE_LAMPORTS_FOR_FEES,
  TOKEN_MINT,
  connection,
  payer,
  requestVrfRandomness
} from "@/lib/solana";
import { toSol } from "@/lib/format";
import { addDraw, getBurnTriggerPaid, setBurnTriggerPaid, setTeamDistribution } from "@/lib/kv";
import { getBurnStats } from "@/lib/burn";
import { getHolderSnapshotByOwner, pickWeightedWinner } from "@/lib/holders";
import { uploadSnapshotToGist } from "@/lib/gist";
import { buildPlannedRecipients, getTeamDistributionFromTx, runSplitDistribution } from "@/lib/distribution";
import { runDeployerTokenBurn } from "@/lib/deployer-burn";
import { submitLegacyTransaction } from "@/lib/tx";
import type { RegularDraw } from "@/types";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
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

function getManualOverride(req: NextRequest): "team" | "holder" | null {
  const manual = req.nextUrl.searchParams.get("manual");
  if (!manual || manual !== MANUAL_TRIGGER_SECRET) {
    return null;
  }
  const mode = req.nextUrl.searchParams.get("mode");
  if (mode === "team" || mode === "holder") {
    return mode;
  }
  return null;
}

async function runRegularDraw(payoutLamports: number, burnForced: boolean): Promise<RegularDraw> {
  let stage = "slot";
  try {
    const slot = await connection.getSlot("confirmed");

    stage = "snapshot";
    const snapshot = await getHolderSnapshotByOwner(TOKEN_MINT);
    const gist = await uploadSnapshotToGist(snapshot);

    stage = "vrf";
    const vrf = await requestVrfRandomness(60_000);
    const picked = pickWeightedWinner(snapshot, vrf.randomBytes);

    stage = "winner";
    let winner: PublicKey;
    try {
      winner = new PublicKey(picked.winner);
    } catch {
      throw new Error(`Invalid winner pubkey: ${picked.winner}`);
    }
    stage = "memo";
    const memo = [
      "🎲 JackpotEx Random Holder Draw",
      `Winner: ${winner.toBase58()}`,
      `Prize: ${toSol(payoutLamports)} SOL`,
      burnForced ? "Burn Trigger: Guaranteed payout" : "Burn Trigger: No",
      vrf.fallback ? "VRF: fallback" : `VRF Request: https://solscan.io/tx/${vrf.requestTx}`,
      vrf.fallback ? "VRF Fulfilled: n/a" : `VRF Fulfilled: https://solscan.io/tx/${vrf.fulfilledTx}`,
      `Snapshot: ${gist.rawUrl}`,
      "Verify: download JSON + re-run weighted selection"
    ].join("\n");

    stage = "payout-tx";
    const payoutTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: winner,
        lamports: payoutLamports
      }),
      createMemoInstruction(memo, [payer.publicKey])
    );

    stage = "payout-submit";
    const payoutSig = await submitLegacyTransaction({
      tx: payoutTx,
      signers: [payer],
      label: "regular-payout"
    });

    const draw: RegularDraw = {
      type: "regular",
      timestamp: new Date().toISOString(),
      slot,
      winner: winner.toBase58(),
      prizeLamports: payoutLamports,
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
  } catch (err) {
    throw new Error(`runRegularDraw:${stage}:${err instanceof Error ? err.message : "unknown"}`);
  }
}

export async function GET(req: NextRequest) {
  let stage = "start";
  try {
    stage = "auth";
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    stage = "burn";
    const burnResult = await runDeployerTokenBurn();
    const burnStats = await getBurnStats(TOKEN_MINT);
    const lastBurnPaid = await getBurnTriggerPaid();
    const currentBurnLevel = burnStats?.completedBurnTriggers ?? 0;
    const burnForced = currentBurnLevel > lastBurnPaid;
    const manualOverride = getManualOverride(req);
    let result: unknown;
    let debug: { payer: string; balanceLamports: number; reserveLamports: number; payoutLamports: number } | null =
      null;

    stage = "balance";
    const balance = await connection.getBalance(payer.publicKey, "confirmed");
    const payoutLamports = balance - RESERVE_LAMPORTS_FOR_FEES;
    debug = {
      payer: payer.publicKey.toBase58(),
      balanceLamports: balance,
      reserveLamports: RESERVE_LAMPORTS_FOR_FEES,
      payoutLamports
    };
    if (payoutLamports <= 0) {
      throw new Error("Payer balance is below reserve; cannot run payout");
    }

    if (burnForced) {
      stage = "burn-forced";
      result = await runRegularDraw(payoutLamports, true);
      await setBurnTriggerPaid(currentBurnLevel);
    } else {
      stage = "branch";
      const shouldSplit =
        manualOverride === "team" ? true : manualOverride === "holder" ? false : randomInt(0, 2) === 0;
      if (shouldSplit) {
        stage = "team-distribution";
        const distributionTx = await runSplitDistribution(payoutLamports);
        const parsed = await getTeamDistributionFromTx(distributionTx);
        const plannedRecipients = buildPlannedRecipients(payoutLamports);
        const recipients = parsed?.recipients ?? plannedRecipients;
        const totalLamports = parsed?.totalLamports ?? recipients.reduce((sum, r) => sum + r.lamports, 0);
        const timestamp = parsed?.blockTime
          ? new Date(parsed.blockTime * 1000).toISOString()
          : new Date().toISOString();
        const teamDraw = {
          type: "team" as const,
          tx: distributionTx,
          timestamp,
          note: "Team distribution",
          totalLamports,
          recipients,
          payer: payer.publicKey.toBase58()
        };
        await addDraw(teamDraw);
        await setTeamDistribution({
          tx: teamDraw.tx,
          timestamp: teamDraw.timestamp,
          note: teamDraw.note,
          totalLamports: teamDraw.totalLamports,
          recipients: teamDraw.recipients,
          payer: teamDraw.payer
        });
        result = { type: "split-distribution", tx: distributionTx };
      } else {
        stage = "holder-draw";
        result = await runRegularDraw(payoutLamports, false);
      }
    }

    return NextResponse.json({ ok: true, burn: burnResult, result, debug }, { status: 200 });
  } catch (err) {
    console.error("cron-draw error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown_error", stage },
      { status: 500 }
    );
  }
}
