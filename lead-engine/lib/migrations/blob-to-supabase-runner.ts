import { get, head } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";
import { blobToken } from "../db/blob-token";
import { normalizeState, type DbState } from "../db/types";
import {
  migrationCounts,
  panenkaPreview,
  sourceIds,
  stateToSupabaseRows,
  SUPABASE_TABLE_ORDER,
  type MigrationTable,
} from "./blob-to-supabase";

const BATCH = 200;
const PATH = process.env.LEAD_ENGINE_BLOB_PATH || "lead-engine/db-v2.json";
const SNAP = PATH.replace(/\\.json$/, "") + "-snap/";

function snapPath(etag: string) {
  return SNAP + etag.replace(/[^a-zA-Z0-9]/g, "") + ".json";
}

type Options = { apply: boolean; allowNonEmpty?: boolean };

async function readText(pathname: string): Promise<string | null> {
  const res = await get(pathname, { access: "private", useCache: false, token: blobToken() });
  if (!res || res.statusCode !== 200) return null;
  return await new Response(res.stream).text();
}

export async function readBlobStateForMigration(): Promise<{ state: DbState; etag: string }> {
  const meta = await head(PATH, { token: blobToken() }).catch(() => null);
  if (!meta) throw new Error("Blob zdroj " + PATH + " sa nenašiel alebo k nemu nemáme prístup.");
  const text = (await readText(snapPath(meta.etag))) ?? (await readText(PATH));
  if (!text) throw new Error("Blob databázu sa nepodarilo načítať.");

  let parsed: DbState;
  try {
    parsed = JSON.parse(text) as DbState;
  } catch {
    throw new Error("Blob databáza neobsahuje platný JSON.");
  }
  return { state: normalizeState(parsed), etag: meta.etag };
}

function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Chýba SUPABASE_URL alebo SUPABASE_SERVICE_ROLE_KEY.");
  return { url, key };
}

async function tableCount(sb: ReturnType<typeof createClient>, table: MigrationTable): Promise<number> {
  const result = await sb.from(table).select("*", { count: "exact", head: true });
  if (result.error) throw new Error("Supabase " + table + ": " + result.error.message);
  return result.count ?? 0;
}

async function destinationCounts(sb: ReturnType<typeof createClient>) {
  const entries = await Promise.all(
    SUPABASE_TABLE_ORDER.map(async (table) => [table, await tableCount(sb, table)] as const),
  );
  return Object.fromEntries(entries) as Record<MigrationTable, number>;
}

async function schemaPreflight(sb: ReturnType<typeof createClient>) {
  const result = await sb.from("leads").select("id,interest,opportunity,channel_decision,demo,ads_check").limit(1);
  if (result.error) {
    throw new Error("Supabase schéma nie je aktuálna. Aplikuj migrácie 0001 až 0004. Detail: " + result.error.message);
  }
}

async function upsertBatches(
  sb: ReturnType<typeof createClient>,
  table: MigrationTable,
  rows: Record<string, unknown>[],
) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const result = await sb.from(table).upsert(chunk, { onConflict: "id" });
    if (result.error) throw new Error("Supabase " + table + " upsert: " + result.error.message);
  }
}

async function verifyIds(
  sb: ReturnType<typeof createClient>,
  table: MigrationTable,
  ids: string[],
): Promise<{ expected: number; found: number; missing: string[] }> {
  if (!ids.length) return { expected: 0, found: 0, missing: [] };

  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const part = ids.slice(i, i + BATCH);
    const result = await sb.from(table).select("id").in("id", part);
    if (result.error) throw new Error("Supabase " + table + " verify: " + result.error.message);
    for (const row of result.data ?? []) if (typeof row.id === "string") found.add(row.id);
  }
  const missing = ids.filter((id) => !found.has(id));
  return { expected: ids.length, found: found.size, missing: missing.slice(0, 20) };
}

export async function runBlobToSupabaseMigration(options: Options) {
  const sourceBlob = await readBlobStateForMigration();
  const rows = stateToSupabaseRows(sourceBlob.state);
  const source = migrationCounts(rows);
  const env = supabaseEnv();
  const sb = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });

  await schemaPreflight(sb);
  const before = await destinationCounts(sb);
  const guardedTables: MigrationTable[] = [
    "companies", "leads", "calls", "lead_events", "commissions", "settings", "notifications",
  ];
  const nonEmpty = guardedTables.filter((table) => before[table] > 0);

  const preview = {
    applied: false,
    source_etag: sourceBlob.etag,
    source,
    destination_before: before,
    destination_nonempty: nonEmpty,
    panenka: panenkaPreview(sourceBlob.state),
  };

  if (!options.apply) return preview;

  if (nonEmpty.length && !options.allowNonEmpty) {
    throw new Error(
      "Supabase už obsahuje dáta v: " + nonEmpty.join(", ") +
      ". Migrácia sa zastavila. Pre vedomý idempotentný resume použi allow_nonempty.",
    );
  }

  for (const table of SUPABASE_TABLE_ORDER) {
    await upsertBatches(sb, table, rows[table]);
  }

  const verification = Object.fromEntries(
    await Promise.all(
      SUPABASE_TABLE_ORDER.map(async (table) => [table, await verifyIds(sb, table, sourceIds(rows, table))] as const),
    ),
  ) as Record<MigrationTable, { expected: number; found: number; missing: string[] }>;

  const failed = Object.entries(verification).filter(([, value]) => value.missing.length > 0);
  if (failed.length) {
    throw new Error(
      "Migrácia zapísala dáta, ale verifikácia našla chýbajúce ID: " +
      failed.map(([table, value]) => table + "(" + value.missing.join(",") + ")").join("; "),
    );
  }

  return {
    ...preview,
    applied: true,
    destination_after: await destinationCounts(sb),
    verification,
  };
}
