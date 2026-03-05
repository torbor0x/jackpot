import { toSol } from "@/lib/format";
import type { DrawRecord } from "@/types";

export default function DrawCard({ draw }: { draw: DrawRecord }) {
  const ts = new Date(draw.timestamp).toLocaleString("en-US", { timeZone: "UTC" });

  if (draw.type === "initial") {
    return (
      <article className="card draw-card initial-draw">
        <div className="draw-header-row">
          <p className="pill">Initial Buyback</p>
          <p className="meta">{ts} UTC</p>
        </div>

        <div className="initial-draw-layout">
          <dl className="draw-data">
            <div>
              <dt>Recipient</dt>
              <dd className="mono">{draw.to}</dd>
            </div>
            <div>
              <dt>Sent Tokens (raw)</dt>
              <dd>{draw.sentTokensRaw}</dd>
            </div>
          </dl>
          <div className="alon-pfp-ring">
            <img src="/alon.jpg" alt="Alon profile picture" className="alon-pfp" />
          </div>
        </div>

        <div className="link-row">
          <a href={`https://solscan.io/tx/${draw.swapTx}`} target="_blank" rel="noreferrer">
            Swap Tx
          </a>
          <a href={`https://solscan.io/tx/${draw.transferTx}`} target="_blank" rel="noreferrer">
            Transfer Tx
          </a>
        </div>
      </article>
    );
  }

  return (
    <article className="card draw-card regular-draw">
      <div className="draw-header-row">
        <p className="pill">Hourly Draw</p>
        <p className="meta">{ts} UTC</p>
      </div>

      <dl className="draw-data">
        <div>
          <dt>Winner</dt>
          <dd className="mono">{draw.winner}</dd>
        </div>
        <div>
          <dt>Prize</dt>
          <dd>{toSol(draw.prizeLamports)} SOL</dd>
        </div>
      </dl>

      <div className="link-row">
        <a href={`https://solscan.io/tx/${draw.payoutTx}`} target="_blank" rel="noreferrer">
          Payout Tx
        </a>
        <a href={`https://solscan.io/tx/${draw.vrfRequestTx}`} target="_blank" rel="noreferrer">
          VRF Request
        </a>
        <a href={`https://solscan.io/tx/${draw.vrfFulfilledTx}`} target="_blank" rel="noreferrer">
          VRF Fulfilled
        </a>
        <a href={draw.snapshotRawUrl} target="_blank" rel="noreferrer">
          Snapshot JSON
        </a>
        <a href={draw.snapshotGistUrl} target="_blank" rel="noreferrer">
          Snapshot Gist
        </a>
      </div>
    </article>
  );
}
