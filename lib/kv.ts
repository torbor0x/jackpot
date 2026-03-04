import { kv } from "@vercel/kv";
import fs from "node:fs/promises";
import path from "node:path";
import type { DrawRecord } from "@/types";

const DRAWS_KEY = "jackpot-draws";
const INITIAL_DONE_KEY = "initial-round-completed";
const LOCAL_KV_PATH = path.join(process.cwd(), ".local-kv", "jackpot-kv.json");

type LocalKvState = {
  [DRAWS_KEY]: DrawRecord[];
  [INITIAL_DONE_KEY]: boolean;
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

async function readLocalState(): Promise<LocalKvState> {
  try {
    const raw = await fs.readFile(LOCAL_KV_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalKvState>;
    return {
      [DRAWS_KEY]: Array.isArray(parsed[DRAWS_KEY]) ? parsed[DRAWS_KEY] : [],
      [INITIAL_DONE_KEY]: Boolean(parsed[INITIAL_DONE_KEY])
    };
  } catch {
    return {
      [DRAWS_KEY]: [],
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
    return state[DRAWS_KEY];
  }
  const draws = await kv.get<DrawRecord[]>(DRAWS_KEY);
  return Array.isArray(draws) ? draws : [];
}

export async function addDraw(draw: DrawRecord): Promise<void> {
  if (shouldUseLocalKv()) {
    const state = await readLocalState();
    state[DRAWS_KEY] = [draw, ...state[DRAWS_KEY]].slice(0, 10);
    await writeLocalState(state);
    return;
  }
  const current = await getDraws();
  const next = [draw, ...current].slice(0, 10);
  await kv.set(DRAWS_KEY, next);
}
