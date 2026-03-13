import { NextRequest, NextResponse } from "next/server";
import { claimCreatorFees, getCreatorRewardsBalanceLamports, getMinimumDistributableFeeInfo } from "@/lib/pumpfun";
import { connection, payer } from "@/lib/solana";
import { getAssociatedTokenAddress, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const MANUAL_TRIGGER_SECRET = process.env.MANUAL_TRIGGER_SECRET ?? "";

function isAuthorized(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get("secret");
  const manual = req.nextUrl.searchParams.get("manual");
  return Boolean(
    (secret && secret === CRON_SECRET) || (manual && manual === MANUAL_TRIGGER_SECRET)
  );
}

async function getWsolBalanceLamports(): Promise<bigint> {
  try {
    const ata = await getAssociatedTokenAddress(NATIVE_MINT, payer.publicKey, true, TOKEN_PROGRAM_ID);
    const bal = await connection.getTokenAccountBalance(ata);
    const amount = bal?.value?.amount ?? "0";
    return BigInt(amount);
  } catch {
    return 0n;
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const vaultBefore = await getCreatorRewardsBalanceLamports();
    const minFee = await getMinimumDistributableFeeInfo();
    const wsolBefore = await getWsolBalanceLamports();
    const before = await connection.getBalance(payer.publicKey, "confirmed");
    const claimTx = await claimCreatorFees();
    const after = await connection.getBalance(payer.publicKey, "confirmed");
    const wsolAfter = await getWsolBalanceLamports();
    const vaultAfter = await getCreatorRewardsBalanceLamports();
    const claimedLamports = Math.max(0, after - before);
    const claimedWsolLamports = wsolAfter > wsolBefore ? wsolAfter - wsolBefore : 0n;

    if (claimedLamports <= 0 && claimedWsolLamports <= 0n) {
      return NextResponse.json(
        {
          ok: false,
          error: "No creator rewards claimed; check pool/mint or reward distribution wallet",
          claimTx,
          claimedLamports,
          claimedWsolLamports: claimedWsolLamports.toString(),
          beforeLamports: before,
          afterLamports: after,
          wsolBeforeLamports: wsolBefore.toString(),
          wsolAfterLamports: wsolAfter.toString(),
          vaultBeforeLamports: vaultBefore.toString(),
          vaultAfterLamports: vaultAfter.toString(),
          minimumRequiredLamports: minFee.minimumRequiredLamports,
          distributableFeesLamports: minFee.distributableFeesLamports,
          canDistribute: minFee.canDistribute,
          isGraduated: minFee.isGraduated
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        claimTx,
        claimedLamports,
        claimedWsolLamports: claimedWsolLamports.toString(),
        beforeLamports: before,
        afterLamports: after,
        wsolBeforeLamports: wsolBefore.toString(),
        wsolAfterLamports: wsolAfter.toString(),
        vaultBeforeLamports: vaultBefore.toString(),
        vaultAfterLamports: vaultAfter.toString(),
        minimumRequiredLamports: minFee.minimumRequiredLamports,
        distributableFeesLamports: minFee.distributableFeesLamports,
        canDistribute: minFee.canDistribute,
        isGraduated: minFee.isGraduated
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("cron-claim error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown_error" },
      { status: 500 }
    );
  }
}
