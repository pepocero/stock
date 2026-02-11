/**
 * Ejecuta un backup manual leyendo los params desde trigger-params.json.
 * Evita problemas de escapado de JSON en PowerShell/cmd.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const paramsPath = path.join(__dirname, "trigger-params.json");
const params = fs.readFileSync(paramsPath, "utf8").trim();
const wranglerConfig = path.join(__dirname, "wrangler.toml");

console.log("Iniciando backup manual...");

try {
  execSync("npx", [
    "wrangler",
    "workflows",
    "trigger",
    "backup-workflow",
    params,
    "-c",
    wranglerConfig,
  ], { stdio: "inherit" });
  console.log("\nTrigger enviado. Espera 1-2 min y revisa R2 o ejecuta:");
  console.log("  wrangler workflows instances describe backup-workflow latest -c workers/backup/wrangler.toml");
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
