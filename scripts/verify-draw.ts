import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { HolderWeight, RegularDraw } from "../types";

function usage(): never {
  throw new Error(
    [
      "Usage:",
      "  npm run verify:draw -- --snapshot <path-or-url> --randomHex <hex>",
      "Optional:",
      "  --expectedWinner <pubkey>",
      "  --draw <path-to-regular-draw-json>"
    ].join("\n")
  );
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--") || !value || value.startsWith("--")) {
      usage();
    }
    out[key.slice(2)] = value;
    i += 1;
  }
  return out;
}

async function readText(pathOrUrl: string): Promise<string> {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    const res = await fetch(pathOrUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to fetch snapshot: ${res.status} ${res.statusText}`);
    }
    return await res.text();
  }
  const abs = path.resolve(pathOrUrl);
  return fs.readFile(abs, "utf8");
}

function pickWeightedWinner(snapshot: HolderWeight[], randomHex: string): {
  winner: string;
  totalWeight: bigint;
  randomModulo: bigint;
} {
  const normalizedHex = randomHex.replace(/^0x/, "").toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalizedHex)) {
    throw new Error("randomHex must be valid hex");
  }

  const totalWeight = snapshot.reduce((sum, h) => sum + BigInt(h.amountRaw), 0n);
  if (totalWeight <= 0n) {
    throw new Error("Total holder weight is zero");
  }

  const randomModulo = BigInt(`0x${normalizedHex}`) % totalWeight;

  let cursor = 0n;
  for (const h of snapshot) {
    cursor += BigInt(h.amountRaw);
    if (randomModulo < cursor) {
      return { winner: h.owner, totalWeight, randomModulo };
    }
  }

  return {
    winner: snapshot[snapshot.length - 1].owner,
    totalWeight,
    randomModulo
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let snapshotPath = args.snapshot;
  let randomHex = args.randomHex;
  const expectedWinnerFromArg = args.expectedWinner;

  if (args.draw) {
    const drawText = await readText(args.draw);
    const draw: RegularDraw = JSON.parse(drawText);
    if (draw.type !== "regular") {
      throw new Error("draw JSON must be a regular draw record");
    }
    snapshotPath = snapshotPath ?? draw.snapshotRawUrl;
    randomHex = randomHex ?? draw.randomValueHex;
  }

  if (!snapshotPath || !randomHex) {
    usage();
  }

  const text = await readText(snapshotPath);
  const snapshot: HolderWeight[] = JSON.parse(text);
  if (!Array.isArray(snapshot) || snapshot.length === 0) {
    throw new Error("Snapshot JSON must be a non-empty array");
  }

  const sortedSnapshot = [...snapshot].sort((a, b) => a.owner.localeCompare(b.owner));
  const result = pickWeightedWinner(sortedSnapshot, randomHex);

  console.log("Verification Result");
  console.log(`snapshotSource: ${snapshotPath}`);
  console.log(`holders: ${sortedSnapshot.length}`);
  console.log(`totalWeightRaw: ${result.totalWeight.toString()}`);
  console.log(`randomHex: ${randomHex}`);
  console.log(`randomModulo: ${result.randomModulo.toString()}`);
  console.log(`winner: ${result.winner}`);

  const expected = expectedWinnerFromArg;
  if (expected) {
    const matches = expected === result.winner;
    console.log(`expectedWinner: ${expected}`);
    console.log(`match: ${matches ? "YES" : "NO"}`);
    if (!matches) {
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
