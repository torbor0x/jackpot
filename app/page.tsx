import DrawCard from "@/app/components/DrawCard";
import NextDrawCountdown from "@/app/components/NextDrawCountdown";
import TokenInfo from "@/app/components/TokenInfo";
import AlonChatModal from "@/app/components/AlonChatModal";
import { getDraws, getInitialDone } from "@/lib/kv";
import { getPublicInfo } from "@/lib/public-info";
import type { DrawRecordWithTeam } from "@/types";

export const revalidate = 30;

export default async function HomePage() {
  const [draws, initialDone, publicInfo] = await Promise.all([
    getDraws(),
    getInitialDone(),
    getPublicInfo()
  ]);
  const allDraws: DrawRecordWithTeam[] = [...draws];
  allDraws.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const displayDraws = allDraws.slice(0, 10);
  const forceShowCountdown =
    process.env.FORCE_SHOW_COUNTDOWN === "true" || process.env.NODE_ENV !== "production";
  const showCountdown = initialDone || forceShowCountdown;

  return (
    <main className="page-shell">
      <div className="bg-layer bg-layer-a" aria-hidden="true" />
      <div className="bg-layer bg-layer-b" aria-hidden="true" />
      <div className="float-field" aria-hidden="true">
        <span className="float-icon sol a" />
        <span className="float-icon sol b" />
        <span className="float-icon text c">$</span>
        <span className="float-icon text d">◎</span>
        <span className="float-icon text e">$</span>
        <span className="float-icon sol f" />
        <span className="float-icon sol g" />
        <span className="float-icon sol h" />
        <span className="float-icon text i">$</span>
        <span className="float-icon text j">◎</span>
        <span className="float-icon text k">$</span>
        <span className="float-icon text l">◎</span>
        <span className="float-icon text m">$</span>
        <span className="float-icon sol n" />
        <span className="float-icon sol o" />
        <span className="float-icon text p">◎</span>
        <span className="float-icon text q">$</span>
        <span className="float-icon sol r" />
        <span className="float-icon text s">◎</span>
        <span className="float-icon sol t" />
        <span className="float-icon text u">$</span>
        <span className="float-icon sol v" />
        <span className="float-icon text w">$</span>
        <span className="float-icon sol x" />
        <span className="float-icon text y">◎</span>
        <span className="float-icon sol z" />
        <span className="float-icon text aa">$</span>
        <span className="float-icon sol ab" />
        <span className="float-icon text ac">◎</span>
        <span className="float-icon sol ad" />
      </div>

      <div className="container">
        <header className="hero card">
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <link rel="manifest" href="/site.webmanifest" />
          <p className="eyebrow">Transparent On-Chain Lottery</p>
          <img src="/jackpot.png" alt="JackpotEx" className="hero-brand" />
          <p className="hero-subtitle">Hourly possible draws</p>
          <p className="hero-note">
            Each hour has a randomized path: creator rewards are split to the team or all accumulated
            SOL from creator fees that round is sent to a randomly selected top-100 holder. Only the
            top 100 holders are eligible per draw.
          </p>
          <TokenInfo tokenMint={publicInfo.tokenMint} embedded />
          <p className="hero-chat-note">
            This development flow was requested by Alon in internal chats.{" "}
            <AlonChatModal />
          </p>
          <div className="funded-by">
            <img src="/pumpfun-logo.png" alt="Pumpfun logo" className="funded-by-logo" />
            <p>Powered by Pumpfun creator fees</p>
          </div>
          <div className="hero-links">
            <p className="hero-links-label">Community</p>
            <a
              className="x-link"
              href="https://x.com/i/communities/2032059908913295736"
              target="_blank"
              rel="noreferrer"
              aria-label="JackpotEx community on X"
            >
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M18.9 2.1h3.6l-7.9 9 9.3 12.8h-7.3l-5.7-7.8-7.2 7.8H0l8.4-9.1L-.4 2.1h7.5l5.2 7.1 6.6-7.1zm-1.3 19.2h2L6.4 4.6h-2l13.2 16.7z" />
              </svg>
            </a>
          </div>
        </header>

        {showCountdown ? (
          <NextDrawCountdown
            currentDrawSol={publicInfo.currentDrawSol}
            payerPubkey={publicInfo.payerPubkey}
            burnStats={publicInfo.burnStats}
          />
        ) : null}

        <section className="card section-card">
          <h2>How It Works</h2>
          <ul className="work-list">
            <li>Snapshot holders for the token mint and select only the top 100 holders by balance.</li>
            <li>Publish eligible-holder JSON snapshot to a public GitHub Gist.</li>
            <li>Request randomness from ORAO VRF on-chain.</li>
            <li>Run weighted selection from holder balances and VRF randomness.</li>
            <li>Send on-chain prize transfer with memo linking proof sources.</li>
          </ul>
        </section>

        <section>
          <div className="section-heading">
            <h2>Last 10 Draws</h2>
            <p className="meta">Newest first with full verification links.</p>
          </div>
          <div className="grid draws-grid">
            {displayDraws.length === 0 ? <div className="card">No draws recorded yet.</div> : null}
            {displayDraws.map((d, i) => (
              <DrawCard key={`${d.timestamp}-${i}`} draw={d} />
            ))}
          </div>
        </section>

        <footer className="footer-row">
          <span>Hourly possible draws. All verifiable on-chain.</span>
          <a
            className="x-link"
            href="https://x.com/i/communities/2032059908913295736"
            target="_blank"
            rel="noreferrer"
            aria-label="JackpotEx community on X"
          >
            <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path d="M18.9 2.1h3.6l-7.9 9 9.3 12.8h-7.3l-5.7-7.8-7.2 7.8H0l8.4-9.1L-.4 2.1h7.5l5.2 7.1 6.6-7.1zm-1.3 19.2h2L6.4 4.6h-2l13.2 16.7z" />
            </svg>
          </a>
        </footer>
      </div>
    </main>
  );
}
