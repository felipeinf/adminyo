#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const printDirOnly = process.argv.includes("--print-dir");

const dirByPlatform = {
  "darwin-arm64": "darwin-arm64",
  "darwin-x64": "darwin-x64",
  "linux-x64": "linux-x64",
  "linux-arm64": "linux-arm64",
  "win32-x64": "win32-x64",
};

const key = `${process.platform}-${process.arch}`;
const subdir = dirByPlatform[key];
if (!subdir) {
  console.error(`Unsupported platform for native sync: ${key}`);
  process.exit(1);
}

if (printDirOnly) {
  console.log(subdir);
  process.exit(0);
}

const repoRoot = path.resolve(__dirname, "..");
const binName = process.platform === "win32" ? "nyo.exe" : "nyo";
const src = path.join(repoRoot, "cli", "target", "release", binName);
const destDir = path.join(repoRoot, "npm", subdir);
const dest = path.join(destDir, binName);

if (!fs.existsSync(src)) {
  console.error(`Missing binary (build Rust first): ${src}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
if (process.platform !== "win32") {
  try {
    fs.chmodSync(dest, 0o755);
  } catch {
    /* ignore */
  }
}
console.log(`Copied ${path.relative(repoRoot, src)} -> ${path.relative(repoRoot, dest)}`);
