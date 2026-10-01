import { NextResponse } from "next/server";
import { blobStorageFingerprint } from "@/lib/migrations/blob-to-supabase-runner";

const EXPECTED_TOKEN_SHA256 = "f0c9c7683d91c2c0f2fc23ce539a76fbbd586e5ea02817b77d7510d854cb3e0d";

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
}

/** Dočasná production-only diagnostika. Po jednom použití sa odstráni. */
export async function GET(req: Request) {
  if (process.env.VERCEL_ENV !== "production" || process.env.VERCEL_GIT_COMMIT_REF !== "main") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token || (await sha256Hex(token)) !== EXPECTED_TOKEN_SHA256) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ fingerprint: await blobStorageFingerprint() });
}
