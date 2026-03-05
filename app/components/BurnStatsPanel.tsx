import { formatTokenAmount } from "@/lib/token-format";
import type { BurnStats } from "@/types";

type Props = {
  burnStats: BurnStats | null;
  compact?: boolean;
};

export default function BurnStatsPanel({ burnStats, compact = false }: Props) {
  const wrapperClass = compact ? "burn-panel burn-panel-embedded" : "card burn-panel";

  if (!burnStats) {
    return (
      <section className={wrapperClass}>
        <h2>Burn Tracker</h2>
        <p className="meta">Burn statistics are currently unavailable.</p>
      </section>
    );
  }

  const burntTotal = formatTokenAmount(burnStats.burnedTotalRaw, burnStats.decimals);
  const totalSupply = formatTokenAmount(burnStats.totalSupplyRaw, burnStats.decimals);
  const toNext = formatTokenAmount(burnStats.tokensToNextTriggerRaw, burnStats.decimals);
  const progress = Math.max(0, Math.min(100, burnStats.progressToNextTriggerPercent));

  return (
    <section className={wrapperClass}>
      <div className="burn-head">
        <h2>Burn Tracker</h2>
        <p className="pill">{burnStats.burnedPercent.toFixed(2)}% Burned</p>
      </div>
      <p className="hero-note">
        To trigger a forced jackpot, anyone can burn tokens. Use{" "}
        <a href="https://sol-incinerator.com/" target="_blank" rel="noreferrer">
          SOL-Incinerator
        </a>{" "}
        or send tokens to deployer for burn.
      </p>
      <div className="burn-grid">
        <div className="stat">
          <p className="stat-label">Total Burned</p>
          <p className="stat-value">{burntTotal}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Total Supply Baseline</p>
          <p className="stat-value">{totalSupply}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Burn Triggers Hit</p>
          <p className="stat-value">{burnStats.completedBurnTriggers}</p>
        </div>
        <div className="stat">
          <p className="stat-label">To Next Burn Trigger</p>
          <p className="stat-value">{toNext}</p>
        </div>
      </div>
      <div className="burn-progress-wrap">
        <div className="burn-icon" aria-hidden="true">
          🔥
        </div>
        <div className="burn-progress">
          <div className="burn-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="meta">{progress.toFixed(2)}% progress to next burn trigger</p>
      </div>
    </section>
  );
}
