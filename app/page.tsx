import DrawCard from "@/app/components/DrawCard";
import NextDrawCountdown from "@/app/components/NextDrawCountdown";
import TokenInfo from "@/app/components/TokenInfo";
import { getDraws, getInitialDone } from "@/lib/kv";
import { getPublicInfo } from "@/lib/public-info";

export const revalidate = 30;

export default async function HomePage() {
  const [draws, initialDone, publicInfo] = await Promise.all([
    getDraws(),
    getInitialDone(),
    getPublicInfo()
  ]);
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
          <p className="eyebrow">Transparent On-Chain Lottery</p>
          <p className="theme-signature">JACKPOTEX // FUTURE PROOF MODE</p>
          <img src="/jackpot.png" alt="JackpotEx" className="hero-brand" />
          <p className="hero-subtitle">Provably Fair Weighted Random Holder Draws</p>
          <p className="hero-note">
            The initial round is a buyback — all tokens purchased go to Alon. Regular draws start hourly
            afterward with SOL prizes to random holders. Only the top 100 holders are eligible per draw.
          </p>
          <div className="funded-by">
            <img src="/pumpfun-logo.png" alt="Pumpfun logo" className="funded-by-logo" />
            <p>Powered by Pumpfun creator fees</p>
          </div>
        </header>

        {showCountdown ? (
          <NextDrawCountdown
            currentDrawSol={publicInfo.currentDrawSol}
            payerPubkey={publicInfo.payerPubkey}
          />
        ) : null}

        <TokenInfo tokenName={publicInfo.tokenName} tokenMint={publicInfo.tokenMint} />

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
            {draws.length === 0 ? <div className="card">No draws recorded yet.</div> : null}
            {draws.map((d, i) => (
              <DrawCard key={`${d.timestamp}-${i}`} draw={d} />
            ))}
          </div>
        </section>

        <footer>Draws run automatically every hour after initial round. All verifiable on-chain.</footer>
      </div>
    </main>
  );
}
