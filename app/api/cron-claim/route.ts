import { NextRequest, NextResponse } from "next/server";
import { claimCreatorFees } from "@/lib/pumpfun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

function isAuthorized(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get("secret");
  return Boolean(secret && secret === CRON_SECRET);
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const claimTx = await claimCreatorFees();
    return NextResponse.json({ ok: true, claimTx }, { status: 200 });
  } catch (err) {
    console.error("cron-claim error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown_error" },
      { status: 500 }
    );
  }
}
