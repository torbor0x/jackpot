export function tokenUiToRaw(value: number, decimals: number): bigint {
  if (!Number.isFinite(value) || value <= 0) {
    return 0n;
  }
  const scale = 10 ** Math.max(0, decimals);
  return BigInt(Math.round(value * scale));
}
