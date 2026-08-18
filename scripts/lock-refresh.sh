#!/usr/bin/env bash
#
# Rebuilds package-lock.json with every platform's native binaries resolved.
#
# WHY THIS EXISTS
#
# npm records optional, platform-specific dependencies only for the platform it
# resolved on. A lock file generated on macOS can therefore be missing the Linux
# binaries CI needs -- and the failure is quiet, because it still works locally.
# We hit this twice: `@emnapi/*` (via @img/sharp-wasm32, pulled in by Next) and
# `@rolldown/binding-linux-x64-gnu` (via vitest).
#
# WHEN TO RUN IT
#
# After any dependency change, before pushing. `npm install <pkg>` often
# preserves the existing multi-platform entries — but not when the new package
# brings native binaries of its own, and that has broken CI three times:
# @emnapi/* via sharp, bufferutil via Supabase realtime, and rolldown via the
# test runner. The failure is invisible locally, which is what makes running
# this unconditionally cheaper than remembering when it is needed.
#
# HOW IT WORKS -- three details, each of which broke a CI run when missed
#
#   1. node:24-slim, not -alpine. Alpine is musl; GitHub runners are glibc, so an
#      Alpine-generated lock resolves the wrong native bindings.
#   2. No pre-existing lock file. With one present, npm preserves the already
#      pruned tree instead of re-resolving the full set.
#   3. No node_modules in sight. `--package-lock-only` still reconciles against
#      an existing node_modules, so running this over the real repo would prune
#      straight back to whatever the host platform installed. That is why the
#      resolve happens in a temp directory holding only the manifests.
#
# Nothing is installed on the host: npm runs inside the container, and only
# package-lock.json is copied back. node_modules is untouched by the resolve,
# which is why `npm ci` follows.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="node:24-slim"

if ! docker info >/dev/null 2>&1; then
  echo "error: Docker is not running. Start Docker Desktop and try again." >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

echo "==> Collecting workspace manifests"
cd "${REPO_ROOT}"
# Every package.json the workspaces resolve, and nothing from node_modules or
# build output.
while IFS= read -r manifest; do
  rel="${manifest#./}"
  mkdir -p "${WORK}/$(dirname "${rel}")"
  cp "${rel}" "${WORK}/${rel}"
  echo "    ${rel}"
done < <(find . -name package.json \
  -not -path "*/node_modules/*" \
  -not -path "./.next/*" \
  -not -path "*/dist/*")

echo "==> Resolving dependencies inside ${IMAGE} (glibc Linux, no node_modules)"
docker run --rm -v "${WORK}":/repo -w /repo "${IMAGE}" \
  npm install --package-lock-only --no-audit --no-fund

cp "${WORK}/package-lock.json" "${REPO_ROOT}/package-lock.json"

echo "==> Syncing node_modules to the regenerated lock"
npm ci

echo
echo "Platform bindings now in the lock:"
node -e '
const l = require("./package-lock.json");
const k = Object.keys(l.packages).filter((x) => /@rolldown\/binding/.test(x));
console.log(k.length ? k.map((x) => "    " + x.replace("node_modules/", "")).join("\n") : "    NONE -- something is wrong");
'

echo
echo "Done. Commit package-lock.json together with any package.json change."
