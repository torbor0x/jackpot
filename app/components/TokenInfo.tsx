import CopyMintButton from "@/app/components/CopyMintButton";

type Props = {
  tokenName: string;
  tokenMint: string | null;
};

export default function TokenInfo({ tokenName, tokenMint }: Props) {
  const displayName = tokenName === "Jackpot" ? "JackpotEx" : tokenName;
  const mint = tokenMint ?? "Not configured";
  const mintLink = tokenMint ? `https://solscan.io/token/${tokenMint}` : null;

  return (
    <section className="card token-panel">
      <h2>Token Information</h2>
      <div className="token-grid">
        <div className="stat">
          <p className="stat-label">Name</p>
          <p className="stat-value">{displayName}</p>
        </div>
      </div>
      <div className="ca-box">
        <div>
          <p className="stat-label">CA</p>
          <p className="ca-value stat-mono">
            {mintLink ? (
              <a href={mintLink} target="_blank" rel="noreferrer">
                {mint}
              </a>
            ) : (
              mint
            )}
          </p>
        </div>
        {tokenMint ? <CopyMintButton value={tokenMint} /> : null}
      </div>
    </section>
  );
}
