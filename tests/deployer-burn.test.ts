import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

const mockGetAccountInfo = vi.fn();
const mockGetParsedAccountInfo = vi.fn();
const mockSubmitLegacyTransaction = vi.fn();

vi.mock("@/lib/tx", () => ({
  submitLegacyTransaction: mockSubmitLegacyTransaction
}));

vi.mock("@/lib/solana", () => ({
  TOKEN_MINT: new PublicKey("So11111111111111111111111111111111111111112"),
  connection: {
    getAccountInfo: mockGetAccountInfo,
    getParsedAccountInfo: mockGetParsedAccountInfo
  },
  payer: Keypair.generate()
}));

describe("deployer burn", () => {
  beforeEach(() => {
    mockGetAccountInfo.mockReset();
    mockGetParsedAccountInfo.mockReset();
    mockSubmitLegacyTransaction.mockReset();
  });

  it("returns null when deployer ATA does not exist", async () => {
    mockGetAccountInfo
      .mockResolvedValueOnce({ owner: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") })
      .mockResolvedValueOnce(null);

    const { runDeployerTokenBurn } = await import("@/lib/deployer-burn");
    const result = await runDeployerTokenBurn();

    expect(result).toBeNull();
    expect(mockSubmitLegacyTransaction).not.toHaveBeenCalled();
  });

  it("burns full deployer token balance when ATA has funds", async () => {
    mockGetAccountInfo
      .mockResolvedValueOnce({ owner: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") })
      .mockResolvedValueOnce({ owner: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") });
    mockGetParsedAccountInfo.mockResolvedValue({
      value: {
        data: {
          parsed: {
            info: {
              tokenAmount: { amount: "12345" }
            }
          }
        }
      }
    });
    mockSubmitLegacyTransaction.mockResolvedValue("simulated-deployer-burn-1");

    const { runDeployerTokenBurn } = await import("@/lib/deployer-burn");
    const result = await runDeployerTokenBurn();

    expect(result).toEqual({ burnedRaw: "12345", tx: "simulated-deployer-burn-1" });
    expect(mockSubmitLegacyTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ label: "deployer-burn" })
    );
  });

  it("returns null when deployer ATA amount is zero", async () => {
    mockGetAccountInfo
      .mockResolvedValueOnce({ owner: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") })
      .mockResolvedValueOnce({ owner: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") });
    mockGetParsedAccountInfo.mockResolvedValue({
      value: {
        data: {
          parsed: {
            info: {
              tokenAmount: { amount: "0" }
            }
          }
        }
      }
    });

    const { runDeployerTokenBurn } = await import("@/lib/deployer-burn");
    const result = await runDeployerTokenBurn();

    expect(result).toBeNull();
    expect(mockSubmitLegacyTransaction).not.toHaveBeenCalled();
  });

  it("burns successfully when mint is Token-2022", async () => {
    mockGetAccountInfo
      .mockResolvedValueOnce({ owner: TOKEN_2022_PROGRAM_ID })
      .mockResolvedValueOnce({ owner: TOKEN_2022_PROGRAM_ID });
    mockGetParsedAccountInfo.mockResolvedValue({
      value: {
        data: {
          parsed: {
            info: {
              tokenAmount: { amount: "8888" }
            }
          }
        }
      }
    });
    mockSubmitLegacyTransaction.mockResolvedValue("simulated-deployer-burn-2022");

    const { runDeployerTokenBurn } = await import("@/lib/deployer-burn");
    const result = await runDeployerTokenBurn();

    expect(result).toEqual({ burnedRaw: "8888", tx: "simulated-deployer-burn-2022" });
    expect(mockSubmitLegacyTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ label: "deployer-burn" })
    );
  });
});
