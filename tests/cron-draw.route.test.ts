import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Keypair, PublicKey } from "@solana/web3.js";

const mockGetInitialDone = vi.fn();
const mockSetInitialDone = vi.fn();
const mockAddDraw = vi.fn();
const mockGetHolderSnapshotByOwner = vi.fn();
const mockPickWeightedWinner = vi.fn();
const mockUploadSnapshotToGist = vi.fn();
const mockGetPayerTokenBalanceRaw = vi.fn();
const mockSwapAllSolToToken = vi.fn();
const mockSubmitLegacyTransaction = vi.fn();
const mockRequestVrfRandomness = vi.fn();
const mockRunSplitDistribution = vi.fn();
const mockRunDeployerTokenBurn = vi.fn();
const mockRandomInt = vi.fn();

vi.mock("@/lib/kv", () => ({
  getInitialDone: mockGetInitialDone,
  setInitialDone: mockSetInitialDone,
  addDraw: mockAddDraw
}));

vi.mock("@/lib/holders", () => ({
  getHolderSnapshotByOwner: mockGetHolderSnapshotByOwner,
  pickWeightedWinner: mockPickWeightedWinner
}));

vi.mock("@/lib/gist", () => ({
  uploadSnapshotToGist: mockUploadSnapshotToGist
}));

vi.mock("@/lib/swap", () => ({
  getPayerTokenBalanceRaw: mockGetPayerTokenBalanceRaw,
  swapAllSolToToken: mockSwapAllSolToToken
}));

vi.mock("@/lib/tx", () => ({
  submitLegacyTransaction: mockSubmitLegacyTransaction
}));

vi.mock("@/lib/distribution", () => ({
  runSplitDistribution: mockRunSplitDistribution
}));

vi.mock("@/lib/deployer-burn", () => ({
  runDeployerTokenBurn: mockRunDeployerTokenBurn
}));

vi.mock("node:crypto", () => ({
  randomInt: mockRandomInt
}));

vi.mock("@/lib/solana", () => ({
  ALON_PUBKEY: new PublicKey("11111111111111111111111111111111"),
  INITIAL_BUYBACK_SWAP_LAMPORTS: 100000000,
  JACKPOT_WEBSITE_URL: "https://jackpot.example",
  PRIZE_LAMPORTS: 100000000,
  RESERVE_LAMPORTS_FOR_FEES: 50000000,
  TOKEN_MINT: new PublicKey("So11111111111111111111111111111111111111112"),
  connection: {
    getBalance: vi.fn().mockResolvedValue(200000000),
    getAccountInfo: vi.fn().mockResolvedValue({}) as any,
    getSlot: vi.fn().mockResolvedValue(123)
  },
  payer: Keypair.generate(),
  requestVrfRandomness: mockRequestVrfRandomness
}));

describe("cron draw route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetInitialDone.mockReset();
    mockSetInitialDone.mockReset();
    mockAddDraw.mockReset();
    mockGetHolderSnapshotByOwner.mockReset();
    mockPickWeightedWinner.mockReset();
    mockUploadSnapshotToGist.mockReset();
    mockGetPayerTokenBalanceRaw.mockReset();
    mockSwapAllSolToToken.mockReset();
    mockSubmitLegacyTransaction.mockReset();
    mockRequestVrfRandomness.mockReset();
    mockRunSplitDistribution.mockReset();
    mockRunDeployerTokenBurn.mockReset();
    mockRandomInt.mockReset();
    mockRandomInt.mockReturnValue(1);
    mockRunDeployerTokenBurn.mockResolvedValue(null);

    process.env.CRON_SECRET = "cron-secret";
    process.env.MANUAL_TRIGGER_SECRET = "manual-secret";
    process.env.INITIAL_BUYBACK_SWAP_LAMPORTS = "100000000";
  });

  it("rejects unauthorized requests", async () => {
    const { GET } = await import("@/app/api/cron-draw/route");
    const req = new NextRequest("https://x/api/cron-draw?secret=bad");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, error: "unauthorized" });
    expect(mockRunDeployerTokenBurn).not.toHaveBeenCalled();
  });

  it("runs initial flow when initial round is not complete", async () => {
    mockGetInitialDone.mockResolvedValue(false);
    mockRunDeployerTokenBurn.mockResolvedValue({
      burnedRaw: "123",
      tx: "burn-signature"
    });
    mockGetPayerTokenBalanceRaw.mockResolvedValueOnce(10n).mockResolvedValueOnce(110n);
    mockSwapAllSolToToken.mockResolvedValue({ swapTx: "swap-signature" });
    mockSubmitLegacyTransaction.mockResolvedValue("transfer-signature");

    const { GET } = await import("@/app/api/cron-draw/route");
    const req = new NextRequest("https://x/api/cron-draw?manual=manual-secret");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.type).toBe("initial");
    expect(body.burn).toEqual({ burnedRaw: "123", tx: "burn-signature" });
    expect(mockRunDeployerTokenBurn).toHaveBeenCalledOnce();
    expect(mockSwapAllSolToToken).toHaveBeenCalledWith(expect.any(String), 100000000);
    expect(mockSetInitialDone).toHaveBeenCalledWith(true);
    expect(mockAddDraw).toHaveBeenCalled();
  });

  it("runs regular flow when initial round is complete", async () => {
    mockGetInitialDone.mockResolvedValue(true);
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
  });

  it("runs split distribution and does not log draw when random branch selects split", async () => {
    mockGetInitialDone.mockResolvedValue(true);
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
    expect(mockRunSplitDistribution).toHaveBeenCalledOnce();
    expect(mockAddDraw).not.toHaveBeenCalled();
  });
});
