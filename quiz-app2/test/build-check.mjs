import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const pagesRepository = "GoCon/2026-codelab";
const pagesBasePath = `/${pagesRepository.split("/")[1]}/`;
const pagesOutputDir = "dist-pages-check";

function run(args, env = {}) {
  const result = spawnSync(npmCommand, args, {
    cwd: rootDir,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${npmCommand} ${args.join(" ")}`);
  }
}

function readHtml(directory) {
  const indexPath = join(rootDir, directory, "index.html");
  assert.ok(existsSync(indexPath), `Missing build output: ${indexPath}`);
  return readFileSync(indexPath, "utf8");
}

rmSync(join(rootDir, pagesOutputDir), { force: true, recursive: true });

try {
  run(["run", "build"]);

  const localHtml = readHtml("dist");
  assert.match(localHtml, /href="\/favicon\.jpg"/);
  assert.match(localHtml, /src="\/assets\//);
  assert.match(localHtml, /href="\/assets\//);
  assert.doesNotMatch(localHtml, /\/2026-codelab\//);

  run(["exec", "--", "vite", "build", "--outDir", pagesOutputDir], {
    VITE_BASE_PATH: pagesBasePath,
  });

  const pagesHtml = readHtml(pagesOutputDir);
  assert.match(pagesHtml, new RegExp(`href="${pagesBasePath}favicon\\.jpg"`));
  assert.match(pagesHtml, new RegExp(`src="${pagesBasePath}assets/`));
  assert.match(pagesHtml, new RegExp(`href="${pagesBasePath}assets/`));

  console.log("Build checks passed.");
} finally {
  rmSync(join(rootDir, pagesOutputDir), { force: true, recursive: true });
}
