import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DrawRecord } from "@/types";

const store = new Map<string, unknown>();

vi.mock("@vercel/kv", () => ({
  kv: {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return "OK";
    })
  }
}));

describe("kv draw persistence", () => {
  beforeEach(() => {
    store.clear();
    process.env.KV_MODE = "remote";
    process.env.KV_REST_API_URL = "https://example";
    process.env.KV_REST_API_TOKEN = "token";
  });

  it("keeps initial draw persistent and rotates regular draws", async () => {
    const { addDraw, getDraws } = await import("@/lib/kv");

    const initial: DrawRecord = {
      type: "initial",
      timestamp: "2026-03-05T00:00:00.000Z",
      swapTx: "swap",
      transferTx: "transfer",
      to: "alon",
      sentTokensRaw: "1",
      note: "ok"
    };

    await addDraw(initial);

    for (let i = 0; i < 12; i += 1) {
      await addDraw({
        type: "regular",
        timestamp: `2026-03-05T${String(i).padStart(2, "0")}:00:00.000Z`,
        slot: i,
        winner: `w-${i}`,
        prizeLamports: 100,
        payoutTx: `p-${i}`,
        vrfRequestTx: `r-${i}`,
        vrfFulfilledTx: `f-${i}`,
        snapshotRawUrl: `raw-${i}`,
        snapshotGistUrl: `gist-${i}`,
        totalWeightRaw: "100",
        randomValueHex: "aa"
      });
    }

    const draws = await getDraws();
    expect(draws.length).toBe(10);
    expect(draws[0].type).toBe("initial");
    expect(draws.filter((d) => d.type === "regular").length).toBe(9);
  });
});
