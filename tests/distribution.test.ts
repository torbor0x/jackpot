import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";

const simulateTransaction = vi.fn();
const payer = Keypair.generate();
const teamWallet1 = Keypair.generate();
const teamWallet2 = Keypair.generate();
const teamWallet3 = Keypair.generate();

const mockTeamWallets = [
  teamWallet1.publicKey,
  teamWallet2.publicKey,
  teamWallet3.publicKey
];

vi.mock("@/lib/solana", () => ({
  connection: {
    simulateTransaction
  },
  payer,
  getTeamWallets: () => mockTeamWallets,
  TEAM_WALLETS: mockTeamWallets,
  MIN_DISTRIBUTION_LAMPORTS: 1000000000,
  SPLIT_DISTRIBUTION_LAMPORTS: 100000000,
  PRIZE_LAMPORTS: 100000000,
  RESERVE_LAMPORTS_FOR_FEES: 100000000
}));

describe.skip("split distribution", () => {
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

    const sig = await runSplitDistribution(100_000_000);
    expect(sig.startsWith("simulated-split-distribution-")).toBe(true);
    expect(simulateTransaction).toHaveBeenCalled();
  });
});
