import { beforeEach, describe, expect, it, vi } from "vitest";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const getParsedProgramAccounts = vi.fn();
const getAccountInfo = vi.fn();

vi.mock("@/lib/solana", () => ({
  connection: {
    getParsedProgramAccounts,
    getAccountInfo
  }
}));

describe("holders", () => {
  beforeEach(() => {
    getParsedProgramAccounts.mockReset();
    getAccountInfo.mockReset();
    getAccountInfo.mockResolvedValue({
      owner: {
        toBase58: () => TOKEN_PROGRAM_ID.toBase58()
      }
    });
  });

  it("keeps only top 100 holders by balance", async () => {
    const accounts = Array.from({ length: 130 }, (_, i) => {
      const owner = `owner-${String(i).padStart(3, "0")}`;
      const amount = String(130 - i);
      return {
        account: {
          data: {
            parsed: {
              info: {
                owner,
                tokenAmount: { amount }
              }
            }
          }
        }
      };
    });

    getParsedProgramAccounts.mockResolvedValue(accounts);

    const { getHolderSnapshotByOwner, ELIGIBLE_HOLDER_LIMIT } = await import("@/lib/holders");
    const { PublicKey } = await import("@solana/web3.js");

    const out = await getHolderSnapshotByOwner(new PublicKey("So11111111111111111111111111111111111111112"));

    expect(out.length).toBe(ELIGIBLE_HOLDER_LIMIT);
    expect(out[0].owner).toBe("owner-000");
    expect(out[out.length - 1].owner).toBe("owner-099");
  });

  it("picks weighted winner deterministically from random bytes", async () => {
    const { pickWeightedWinner } = await import("@/lib/holders");

    const snapshot = [
      { owner: "A", amountRaw: "10" },
      { owner: "B", amountRaw: "20" },
      { owner: "C", amountRaw: "70" }
    ];

    const randomBytes = Buffer.from("01", "hex");
    const res = pickWeightedWinner(snapshot, randomBytes);

    expect(res.totalWeight).toBe(100n);
    expect(res.winner).toBe("A");
  });
});
