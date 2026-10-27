import path from "node:path";
import { fileURLToPath } from "node:url";

// True when this module was started directly ("node scripts/x.ts"),
// false when it was imported (for example by a test).
export function isMain(moduleUrl: string): boolean {
  const started = process.argv[1];
  if (!started) return false;
  return path.resolve(started) === fileURLToPath(moduleUrl);
}
