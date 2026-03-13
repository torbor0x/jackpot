import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Keypair, PublicKey } from "@solana/web3.js";

const mockAddDraw = vi.fn();
const mockGetHolderSnapshotByOwner = vi.fn();
const mockPickWeightedWinner = vi.fn();
const mockUploadSnapshotToGist = vi.fn();
const mockSubmitLegacyTransaction = vi.fn();
const mockRequestVrfRandomness = vi.fn();
const mockRunSplitDistribution = vi.fn();
const mockRunDeployerTokenBurn = vi.fn();
const mockRandomInt = vi.fn();
const mockGetBurnStats = vi.fn();
const mockGetBurnTriggerPaid = vi.fn();
const mockSetBurnTriggerPaid = vi.fn();
const mockGetBalance = vi.fn();
const mockGetAccountInfo = vi.fn();
const mockGetSlot = vi.fn();

vi.mock("@/lib/kv", () => ({
  addDraw: mockAddDraw,
  getBurnTriggerPaid: mockGetBurnTriggerPaid,
  setBurnTriggerPaid: mockSetBurnTriggerPaid
}));

vi.mock("@/lib/holders", () => ({
  getHolderSnapshotByOwner: mockGetHolderSnapshotByOwner,
  pickWeightedWinner: mockPickWeightedWinner
}));

vi.mock("@/lib/gist", () => ({
  uploadSnapshotToGist: mockUploadSnapshotToGist
}));

vi.mock("@/lib/swap", () => ({
  getPayerTokenBalanceRaw: vi.fn(),
  swapAllSolToToken: vi.fn()
}));

vi.mock("@/lib/tx", () => ({
  submitLegacyTransaction: mockSubmitLegacyTransaction
}));

vi.mock("@/lib/distribution", () => ({
  runSplitDistribution: mockRunSplitDistribution
}));

vi.mock("@/lib/burn", () => ({
  getBurnStats: mockGetBurnStats
}));

vi.mock("@/lib/deployer-burn", () => ({
  runDeployerTokenBurn: mockRunDeployerTokenBurn
}));

vi.mock("node:crypto", () => ({
  randomInt: mockRandomInt
}));

vi.mock("@/lib/solana", () => ({
  JACKPOT_WEBSITE_URL: "https://jackpot.example",
  PRIZE_LAMPORTS: 100000000,
  RESERVE_LAMPORTS_FOR_FEES: 50000000,
  TOKEN_MINT: new PublicKey("So11111111111111111111111111111111111111112"),
  connection: {
    getBalance: mockGetBalance,
    getAccountInfo: mockGetAccountInfo as any,
    getSlot: mockGetSlot
  },
  payer: Keypair.generate(),
  requestVrfRandomness: mockRequestVrfRandomness
}));

describe("cron draw route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAddDraw.mockReset();
    mockGetHolderSnapshotByOwner.mockReset();
    mockPickWeightedWinner.mockReset();
    mockUploadSnapshotToGist.mockReset();
    mockSubmitLegacyTransaction.mockReset();
    mockRequestVrfRandomness.mockReset();
    mockRunSplitDistribution.mockReset();
    mockRunDeployerTokenBurn.mockReset();
    mockRandomInt.mockReset();
    mockGetBurnStats.mockReset();
    mockGetBurnTriggerPaid.mockReset();
    mockSetBurnTriggerPaid.mockReset();
    mockGetBalance.mockReset();
    mockGetAccountInfo.mockReset();
    mockGetSlot.mockReset();
    mockRandomInt.mockReturnValue(1);
    mockRunDeployerTokenBurn.mockResolvedValue(null);
    mockGetBurnStats.mockResolvedValue({ completedBurnTriggers: 0 });
    mockGetBurnTriggerPaid.mockResolvedValue(0);
    mockGetBalance.mockResolvedValue(200000000);
    mockGetAccountInfo.mockResolvedValue({});
    mockGetSlot.mockResolvedValue(123);

    process.env.CRON_SECRET = "cron-secret";
    process.env.MANUAL_TRIGGER_SECRET = "manual-secret";
  });

  it("rejects unauthorized requests", async () => {
    const { GET } = await import("@/app/api/cron-draw/route");
    const req = new NextRequest("https://x/api/cron-draw?secret=bad");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, error: "unauthorized" });
    expect(mockRunDeployerTokenBurn).not.toHaveBeenCalled();
  });


  it("runs regular flow when burn is not forced", async () => {
    mockGetHolderSnapshotByOwner.mockResolvedValue([{ owner: "winner", amountRaw: "100" }]);
    mockUploadSnapshotToGist.mockResolvedValue({
      rawUrl: "https://gist/raw",
      gistUrl: "https://gist/page"
    });
    mockRequestVrfRandomness.mockResolvedValue({
      randomBytes: Buffer.from("01", "hex"),
      randomHex: "01",
      requestTx: "vrf-req",
      fulfilledTx: "vrf-ful"
    });
    mockPickWeightedWinner.mockReturnValue({
      winner: "11111111111111111111111111111111",
      totalWeight: 100n
    });
    mockSubmitLegacyTransaction.mockResolvedValue("payout-signature");

    const { GET } = await import("@/app/api/cron-draw/route");
    const req = new NextRequest("https://x/api/cron-draw?secret=cron-secret");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.type).toBe("regular");
    expect(body.burn).toBeNull();
    expect(mockRunDeployerTokenBurn).toHaveBeenCalledOnce();
    expect(mockAddDraw).toHaveBeenCalled();
    expect(mockSubmitLegacyTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ label: "regular-payout" })
    );
    expect(body.result.prizeLamports).toBe(150000000);
  });

  it("runs split distribution and does not log draw when random branch selects split", async () => {
    mockRunSplitDistribution.mockResolvedValue("split-signature");
    mockRandomInt.mockReturnValue(0);

    const { GET } = await import("@/app/api/cron-draw/route");
    const req = new NextRequest("https://x/api/cron-draw?secret=cron-secret");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      burn: null,
      result: { type: "split-distribution", tx: "split-signature" }
    });
    expect(mockRunDeployerTokenBurn).toHaveBeenCalledOnce();
    expect(mockRunSplitDistribution).toHaveBeenCalledWith(150000000);
    expect(mockAddDraw).not.toHaveBeenCalled();
  });

  it("forces team distribution when manual mode=team is provided", async () => {
    mockRunSplitDistribution.mockResolvedValue("split-signature");
    mockRandomInt.mockReturnValue(1);

    const { GET } = await import("@/app/api/cron-draw/route");
    const req = new NextRequest(
      "https://x/api/cron-draw?manual=manual-secret&mode=team"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.type).toBe("split-distribution");
    expect(mockRunSplitDistribution).toHaveBeenCalled();
  });

  it("forces holder payout when manual mode=holder is provided", async () => {
    mockGetHolderSnapshotByOwner.mockResolvedValue([{ owner: "winner", amountRaw: "100" }]);
    mockUploadSnapshotToGist.mockResolvedValue({
      rawUrl: "https://gist/raw",
      gistUrl: "https://gist/page"
    });
    mockRequestVrfRandomness.mockResolvedValue({
      randomBytes: Buffer.from("01", "hex"),
      randomHex: "01",
      requestTx: "vrf-req",
      fulfilledTx: "vrf-ful"
    });
    mockPickWeightedWinner.mockReturnValue({
      winner: "11111111111111111111111111111111",
      totalWeight: 100n
    });
    mockSubmitLegacyTransaction.mockResolvedValue("payout-signature");

    const { GET } = await import("@/app/api/cron-draw/route");
    const req = new NextRequest(
      "https://x/api/cron-draw?manual=manual-secret&mode=holder"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.type).toBe("regular");
  });

  it("forces holder payout when burn trigger is pending", async () => {
    mockGetBurnStats.mockResolvedValue({ completedBurnTriggers: 3 });
    mockGetBurnTriggerPaid.mockResolvedValue(2);
    mockGetHolderSnapshotByOwner.mockResolvedValue([{ owner: "winner", amountRaw: "100" }]);
    mockUploadSnapshotToGist.mockResolvedValue({
      rawUrl: "https://gist/raw",
      gistUrl: "https://gist/page"
    });
    mockRequestVrfRandomness.mockResolvedValue({
      randomBytes: Buffer.from("01", "hex"),
      randomHex: "01",
      requestTx: "vrf-req",
      fulfilledTx: "vrf-ful"
    });
    mockPickWeightedWinner.mockReturnValue({
      winner: "11111111111111111111111111111111",
      totalWeight: 100n
    });
    mockSubmitLegacyTransaction.mockResolvedValue("payout-signature");

    const { GET } = await import("@/app/api/cron-draw/route");
    const req = new NextRequest("https://x/api/cron-draw?secret=cron-secret");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.type).toBe("regular");
    expect(mockRunSplitDistribution).not.toHaveBeenCalled();
    expect(mockSetBurnTriggerPaid).toHaveBeenCalledWith(3);
  });
});
