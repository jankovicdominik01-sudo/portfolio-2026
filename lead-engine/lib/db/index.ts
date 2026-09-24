import "server-only";
import type { Repository } from "./types";
import { documentRepository } from "./document";
import { blobConfigured } from "./blob-token";

let repo: Repository | null = null;

/**
 * Výber úložiska podľa env:
 *  1. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → Supabase (produkcia)
 *  2. BLOB_READ_WRITE_TOKEN                    → Vercel Blob (testovací deploy)
 *  3. inak                                      → lokálny súbor .data/db.json
 */
export async function db(): Promise<Repository> {
  if (repo) return repo;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const { supabaseRepository } = await import("./supabase");
    repo = supabaseRepository(url, key);
  } else if (blobConfigured()) {
    const { blobBackend } = await import("./blob");
    repo = documentRepository(blobBackend);
  } else {
    const { fileBackend } = await import("./file");
    repo = documentRepository(fileBackend);
  }
  return repo;
}
