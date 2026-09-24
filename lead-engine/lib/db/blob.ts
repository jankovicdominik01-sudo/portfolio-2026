import "server-only";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import type { DocumentBackend } from "./document";
import { emptyState, type DbState } from "./types";
import { seedState } from "./seed";

/**
 * Vercel Blob (private) ako perzistentné úložisko pre testovací deploy.
 * Optimistická súbežnosť cez ETag — pri kolízii sa zápis zopakuje.
 */
const PATH = process.env.LEAD_ENGINE_BLOB_PATH || "lead-engine/db.json";

async function load(): Promise<{ state: DbState; etag: string | null }> {
  const res = await get(PATH, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return { state: seedState(emptyState()), etag: null };
  const text = await new Response(res.stream).text();
  return { state: JSON.parse(text) as DbState, etag: res.blob.etag };
}

async function save(state: DbState, etag: string | null) {
  await put(PATH, JSON.stringify(state), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    ...(etag ? { ifMatch: etag } : {}),
  });
}

export const blobBackend: DocumentBackend = {
  kind: "blob",
  async read() {
    return (await load()).state;
  },
  async mutate(fn) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { state, etag } = await load();
      fn(state);
      try {
        await save(state, etag);
        return;
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError) {
          await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    throw new Error("Úložisko je zaneprázdnené, skús to znova.");
  },
};
