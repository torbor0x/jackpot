import { kv } from "@vercel/kv";
import fs from "node:fs/promises";
import path from "node:path";
import type { BurnStats, DrawRecord, InitialDraw, RegularDraw, TeamDistributionDraw } from "@/types";
import type { TeamDistributionRecord } from "@/types";

const LEGACY_DRAWS_KEY = "jackpotex-draws";
const REGULAR_DRAWS_KEY = "jackpotex-regular-draws";
const INITIAL_DRAW_KEY = "jackpotex-initial-draw";
const INITIAL_DONE_KEY = "initial-round-completed";
const BURN_STATS_KEY = "jackpotex-burn-stats";
const BURN_TRIGGER_PAID_KEY = "jackpotex-burn-trigger-paid";
const TEAM_DISTRIBUTION_KEY = "jackpotex-team-distribution";
const LOCAL_KV_PATH = path.join(process.cwd(), ".local-kv", "jackpotex-kv.json");

type LocalKvState = {
  [REGULAR_DRAWS_KEY]: (RegularDraw | TeamDistributionDraw)[];
  [INITIAL_DRAW_KEY]: InitialDraw | null;
  [LEGACY_DRAWS_KEY]?: DrawRecord[];
  [INITIAL_DONE_KEY]: boolean;
  [BURN_STATS_KEY]?: BurnStats;
  [BURN_TRIGGER_PAID_KEY]?: number;
  [TEAM_DISTRIBUTION_KEY]?: TeamDistributionRecord;
};

const hasRemoteKvEnv =
  Boolean(process.env.KV_REST_API_URL) && Boolean(process.env.KV_REST_API_TOKEN);

function shouldUseLocalKv(): boolean {
  const mode = (process.env.KV_MODE ?? "auto").toLowerCase();
  if (mode === "local") {
    return true;
  }
  if (mode === "remote") {
    return false;
  }
  return !hasRemoteKvEnv || process.env.NODE_ENV !== "production";
}

function splitDraws(draws: DrawRecord[]): {
  initial: InitialDraw | null;
  regular: (RegularDraw | TeamDistributionDraw)[];
} {
  let initial: InitialDraw | null = null;
  const regular: (RegularDraw | TeamDistributionDraw)[] = [];

  for (const d of draws) {
    if (d.type === "initial") {
      if (!initial) {
        initial = d;
      }
      continue;
    }
    regular.push(d as RegularDraw | TeamDistributionDraw);
  }

  return { initial, regular };
}

function combineDraws(
  initial: InitialDraw | null,
  regular: (RegularDraw | TeamDistributionDraw)[]
): DrawRecord[] {
  const nextRegular = regular.slice(0, initial ? 9 : 10);
  return initial ? [initial, ...nextRegular] : nextRegular;
}

async function readLocalState(): Promise<LocalKvState> {
  try {
    const raw = await fs.readFile(LOCAL_KV_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalKvState>;

    const initialRaw = parsed[INITIAL_DRAW_KEY];
    const regularRaw = parsed[REGULAR_DRAWS_KEY];
    const legacyRaw = parsed[LEGACY_DRAWS_KEY];

    const initial =
      initialRaw && typeof initialRaw === "object" && initialRaw.type === "initial"
        ? (initialRaw as InitialDraw)
        : null;
    const regular = Array.isArray(regularRaw)
      ? regularRaw.filter(
          (d): d is RegularDraw | TeamDistributionDraw =>
            Boolean(d && (d.type === "regular" || d.type === "team"))
        )
      : [];
    const legacy = Array.isArray(legacyRaw) ? legacyRaw : [];

    if (!initial && regular.length === 0 && legacy.length > 0) {
      const migrated = splitDraws(legacy);
      return {
        [REGULAR_DRAWS_KEY]: migrated.regular.slice(0, 9),
        [INITIAL_DRAW_KEY]: migrated.initial,
        [INITIAL_DONE_KEY]: Boolean(parsed[INITIAL_DONE_KEY])
      };
    }

    return {
      [REGULAR_DRAWS_KEY]: regular,
      [INITIAL_DRAW_KEY]: initial,
      [INITIAL_DONE_KEY]: Boolean(parsed[INITIAL_DONE_KEY])
    };
  } catch {
    return {
      [REGULAR_DRAWS_KEY]: [],
      [INITIAL_DRAW_KEY]: null,
      [INITIAL_DONE_KEY]: false
    };
  }
}

async function writeLocalState(state: LocalKvState): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_KV_PATH), { recursive: true });
  await fs.writeFile(LOCAL_KV_PATH, JSON.stringify(state, null, 2), "utf8");
}

export async function getInitialDone(): Promise<boolean> {
  if (shouldUseLocalKv()) {
    const state = await readLocalState();
    return state[INITIAL_DONE_KEY];
  }
  const v = await kv.get<boolean>(INITIAL_DONE_KEY);
  return Boolean(v);
}

export async function setInitialDone(value: boolean): Promise<void> {
  if (shouldUseLocalKv()) {
    const state = await readLocalState();
    state[INITIAL_DONE_KEY] = value;
    await writeLocalState(state);
    return;
  }
  await kv.set(INITIAL_DONE_KEY, value);
}

export async function getDraws(): Promise<DrawRecord[]> {
  if (shouldUseLocalKv()) {
    const state = await readLocalState();
    const combined = combineDraws(state[INITIAL_DRAW_KEY], state[REGULAR_DRAWS_KEY]);
    const team = state[TEAM_DISTRIBUTION_KEY];
    if (team) {
      combined.push({ type: "team", ...team });
    }
    return combined;
  }
  const [initial, regular] = await Promise.all([
    kv.get<InitialDraw>(INITIAL_DRAW_KEY),
    kv.get<(RegularDraw | TeamDistributionDraw)[]>(REGULAR_DRAWS_KEY)
  ]);

  const validInitial =
    initial && typeof initial === "object" && initial.type === "initial" ? initial : null;
  const validRegular = Array.isArray(regular)
    ? regular.filter(
        (d): d is RegularDraw | TeamDistributionDraw =>
          Boolean(d && (d.type === "regular" || d.type === "team"))
      )
    : [];

  if (validInitial || validRegular.length > 0) {
    const combined = combineDraws(validInitial, validRegular);
    const team = await kv.get<TeamDistributionRecord>(TEAM_DISTRIBUTION_KEY);
    if (team) {
      combined.push({ type: "team", ...team });
    }
    return combined;
  }

  const legacy = await kv.get<DrawRecord[]>(LEGACY_DRAWS_KEY);
  if (!Array.isArray(legacy)) {
    return [];
  }
  const split = splitDraws(legacy);
  return combineDraws(split.initial, split.regular);
}

export async function addDraw(draw: DrawRecord): Promise<void> {
  if (shouldUseLocalKv()) {
    const state = await readLocalState();
    if (draw.type === "initial") {
      state[INITIAL_DRAW_KEY] = draw;
    } else {
      state[REGULAR_DRAWS_KEY] = [draw, ...state[REGULAR_DRAWS_KEY]].slice(0, 9);
    }
    await writeLocalState(state);
    return;
  }
  if (draw.type === "initial") {
    await kv.set(INITIAL_DRAW_KEY, draw);
    return;
  }
  const current = await kv.get<(RegularDraw | TeamDistributionDraw)[]>(REGULAR_DRAWS_KEY);
  const next = [draw, ...(Array.isArray(current) ? current : [])].slice(0, 9);
  await kv.set(REGULAR_DRAWS_KEY, next);
}

export async function getBurnTriggerPaid(): Promise<number> {
  if (shouldUseLocalKv()) {
    const state = await readLocalState();
    return Number(state[BURN_TRIGGER_PAID_KEY] ?? 0);
  }
  const v = await kv.get<number>(BURN_TRIGGER_PAID_KEY);
  return Number(v ?? 0);
}

export async function setBurnTriggerPaid(value: number): Promise<void> {
  if (shouldUseLocalKv()) {
    const state = await readLocalState();
    state[BURN_TRIGGER_PAID_KEY] = value;
    await writeLocalState(state);
    return;
  }
  await kv.set(BURN_TRIGGER_PAID_KEY, value);
}

export async function getTeamDistribution(): Promise<TeamDistributionRecord | null> {
  if (shouldUseLocalKv()) {
    const state = await readLocalState();
    return state[TEAM_DISTRIBUTION_KEY] ?? null;
  }
  const v = await kv.get<TeamDistributionRecord>(TEAM_DISTRIBUTION_KEY);
  return v ?? null;
}

export async function setTeamDistribution(value: TeamDistributionRecord): Promise<void> {
  if (shouldUseLocalKv()) {
    const state = await readLocalState();
    state[TEAM_DISTRIBUTION_KEY] = value;
    await writeLocalState(state);
    return;
  }
  await kv.set(TEAM_DISTRIBUTION_KEY, value);
}

export async function getBurnStatsCache(): Promise<BurnStats | null> {
  if (shouldUseLocalKv()) {
    const state = await readLocalState();
    return state[BURN_STATS_KEY] ?? null;
  }
  const cached = await kv.get<BurnStats>(BURN_STATS_KEY);
  return cached ?? null;
}

export async function setBurnStatsCache(stats: BurnStats): Promise<void> {
  if (shouldUseLocalKv()) {
    const state = await readLocalState();
    state[BURN_STATS_KEY] = stats;
    await writeLocalState(state);
    return;
  }
  await kv.set(BURN_STATS_KEY, stats);
}
