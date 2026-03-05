"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTokenAmount } from "@/lib/token-format";
import type { BurnStats } from "@/types";

type Props = {
  currentDrawSol: number | null;
  payerPubkey: string | null;
  burnStats: BurnStats | null;
};

function msToNextHour(now: Date): number {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next.getTime() - now.getTime();
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function NextDrawCountdown({ currentDrawSol, payerPubkey, burnStats }: Props) {
  const [remainingMs, setRemainingMs] = useState<number>(() => msToNextHour(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingMs(msToNextHour(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const label = useMemo(() => formatRemaining(remainingMs), [remainingMs]);
  const drawValue =
    currentDrawSol === null ? "Unavailable" : `${currentDrawSol.toFixed(4)} SOL`;
  const walletUrl = payerPubkey ? `https://solscan.io/account/${payerPubkey}` : null;
  const brandedPrefix = "JackpotEx";
  const prefixLen = brandedPrefix.length;
  const actualPrefix = payerPubkey?.slice(0, prefixLen) ?? "";
  const hasBrandedPrefix = actualPrefix.toLowerCase() === brandedPrefix.toLowerCase();
  const totalBurned =
    burnStats === null ? "Unavailable" : formatTokenAmount(burnStats.burnedTotalRaw, burnStats.decimals);
  const totalSupply =
    burnStats === null ? "Unavailable" : formatTokenAmount(burnStats.totalSupplyRaw, burnStats.decimals);
  const toNext =
    burnStats === null
      ? "Unavailable"
      : formatTokenAmount(burnStats.tokensToNextTriggerRaw, burnStats.decimals);
  const nextTriggerAt =
    burnStats === null
      ? "Unavailable"
      : formatTokenAmount(burnStats.nextTriggerAtRaw ?? "0", burnStats.decimals);
  const burnProgress =
    burnStats === null ? 0 : Math.max(0, Math.min(100, burnStats.progressToNextTriggerPercent));
  const burnPointerPos = Math.max(2, Math.min(98, burnProgress));
  const burnPointerDirectionClass =
    burnProgress <= 10
      ? "burn-progress-pointer-right"
      : burnProgress >= 90
        ? "burn-progress-pointer-left"
        : "burn-progress-pointer-pulse";

  return (
    <section className="countdown-card" aria-live="polite">
      <div className="countdown-grid">
        <div>
          <p className="countdown-label">Next chance of jackpot</p>
          <p className="countdown-time">{label}</p>
          <p className="countdown-sub">Hourly possible draws.</p>
        </div>
        <div className="draw-balance-box">
          <p className="countdown-label">Current Draw Balance</p>
          <p className="draw-balance-value">{drawValue}</p>
        </div>
      </div>
      {walletUrl ? (
        <>
          <p className="countdown-wallet-note">
            <a href={walletUrl} target="_blank" rel="noreferrer">
              Click here to check dev wallet
            </a>{" "}
            and validate balance + transactions.
          </p>
          <div className="deployer-pill">
            <p className="deployer-label">Deployer Pubkey</p>
            <p className="deployer-key mono">
              {hasBrandedPrefix ? (
                <>
                  <span className="deployer-prefix">{actualPrefix}</span>
                  {payerPubkey?.slice(prefixLen)}
                </>
              ) : (
                payerPubkey
              )}
            </p>
          </div>
        </>
      ) : null}
      <div className="countdown-burn-block">
        <div className="burn-head">
          <h2>Burn Tracker</h2>
          <p className="pill">{burnStats ? `${burnStats.burnedPercent.toFixed(2)}% Burned` : "Unavailable"}</p>
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
            <p className="stat-value">{totalBurned}</p>
          </div>
          <div className="stat">
            <p className="stat-label">Total Burned (%)</p>
            <p className="stat-value">
              {burnStats ? `${burnStats.burnedPercent.toFixed(4)}%` : "Unavailable"}
            </p>
          </div>
          <div className="stat">
            <p className="stat-label">Total Supply</p>
            <p className="stat-value">{totalSupply}</p>
          </div>
          <div className="stat">
            <p className="stat-label">Next Trigger At</p>
            <p className="stat-value">{nextTriggerAt}</p>
          </div>
          <div className="stat">
            <p className="stat-label">Burn Triggers Hit</p>
            <p className="stat-value">{burnStats?.completedBurnTriggers ?? "Unavailable"}</p>
          </div>
          <div className="stat">
            <p className="stat-label">To Next Burn Trigger</p>
            <p className="stat-value">{toNext}</p>
          </div>
        </div>
        <div className="burn-progress-wrap">
          <div className="burn-progress">
            <div className="burn-progress-fill" style={{ width: `${burnProgress}%` }} />
            <div
              className={`burn-progress-pointer ${burnPointerDirectionClass}`}
              style={{ left: `${burnPointerPos}%` }}
              aria-hidden="true"
            >
              🔥
            </div>
          </div>
          <p className="meta">{burnProgress.toFixed(2)}% progress to next burn trigger</p>
        </div>
      </div>
    </section>
  );
}
