import { describe, expect, it } from "vitest";
import type { InitialDraw, RegularDraw } from "@/types";

const runLive = process.env.RUN_LIVE_INTEGRATION === "true";

describe.runIf(runLive)("live integration (real KV + real Gist)", () => {
  it(
    "clears KV, writes draws, and creates a real gist snapshot",
    async () => {
      if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        throw new Error("Missing KV_REST_API_URL / KV_REST_API_TOKEN");
      }
      if (!process.env.GITHUB_TOKEN) {
        throw new Error("Missing GITHUB_TOKEN");
      }

      process.env.KV_MODE = "remote";

      const { kv } = await import("@vercel/kv");

      // Clear both current and legacy keys to avoid stale test collisions.
      await Promise.all([
        kv.del("jackpotex-initial-draw"),
        kv.del("jackpotex-regular-draws"),
        kv.del("jackpotex-draws"),
        kv.del("initial-round-completed")
      ]);

      const { setInitialDone, addDraw, getDraws } = await import("@/lib/kv");
      const { uploadSnapshotToGist } = await import("@/lib/gist");

      await setInitialDone(true);

      const initial: InitialDraw = {
        type: "initial",
        timestamp: new Date("2026-03-05T00:00:00.000Z").toISOString(),
        swapTx: "live-initial-swap-tx",
        transferTx: "live-initial-transfer-tx",
        to: "alon-live",
        sentTokensRaw: "999",
        note: "live integration seed"
      };

      await addDraw(initial);

      for (let i = 0; i < 4; i += 1) {
        const regular: RegularDraw = {
          type: "regular",
          timestamp: new Date(Date.UTC(2026, 2, 5, 1 + i, 0, 0)).toISOString(),
          slot: 900000 + i,
          winner: `live-winner-${i}`,
          prizeLamports: 100000000,
          payoutTx: `live-payout-${i}`,
          vrfRequestTx: `live-vrf-req-${i}`,
          vrfFulfilledTx: `live-vrf-ful-${i}`,
          snapshotRawUrl: `https://example.com/raw-${i}.json`,
          snapshotGistUrl: `https://example.com/gist-${i}`,
          totalWeightRaw: "1000",
          randomValueHex: "abcd"
        };

        await addDraw(regular);
      }

      const draws = await getDraws();
      expect(draws.length).toBe(5);
      expect(draws[0].type).toBe("initial");
      expect(draws.filter((d) => d.type === "regular").length).toBe(4);

      const gist = await uploadSnapshotToGist([
        { owner: "live-owner-a", amountRaw: "10" },
        { owner: "live-owner-b", amountRaw: "20" }
      ]);

      expect(gist.gistUrl).toContain("gist.github.com");
      expect(gist.rawUrl).toContain("gist.githubusercontent.com");
    },
    60_000
  );
});

if (!runLive) {
  describe("live integration (real KV + real Gist)", () => {
    it("skipped unless RUN_LIVE_INTEGRATION=true", () => {
      expect(true).toBe(true);
    });
  });
}
