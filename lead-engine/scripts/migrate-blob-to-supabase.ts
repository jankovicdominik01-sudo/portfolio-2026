import { runBlobToSupabaseMigration } from "../lib/migrations/blob-to-supabase-runner";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const allowNonEmpty = args.has("--allow-nonempty");

if (args.has("--help")) {
  console.log([
    "Blob → Supabase migrácia Lead Engine",
    "",
    "Dry run:",
    "  npm run migrate:blob-to-supabase",
    "",
    "Apply do prázdneho Supabase:",
    "  npm run migrate:blob-to-supabase -- --apply",
    "",
    "Idempotentný resume do už naplnenej DB:",
    "  npm run migrate:blob-to-supabase -- --apply --allow-nonempty",
    "",
    "Potrebuje BLOB_READ_WRITE_TOKEN, SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY.",
    "Zo zdrojového Blobu iba číta; nerobí PUT/LIST/COPY/DELETE.",
  ].join("\n"));
  process.exit(0);
}

runBlobToSupabaseMigration({ apply, allowNonEmpty })
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
