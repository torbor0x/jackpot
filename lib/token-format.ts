export function formatTokenAmount(raw: string, decimals: number): string {
  const value = BigInt(raw);
  if (decimals <= 0) {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  const negative = value < 0n;
  const abs = negative ? -value : value;
  const digits = abs.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, -decimals);
  const fracFull = digits.slice(-decimals);
  const fracTrimmed = fracFull.replace(/0+$/, "").slice(0, 4);
  const wholeGrouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = negative ? "-" : "";
  return fracTrimmed ? `${sign}${wholeGrouped}.${fracTrimmed}` : `${sign}${wholeGrouped}`;
}
