export type HolderWeight = {
  owner: string;
  amountRaw: string;
};

export type InitialDraw = {
  type: "initial";
  timestamp: string;
  swapTx: string;
  transferTx: string;
  to: string;
  sentTokensRaw: string;
  note: string;
};

export type RegularDraw = {
  type: "regular";
  timestamp: string;
  slot: number;
  winner: string;
  prizeLamports: number;
  payoutTx: string;
  vrfRequestTx: string;
  vrfFulfilledTx: string;
  snapshotRawUrl: string;
  snapshotGistUrl: string;
  totalWeightRaw: string;
  randomValueHex: string;
};

export type DrawRecord = InitialDraw | RegularDraw;

export type BurnStats = {
  updatedAt: string;
  totalSupplyRaw: string;
  currentSupplyRaw: string;
  burnedBySupplyRaw: string;
  burnedInDeadWalletsRaw: string;
  burnedTotalRaw: string;
  decimals: number;
  burnedPercent: number;
  completedBurnTriggers: number;
  progressToNextTriggerPercent: number;
  tokensPerTriggerRaw: string;
  tokensToNextTriggerRaw: string;
  nextTriggerAtRaw: string;
};
