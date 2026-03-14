import bs58 from "bs58";
import crypto from "node:crypto";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Orao } from "@orao-network/solana-vrf";

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env: ${name}`);
  }
  return v;
};

export const MAINNET_ENDPOINT = required("MAINNET_ENDPOINT");
export const MAINNET_WSS_ENDPOINT = process.env.MAINNET_WSS_ENDPOINT ?? "";
export const TOKEN_MINT = new PublicKey(required("TOKEN_MINT"));
export const TOKEN_NAME = required("TOKEN_NAME");
export const JACKPOT_WEBSITE_URL = required("JACKPOT_WEBSITE_URL");
export const TEAM_WALLET_TORBOR = new PublicKey(
  process.env.TEAM_WALLET_TORBOR ?? "CvMJMaHtGA1acs17bPQbhPxFim97HyLTXaZQHckCToRb"
);
export const TEAM_WALLET_PEACHIE = new PublicKey(
  process.env.TEAM_WALLET_PEACHIE ?? "AJ3uhNTZAQETZPGsxZZit7xPerioZNpuTeRmqGiERie1"
);
export const TEAM_WALLET_JESSE = new PublicKey(
  process.env.TEAM_WALLET_JESSE ?? "7YpRbrJzjykgaEbWMrRrZASdEeieYEyoV3FB2MGvEXbR"
);

export const PRIZE_LAMPORTS = Number(required("PRIZE_LAMPORTS"));
export const RESERVE_LAMPORTS_FOR_FEES = Number(required("RESERVE_LAMPORTS_FOR_FEES"));
export const MIN_DISTRIBUTION_LAMPORTS = Number(
  process.env.MIN_DISTRIBUTION_LAMPORTS ?? String(1 * LAMPORTS_PER_SOL)
);
export const SPLIT_DISTRIBUTION_LAMPORTS = Number(
  process.env.SPLIT_DISTRIBUTION_LAMPORTS ?? String(PRIZE_LAMPORTS)
);

export const connection = new Connection(MAINNET_ENDPOINT, {
  commitment: "confirmed",
  wsEndpoint: MAINNET_WSS_ENDPOINT || undefined
});

const secret = bs58.decode(required("PAYER_SECRET_KEY"));
export const payer = Keypair.fromSecretKey(secret);

export const toSol = (lamports: number | bigint): string =>
  (Number(lamports) / LAMPORTS_PER_SOL).toFixed(4);

const sigFromUnknown = (x: unknown): string => {
  if (typeof x === "string") {
    return x;
  }

  if (x && typeof x === "object") {
    const maybe = x as Record<string, unknown>;
    for (const k of ["signature", "tx", "txid"]) {
      if (typeof maybe[k] === "string") {
        return maybe[k] as string;
      }
    }
  }

  return "";
};

export async function requestVrfRandomness(maxWaitMs = 60_000): Promise<{
  randomBytes: Buffer;
  randomHex: string;
  requestTx: string;
  fulfilledTx: string;
  fallback: boolean;
}> {
  const seed = crypto.randomBytes(32);
  try {
    const orao: any = new (Orao as any)(connection, payer);

    const requestRes = await orao.request(seed);
    const requestTx = sigFromUnknown(requestRes);

    const start = Date.now();
    let fulfilledTx = requestTx;
    let randomBytes: Buffer | null = null;

    // Avoid ORAO waitFulfilled to prevent WS-only signatureSubscribe dependency.

    while (!randomBytes && Date.now() - start < maxWaitMs) {
      const state = await orao.getRandomness?.(seed);
      const r = state?.randomness ?? state?.fulfilledRandomness;
      if (r) {
        randomBytes = Buffer.from(r);
        fulfilledTx = sigFromUnknown(state) || fulfilledTx;
        break;
      }
      await new Promise((rsv) => setTimeout(rsv, 1500));
    }

    if (!randomBytes || randomBytes.length === 0) {
      throw new Error("ORAO VRF not fulfilled within timeout");
    }

    return {
      randomBytes,
      randomHex: randomBytes.toString("hex"),
      requestTx,
      fulfilledTx,
      fallback: false
    };
  } catch (err) {
    const allowFallback = (process.env.VRF_REQUIRED ?? "true").toLowerCase() !== "true";
    if (!allowFallback) {
      throw err;
    }
    const randomBytes = crypto.randomBytes(32);
    return {
      randomBytes,
      randomHex: randomBytes.toString("hex"),
      requestTx: "",
      fulfilledTx: "",
      fallback: true
    };
  }
}
