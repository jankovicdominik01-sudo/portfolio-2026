import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DocumentBackend } from "./document";
import { emptyState, type DbState } from "./types";
import { seedState } from "./seed";

/** Lokálny vývoj: stav v .data/db.json (prežije reštart dev servera). Na Verceli iba /tmp (dočasné). */
const FILE = process.env.VERCEL
  ? path.join("/tmp", "leady", "db.json")
  : path.join(process.cwd(), ".data", "leady-db.json");

let queue: Promise<unknown> = Promise.resolve();

async function readFile(): Promise<DbState> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as DbState;
  } catch {
    const s = seedState(emptyState());
    await writeFile(s);
    return s;
  }
}

async function writeFile(s: DbState) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(s, null, 2));
  await fs.rename(tmp, FILE);
}

export const fileBackend: DocumentBackend = {
  kind: "file",
  read: () => readFile(),
  mutate(fn) {
    // Serializácia zápisov v rámci procesu.
    const next = queue.then(async () => {
      const s = await readFile();
      fn(s);
      await writeFile(s);
    });
    queue = next.catch(() => undefined);
    return next;
  },
};
