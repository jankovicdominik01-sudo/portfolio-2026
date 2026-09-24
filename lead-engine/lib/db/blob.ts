import "server-only";
import { BlobPreconditionFailedError, del, get, head, put } from "@vercel/blob";
import type { DocumentBackend } from "./document";
import { emptyState, type DbState } from "./types";
import { seedState } from "./seed";
import { blobToken } from "./blob-token";

/**
 * Vercel Blob (private) ako perzistentné úložisko pre testovací deploy.
 * Optimistická súbežnosť cez ETag — pri kolízii sa zápis zopakuje.
 */
const PATH = process.env.LEAD_ENGINE_BLOB_PATH || "lead-engine/db-v2.json";

/**
 * Hlavný súbor sa prepisuje s ifMatch (server garantuje konzistenciu), ale čítanie cez CDN
 * môže byť ešte chvíľu staré. Preto každá verzia má aj nemennú kópiu snap/<etag>.json:
 * aktuálny etag zistíme z head() (API) a načítame presne tú kópiu.
 */
const SNAP = PATH.replace(/\.json$/, "") + "-snap/";
const snapPath = (etag: string) => `${SNAP}${etag.replace(/[^a-zA-Z0-9]/g, "")}.json`;

const isConflict = (e: unknown) =>
  e instanceof BlobPreconditionFailedError || (e instanceof Error && /precondition|etag mismatch/i.test(e.message));

let last: { state: DbState; etag: string } | null = null;

async function readText(pathname: string, expectEtag?: string): Promise<string | null> {
  const res = await get(pathname, { access: "private", useCache: false, token: blobToken() });
  if (!res || res.statusCode !== 200) return null;
  if (expectEtag && res.blob.etag !== expectEtag) {
    await res.stream.cancel().catch(() => {});
    throw new BlobPreconditionFailedError();
  }
  return await new Response(res.stream).text();
}

async function load(): Promise<{ state: DbState; etag: string | null }> {
  const meta = await head(PATH, { token: blobToken() }).catch(() => null);
  if (!meta) return { state: seedState(emptyState()), etag: null };
  if (last && last.etag === meta.etag) return { state: structuredClone(last.state), etag: last.etag };
  const text = (await readText(snapPath(meta.etag))) ?? (await readText(PATH, meta.etag));
  if (!text) return { state: seedState(emptyState()), etag: meta.etag };
  return { state: JSON.parse(text) as DbState, etag: meta.etag };
}

async function save(state: DbState, etag: string | null) {
  const body = JSON.stringify(state);
  const common = { access: "private" as const, token: blobToken(), contentType: "application/json", addRandomSuffix: false };
  const r = await put(PATH, body, { ...common, allowOverwrite: true, ...(etag ? { ifMatch: etag } : {}) });
  await put(snapPath(r.etag), body, { ...common, allowOverwrite: true });
  if (etag) await del(snapPath(etag), { token: blobToken() }).catch(() => {});
  last = { state: structuredClone(state), etag: r.etag };
}

export const blobBackend: DocumentBackend = {
  kind: "blob",
  async read() {
    for (let attempt = 0; ; attempt++) {
      try {
        return (await load()).state;
      } catch (e) {
        if (!isConflict(e) || attempt >= 8) throw e;
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  },
  async mutate(fn) {
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const { state, etag } = await load();
        fn(state);
        await save(state, etag);
        return;
      } catch (e) {
        if (isConflict(e)) {
          last = null;
          await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    throw new Error("Úložisko je zaneprázdnené, skús to znova.");
  },
};
