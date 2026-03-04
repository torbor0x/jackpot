import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export const toSol = (lamports: number | bigint): string =>
  (Number(lamports) / LAMPORTS_PER_SOL).toFixed(4);
