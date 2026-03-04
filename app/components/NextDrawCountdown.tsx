"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  currentDrawSol: number | null;
  payerPubkey: string | null;
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

export default function NextDrawCountdown({ currentDrawSol, payerPubkey }: Props) {
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

  return (
    <section className="countdown-card" aria-live="polite">
      <div className="countdown-grid">
        <div>
          <p className="countdown-label">Next Draw In</p>
          <p className="countdown-time">{label}</p>
          <p className="countdown-sub">Draws every hour.</p>
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
    </section>
  );
}
