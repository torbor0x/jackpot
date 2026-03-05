import { TOKEN_MINT } from "@/lib/solana";
import { ELIGIBLE_HOLDER_LIMIT, getHolderSnapshotByOwner } from "@/lib/holders";
import { uploadSnapshotToGist } from "@/lib/gist";

async function main() {
  const startedAt = new Date().toISOString();
  const snapshot = await getHolderSnapshotByOwner(TOKEN_MINT);
  const totalWeight = snapshot.reduce((sum, h) => sum + BigInt(h.amountRaw), 0n);

  const gist = await uploadSnapshotToGist(snapshot);

  console.log("Live Snapshot Generated");
  console.log(`timestamp: ${startedAt}`);
  console.log(`mint: ${TOKEN_MINT.toBase58()}`);
  console.log(`eligible_holders_limit: ${ELIGIBLE_HOLDER_LIMIT}`);
  console.log(`eligible_holders_count: ${snapshot.length}`);
  console.log(`total_weight_raw: ${totalWeight.toString()}`);
  if (snapshot[0]) {
    console.log(`largest_holder: ${snapshot[0].owner} (${snapshot[0].amountRaw})`);
  }
  console.log(`gist_url: ${gist.gistUrl}`);
  console.log(`snapshot_raw_url: ${gist.rawUrl}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
