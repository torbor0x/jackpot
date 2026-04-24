import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockClaimCreatorFees = vi.fn();
const mockGetBalance = vi.fn();
const mockGetCreatorRewardsBalanceLamports = vi.fn();
const mockGetMinimumDistributableFeeInfo = vi.fn();
const mockGetTokenAccountBalance = vi.fn();

vi.mock("@/lib/solana", () => ({
  connection: { getBalance: mockGetBalance, getTokenAccountBalance: mockGetTokenAccountBalance },
  payer: { publicKey: { toBase58: () => "payer" } }
}));

vi.mock("@/lib/pumpfun", () => ({
  claimCreatorFees: mockClaimCreatorFees,
  getCreatorRewardsBalanceLamports: mockGetCreatorRewardsBalanceLamports,
  getMinimumDistributableFeeInfo: mockGetMinimumDistributableFeeInfo
}));

describe("cron claim route", () => {
  it("rejects unauthorized requests", async () => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.MANUAL_TRIGGER_SECRET = "manual-secret";
    const { GET } = await import("@/app/api/cron-claim/route");
    const req = new NextRequest("https://x/api/cron-claim?secret=bad");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("claims creator fees when authorized", async () => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.MANUAL_TRIGGER_SECRET = "manual-secret";
    mockClaimCreatorFees.mockResolvedValue("claim-signature");
    mockGetCreatorRewardsBalanceLamports
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n);
    mockGetMinimumDistributableFeeInfo.mockResolvedValue({
      minimumRequiredLamports: "0",
      distributableFeesLamports: "0",
      canDistribute: false,
      isGraduated: false
    });
    mockGetTokenAccountBalance.mockResolvedValueOnce({ value: { amount: "0" } });
    mockGetTokenAccountBalance.mockResolvedValueOnce({ value: { amount: "0" } });
    mockGetBalance.mockResolvedValueOnce(1000).mockResolvedValueOnce(2000);
    const { GET } = await import("@/app/api/cron-claim/route");
    const req = new NextRequest("https://x/api/cron-claim?secret=cron-secret");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      claimTx: "claim-signature",
      claimedLamports: 1000,
      claimedWsolLamports: "0",
      beforeLamports: 1000,
      afterLamports: 2000,
      wsolBeforeLamports: "0",
      wsolAfterLamports: "0",
      vaultBeforeLamports: "0",
      vaultAfterLamports: "0",
      minimumRequiredLamports: "0",
      distributableFeesLamports: "0",
      canDistribute: false,
      isGraduated: false
    });
  });

  it.skip("allows manual trigger with manual secret", async () => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.MANUAL_TRIGGER_SECRET = "manual-secret";
    mockClaimCreatorFees.mockResolvedValue("claim-signature");
    mockGetCreatorRewardsBalanceLamports
      .mockResolvedValueOnce(123n)
      .mockResolvedValueOnce(123n);
    mockGetMinimumDistributableFeeInfo.mockResolvedValue({
      minimumRequiredLamports: "500",
      distributableFeesLamports: "100",
      canDistribute: false,
      isGraduated: true
    });
    mockGetTokenAccountBalance.mockResolvedValueOnce({ value: { amount: "500" } });
    mockGetTokenAccountBalance.mockResolvedValueOnce({ value: { amount: "500" } });
    mockGetBalance.mockResolvedValueOnce(500).mockResolvedValueOnce(500);
    const { GET } = await import("@/app/api/cron-claim/route");
    const req = new NextRequest("https://x/api/cron-claim?manual=manual-secret");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: false,
      error: "No creator rewards claimed; check pool/mint or reward distribution wallet",
      claimTx: "claim-signature",
      claimedLamports: 0,
      claimedWsolLamports: "0",
      beforeLamports: 500,
      afterLamports: 500,
      wsolBeforeLamports: "500",
      wsolAfterLamports: "500",
      vaultBeforeLamports: "123",
      vaultAfterLamports: "123",
      minimumRequiredLamports: "500",
      distributableFeesLamports: "100",
      canDistribute: false,
      isGraduated: true
    });
  });
});
