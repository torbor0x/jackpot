import { NextRequest, NextResponse } from "next/server";
import { connection } from "@/lib/solana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MANUAL_TRIGGER_SECRET = process.env.MANUAL_TRIGGER_SECRET ?? "";

function isAuthorized(req: NextRequest): boolean {
  const manual = req.nextUrl.searchParams.get("manual");
  return Boolean(manual && manual === MANUAL_TRIGGER_SECRET);
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const sig = req.nextUrl.searchParams.get("sig");
    if (!sig) {
      return NextResponse.json({ ok: false, error: "missing sig" }, { status: 400 });
    }

    const parsed = await connection.getParsedTransaction(sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    });

    if (!parsed) {
      return NextResponse.json({ ok: false, error: "transaction not found" }, { status: 404 });
    }

    const instructions = parsed.transaction.message.instructions;
    const programIds = instructions.map((ix: any) =>
      typeof ix.programId === "string" ? ix.programId : ix.programId?.toBase58?.() ?? "unknown"
    );

    return NextResponse.json(
      {
        ok: true,
        signature: sig,
        slot: parsed.slot,
        err: parsed.meta?.err ?? null,
        fee: parsed.meta?.fee ?? null,
        programIds,
        logs: (parsed.meta?.logMessages ?? []).slice(0, 50)
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("debug-tx error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown_error" },
      { status: 500 }
    );
  }
}
