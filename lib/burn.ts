import { Connection, PublicKey, type ParsedAccountData } from "@solana/web3.js";
import { getBurnStatsCache, setBurnStatsCache } from "@/lib/kv";
import { formatTokenAmount } from "@/lib/token-format";
import type { BurnStats } from "@/types";

const CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const FIXED_TOTAL_SUPPLY_TOKENS = 1_000_000_000n;

function normalizeCachedBurnStats(cached: BurnStats | null): BurnStats | null {
  if (!cached) {
    return null;
  }
  if (cached.nextTriggerAtRaw) {
    return cached;
  }

  try {
    const triggerWindow = computeBurnTriggerWindow(BigInt(cached.burnedTotalRaw), cached.decimals);
    return {
      ...cached,
      nextTriggerAtRaw: triggerWindow.nextTriggerAtRaw.toString(),
      tokensToNextTriggerRaw: triggerWindow.tokensToNextTriggerRaw.toString(),
      progressToNextTriggerPercent: triggerWindow.progressToNextTriggerPercent,
      completedBurnTriggers: triggerWindow.completedBurnTriggers
    };
  } catch {
    return cached;
  }
}

function parseMintSupply(value: unknown): { supply: bigint; decimals: number } {
  const data = (value as ParsedAccountData | undefined)?.parsed?.info;
  const supplyRaw = String(data?.supply ?? "0");
  const decimals = Number(data?.decimals ?? 0);
  return { supply: BigInt(supplyRaw), decimals };
}

function tokenUnitRaw(decimals: number): bigint {
  return 10n ** BigInt(decimals);
}

function tokensToRaw(tokens: bigint, decimals: number): bigint {
  return tokens * tokenUnitRaw(decimals);
}

export function computeBurnedFromCurrentSupply(currentSupplyRaw: bigint, decimals: number): {
  totalSupplyRaw: bigint;
  burnedTotalRaw: bigint;
  burnedPercent: number;
} {
  const totalSupplyRaw = tokensToRaw(FIXED_TOTAL_SUPPLY_TOKENS, decimals);
  const burnedTotalRaw = totalSupplyRaw > currentSupplyRaw ? totalSupplyRaw - currentSupplyRaw : 0n;
  const burnedPercent =
    totalSupplyRaw === 0n ? 0 : (Number(burnedTotalRaw) / Number(totalSupplyRaw)) * 100;
  return { totalSupplyRaw, burnedTotalRaw, burnedPercent };
}

export function computeBurnTriggerWindow(
  burnedTotalRaw: bigint,
  decimals: number
): {
  completedBurnTriggers: number;
  tokensToNextTriggerRaw: bigint;
  progressToNextTriggerPercent: number;
  nextTriggerAtRaw: bigint;
} {
  const firstIncrementRaw = tokensToRaw(10_000n, decimals);
  const stepIncrementRaw = tokensToRaw(50_000n, decimals);

  const threshold = (n: bigint): bigint => {
    if (n <= 0n) {
      return 0n;
    }
    return firstIncrementRaw + (stepIncrementRaw * (n - 1n) * n) / 2n;
  };

  let completed = 0n;
  while (true) {
    const next = completed + 1n;
    const nextThreshold = threshold(next);
    if (burnedTotalRaw < nextThreshold) {
      break;
    }
    completed = next;
  }

  const currentThreshold = threshold(completed);
  const nextThreshold = threshold(completed + 1n);
  const windowSize = nextThreshold - currentThreshold;
  const progressed = burnedTotalRaw > currentThreshold ? burnedTotalRaw - currentThreshold : 0n;
  const progress = windowSize === 0n ? 0 : (Number(progressed) / Number(windowSize)) * 100;

  return {
    completedBurnTriggers: Number(completed),
    tokensToNextTriggerRaw: nextThreshold - burnedTotalRaw,
    progressToNextTriggerPercent: progress,
    nextTriggerAtRaw: nextThreshold
  };
}

function buildBurnStats(params: {
  currentSupplyRaw: bigint;
  decimals: number;
}): BurnStats {
  const { currentSupplyRaw, decimals } = params;
  const burnComputed = computeBurnedFromCurrentSupply(currentSupplyRaw, decimals);
  const burnedBySupplyRaw = burnComputed.burnedTotalRaw;
  const burnedTotalRaw = burnComputed.burnedTotalRaw;
  const burnedPercent = burnComputed.burnedPercent;
  const triggerWindow = computeBurnTriggerWindow(burnedTotalRaw, decimals);

  return {
    updatedAt: new Date().toISOString(),
    totalSupplyRaw: burnComputed.totalSupplyRaw.toString(),
    currentSupplyRaw: currentSupplyRaw.toString(),
    burnedBySupplyRaw: burnedBySupplyRaw.toString(),
    burnedInDeadWalletsRaw: "0",
    burnedTotalRaw: burnedTotalRaw.toString(),
    decimals,
    burnedPercent,
    completedBurnTriggers: triggerWindow.completedBurnTriggers,
    progressToNextTriggerPercent: triggerWindow.progressToNextTriggerPercent,
    tokensPerTriggerRaw:
      (triggerWindow.completedBurnTriggers === 0
        ? tokensToRaw(10_000n, decimals)
        : tokensToRaw(50_000n, decimals) * BigInt(triggerWindow.completedBurnTriggers)
      ).toString(),
    tokensToNextTriggerRaw: triggerWindow.tokensToNextTriggerRaw.toString(),
    nextTriggerAtRaw: triggerWindow.nextTriggerAtRaw.toString()
  };
}

export { formatTokenAmount };

export async function getBurnStats(mint: PublicKey): Promise<BurnStats | null> {
  const cached = normalizeCachedBurnStats(await getBurnStatsCache());
  if (cached) {
    const age = Date.now() - new Date(cached.updatedAt).getTime();
    if (age >= 0 && age < CACHE_MAX_AGE_MS) {
      return cached;
    }
  }

  try {
    const endpoint = process.env.MAINNET_ENDPOINT;
    if (!endpoint) {
      throw new Error("Missing MAINNET_ENDPOINT");
    }
    const connection = new Connection(endpoint, "confirmed");

    const mintAccount = await connection.getParsedAccountInfo(mint, "confirmed");
    if (!mintAccount.value) {
      throw new Error("Mint account not found");
    }

    const { supply: currentSupplyRaw, decimals } = parseMintSupply(mintAccount.value.data);
    const stats = buildBurnStats({
      currentSupplyRaw,
      decimals
    });

    await setBurnStatsCache(stats);
    return stats;
  } catch (err) {
    console.error("burn-stats error:", err);
    return cached ?? null;
  }
}
