import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";

const simulateTransaction = vi.fn();

const payer = Keypair.generate();

vi.mock("@/lib/solana", () => ({
  connection: {
    simulateTransaction
  },
  payer,
  SPLIT_DISTRIBUTION_LAMPORTS: 100_000_000,
  TEAM_WALLET_TORBOR: new PublicKey("CvMJMaHtGA1acs17bPQbhPxFim97HyLTXaZQHckCToRb"),
  TEAM_WALLET_PEACHIE: new PublicKey("AJ3uhNTZAQETZPGsxZZit7xPerioZNpuTeRmqGiERie1"),
  TEAM_WALLET_JESSE: new PublicKey("7YpRbrJzjykgaEbWMrRrZASdEeieYEyoV3FB2MGvEXbR")
}));

describe("split distribution", () => {
  beforeEach(() => {
    process.env.SIMULATE_TRANSACTIONS = "true";
    simulateTransaction.mockReset();
    simulateTransaction.mockResolvedValue({ value: { err: null } });
  });

  it("builds 3 transfers and simulates successfully in one transaction", async () => {
    const { buildSplitDistributionTransaction, runSplitDistribution } = await import(
      "@/lib/distribution"
    );
    const tx = buildSplitDistributionTransaction(100_000_000);
    expect(tx.instructions).toHaveLength(3);

    const sig = await runSplitDistribution();
    expect(sig.startsWith("simulated-split-distribution-")).toBe(true);
    expect(simulateTransaction).toHaveBeenCalled();
  });
});
