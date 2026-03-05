import CopyMintButton from "@/app/components/CopyMintButton";

type Props = {
  tokenMint: string | null;
  embedded?: boolean;
};

export default function TokenInfo({ tokenMint, embedded = false }: Props) {
  const mint = tokenMint ?? "Not configured";
  const mintLink = tokenMint ? `https://solscan.io/token/${tokenMint}` : null;
  const wrapperClass = embedded ? "token-inline" : "card token-panel";

  return (
    <section className={wrapperClass}>
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
