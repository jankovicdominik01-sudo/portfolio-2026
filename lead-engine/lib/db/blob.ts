import "server-only";
import { BlobPreconditionFailedError, get, head, put } from "@vercel/blob";
import type { DocumentBackend } from "./document";
import { emptyState, type DbState } from "./types";
import { seedState } from "./seed";
import { blobToken } from "./blob-token";

/**
 * Vercel Blob (private) ako perzistentné úložisko pre testovací deploy.
 * Optimistická súbežnosť cez ETag — pri kolízii sa zápis zopakuje.
 */
const PATH = process.env.LEAD_ENGINE_BLOB_PATH || "lead-engine/db.json";

/** Posledná verzia, ktorú táto inštancia zapísala — čítanie hneď po zápise môže byť ešte staré. */
let last: { state: DbState; etag: string } | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function load(): Promise<{ state: DbState; etag: string | null }> {
  const meta = await head(PATH, { token: blobToken() }).catch(() => null);
  if (!meta) return { state: seedState(emptyState()), etag: null };
  if (last && last.etag === meta.etag) return { state: structuredClone(last.state), etag: last.etag };
  let res = null;
  for (let i = 0; i < 6; i++) {
    res = await get(PATH, { access: "private", useCache: false, token: blobToken() });
    if (res && res.statusCode === 200 && res.blob.etag === meta.etag) break;
    await sleep(150 * (i + 1));
  }
  if (!res || res.statusCode !== 200) return { state: seedState(emptyState()), etag: meta.etag };
  const text = await new Response(res.stream).text();
  return { state: JSON.parse(text) as DbState, etag: res.blob.etag };
}

async function save(state: DbState, etag: string | null) {
  const r = await put(PATH, JSON.stringify(state), {
    access: "private",
    token: blobToken(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    ...(etag ? { ifMatch: etag } : {}),
  });
  last = { state: structuredClone(state), etag: r.etag };
}

export const blobBackend: DocumentBackend = {
  kind: "blob",
  async read() {
    return (await load()).state;
  },
  async mutate(fn) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { state, etag } = await load();
      fn(state);
      try {
        await save(state, etag);
        return;
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError) {
          last = null;
          await sleep(150 * (attempt + 1));
          continue;
        }
        throw e;
      }
    }
    throw new Error("Úložisko je zaneprázdnené, skús to znova.");
  },
};
