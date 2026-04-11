#!/usr/bin/env node
const { execFileSync } = require("child_process");

const platform = process.platform;
const arch = process.arch;
const pkg = `@adminyo/cli-${platform}-${arch}`;
const binName = platform === "win32" ? "nyo.exe" : "nyo";

try {
  const binPath = require.resolve(`${pkg}/${binName}`);
  execFileSync(binPath, process.argv.slice(2), { stdio: "inherit" });
} catch {
  console.error(`Nyo does not support ${platform}-${arch}`);
  process.exit(1);
}
