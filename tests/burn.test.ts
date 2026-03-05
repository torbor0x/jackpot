import { describe, expect, it } from "vitest";
import { computeBurnTriggerWindow, computeBurnedFromCurrentSupply } from "@/lib/burn";

describe("burn trigger ladder", () => {
  it("uses 10k as first trigger, then 50k, 100k, ...", () => {
    const decimals = 0;

    const preFirst = computeBurnTriggerWindow(9_000n, decimals);
    expect(preFirst.completedBurnTriggers).toBe(0);
    expect(preFirst.tokensToNextTriggerRaw).toBe(1_000n);

    const atFirst = computeBurnTriggerWindow(10_000n, decimals);
    expect(atFirst.completedBurnTriggers).toBe(1);
    expect(atFirst.tokensToNextTriggerRaw).toBe(40_000n);

    const nearSecond = computeBurnTriggerWindow(49_999n, decimals);
    expect(nearSecond.completedBurnTriggers).toBe(1);
    expect(nearSecond.tokensToNextTriggerRaw).toBe(1n);

    const atSecond = computeBurnTriggerWindow(50_000n, decimals);
    expect(atSecond.completedBurnTriggers).toBe(2);
    expect(atSecond.tokensToNextTriggerRaw).toBe(50_000n);

    const atThird = computeBurnTriggerWindow(100_000n, decimals);
    expect(atThird.completedBurnTriggers).toBe(3);
    expect(atThird.tokensToNextTriggerRaw).toBe(50_000n);
  });

  it("derives total burned from fixed 1B supply", () => {
    const decimals = 6;
    const currentSupplyRaw = 800_000_000n * 10n ** 6n;
    const computed = computeBurnedFromCurrentSupply(currentSupplyRaw, decimals);

    expect(computed.totalSupplyRaw).toBe(1_000_000_000n * 10n ** 6n);
    expect(computed.burnedTotalRaw).toBe(200_000_000n * 10n ** 6n);
    expect(computed.burnedPercent).toBe(20);
  });
});
