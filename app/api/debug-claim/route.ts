import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { connection, payer } from "@/lib/solana";
import { getCreatorRewardsBalanceLamports, getMinimumDistributableFeeInfo } from "@/lib/pumpfun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MANUAL_TRIGGER_SECRET = process.env.MANUAL_TRIGGER_SECRET ?? "";

function isAuthorized(req: NextRequest): boolean {
  const manual = req.nextUrl.searchParams.get("manual");
  return Boolean(manual && manual === MANUAL_TRIGGER_SECRET);
}

function claimMode(): "collect" | "distribute" {
  const mode = (process.env.PUMPFUN_CLAIM_MODE ?? "collect").toLowerCase();
  return mode === "distribute" ? "distribute" : "collect";
}

function claimMint(): string {
  return (process.env.PUMPFUN_CLAIM_MINT ?? "").trim() || process.env.TOKEN_MINT || "";
}

function claimCreator(): string {
  return (process.env.PUMPFUN_CREATOR_PUBLIC_KEY ?? "").trim() || payer.publicKey.toBase58();
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const sdk = new OnlinePumpSdk(connection);
    const creator = new PublicKey(claimCreator());
    const mode = claimMode();
    const mint = claimMint();

    let instructions = [];
    if (mode === "distribute" && mint) {
      const result = await sdk.buildDistributeCreatorFeesInstructions(new PublicKey(mint));
      instructions = result.instructions;
    } else {
      instructions = await sdk.collectCoinCreatorFeeInstructions(creator, payer.publicKey);
    }

    const programIds = instructions.map((ix) => ix.programId.toBase58());
    const vaultBalance = await getCreatorRewardsBalanceLamports();
    const minFee = await getMinimumDistributableFeeInfo(mint || undefined);

    return NextResponse.json(
      {
        ok: true,
        creator: creator.toBase58(),
        mint,
        mode,
        instructionCount: instructions.length,
        programIds,
        creatorVaultLamports: vaultBalance.toString(),
        minimumRequiredLamports: minFee.minimumRequiredLamports,
        distributableFeesLamports: minFee.distributableFeesLamports,
        canDistribute: minFee.canDistribute,
        isGraduated: minFee.isGraduated
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("debug-claim error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown_error" },
      { status: 500 }
    );
  }
}
