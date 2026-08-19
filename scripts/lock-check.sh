#!/usr/bin/env bash
#
# Fails if package-lock.json is missing the native binaries Linux CI needs.
#
# npm records optional platform-specific packages only for the platform that
# resolved them, so installing on macOS can quietly prune what CI requires. The
# lock still works locally, which is exactly what makes it easy to push. This
# turns a CI round trip into an instant local failure.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

LOCK_PATH="${REPO_ROOT}/package-lock.json" node -e '
const { readFileSync } = require("node:fs");
const lock = JSON.parse(readFileSync(process.env.LOCK_PATH, "utf8"));
const packages = Object.keys(lock.packages ?? {});

// One representative per family that has bitten us: rolldown (vitest) and
// emnapi (sharp’s wasm variant, pulled in by Next).
const required = [
  "node_modules/@rolldown/binding-linux-x64-gnu",
  "node_modules/@emnapi/core",
  "node_modules/@emnapi/runtime"
];

const missing = required.filter((name) => !packages.includes(name));

if (missing.length > 0) {
  console.error("package-lock.json is missing Linux-only entries:\n");
  for (const name of missing) console.error("  " + name.replace("node_modules/", ""));
  console.error("\nThis lock will fail `npm ci` on CI. Fix it with:\n");
  console.error("  npm run lock:refresh\n");
  process.exit(1);
}

console.log("lock:check — Linux native binaries present");
'
