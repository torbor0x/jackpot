import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair, Transaction } from "@solana/web3.js";
import { createMemoInstruction } from "@solana/spl-memo";

const simulateTransaction = vi.fn();
const sendRawTransaction = vi.fn();
const confirmTransaction = vi.fn();

vi.mock("@/lib/solana", () => ({
  connection: {
    simulateTransaction,
    sendRawTransaction,
    confirmTransaction
  }
}));

describe("transaction execution", () => {
  beforeEach(() => {
    simulateTransaction.mockReset();
    sendRawTransaction.mockReset();
    confirmTransaction.mockReset();
  });

  it("simulates legacy transaction when SIMULATE_TRANSACTIONS=true", async () => {
    process.env.SIMULATE_TRANSACTIONS = "true";
    simulateTransaction.mockResolvedValue({ value: { err: null } });

    const { submitLegacyTransaction } = await import("@/lib/tx");
    const sig = await submitLegacyTransaction({
      tx: {} as any,
      signers: [] as any,
      label: "legacy"
    });

    expect(sig.startsWith("simulated-legacy-")).toBe(true);
    expect(simulateTransaction).toHaveBeenCalledOnce();
  });

  it("simulates versioned transaction when SIMULATE_TRANSACTIONS=true", async () => {
    process.env.SIMULATE_TRANSACTIONS = "true";
    simulateTransaction.mockResolvedValue({ value: { err: null } });

    const { submitVersionedTransaction } = await import("@/lib/tx");
    const sig = await submitVersionedTransaction({
      tx: { serialize: () => Buffer.from("") } as any,
      label: "versioned"
    });

    expect(sig.startsWith("simulated-versioned-")).toBe(true);
    expect(simulateTransaction).toHaveBeenCalledOnce();
    expect(sendRawTransaction).not.toHaveBeenCalled();
  });

  it("simulates a memo transaction successfully", async () => {
    process.env.SIMULATE_TRANSACTIONS = "true";
    simulateTransaction.mockResolvedValue({ value: { err: null } });

    const { submitLegacyTransaction } = await import("@/lib/tx");
    const signer = Keypair.generate();
    const memo = "Built the thing boss | https://example.com | love from JackpotEx team";
    const tx = new Transaction().add(createMemoInstruction(memo, [signer.publicKey]));

    const sig = await submitLegacyTransaction({
      tx,
      signers: [signer],
      label: "initial-transfer"
    });

    expect(sig.startsWith("simulated-initial-transfer-")).toBe(true);
    expect(simulateTransaction).toHaveBeenCalledWith(tx);
  });
});
