/**
 * Vytvorí scrypt hash hesla pre LE_USERS. Heslo sa nevypisuje ani neukladá.
 *   npm run hash-password
 * Výstup vlož do LE_USERS namiesto hesla, napr. roman|Roman|caller|scrypt$…|m
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { hashPassword } from "../lib/users";

const muted = new Writable({ write: (_c, _e, cb) => cb() });
const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
process.stdout.write("Heslo (nezobrazuje sa, min. 10 znakov): ");
rl.question("", async (pw) => {
  rl.close();
  process.stdout.write("\n");
  if (pw.length < 10) {
    console.error("Heslo je príliš krátke.");
    process.exit(1);
  }
  console.log(await hashPassword(pw));
});
