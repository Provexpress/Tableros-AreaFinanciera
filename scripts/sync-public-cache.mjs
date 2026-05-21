import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataCacheDir = path.join(rootDir, "Data", "_cache");
const publicDir = path.join(rootDir, "public");
const publicCacheDir = path.join(publicDir, "_cache");
const dataIconsDir = path.join(rootDir, "Data", "icons");
const publicIconsDir = path.join(publicDir, "icons");
const faviconSource = path.join(rootDir, "Data", "favicon.svg");
const faviconTarget = path.join(publicDir, "favicon.svg");

async function copyDir(sourceDir, targetDir) {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    await fs.copyFile(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
  }
}

async function main() {
  await fs.mkdir(publicDir, { recursive: true });
  await copyDir(dataCacheDir, publicCacheDir);

  try {
    await fs.copyFile(faviconSource, faviconTarget);
  } catch {
    // Favicon is optional for local checks.
  }

  try {
    await copyDir(dataIconsDir, publicIconsDir);
  } catch {
    // Icons are optional for local checks.
  }

  console.log("[public-cache] cache sincronizado en public/_cache");
}

main().catch((error) => {
  console.error("[public-cache] error", error);
  process.exitCode = 1;
});
