import { NextRequest, NextResponse } from "next/server";
import { claimCreatorFees, getCreatorRewardsBalanceLamports, getMinimumDistributableFeeInfo } from "@/lib/pumpfun";
import { connection, payer } from "@/lib/solana";

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

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const vaultBefore = await getCreatorRewardsBalanceLamports();
    const minFee = await getMinimumDistributableFeeInfo();
    const before = await connection.getBalance(payer.publicKey, "confirmed");
    const claimTx = await claimCreatorFees();
    const after = await connection.getBalance(payer.publicKey, "confirmed");
    const vaultAfter = await getCreatorRewardsBalanceLamports();
    const claimedLamports = Math.max(0, after - before);

    if (claimedLamports <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No creator rewards claimed; check pool/mint or reward distribution wallet",
          claimTx,
          claimedLamports,
          beforeLamports: before,
          afterLamports: after,
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
        beforeLamports: before,
        afterLamports: after,
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
