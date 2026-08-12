#!/usr/bin/env bash
# Build `bowmark.mcpb` — the MCPB desktop extension.
#
# The bundle is a zip: this directory's `manifest.json` + `server/index.js` +
# `BUNDLE-README.md` + `icon.png` + a vendored `node_modules` holding the
# PUBLISHED `@bowmark/mcp` from npm. Everything in the zip is open source, which
# is not tidiness — the Software Directory Terms make it a non-waivable
# requirement for a local connector.
#
# `version` is STAMPED from the vendored @bowmark/mcp rather than committed. The
# bundle IS that bridge, so it has no version of its own to invent, and
# `manifest.json` holds `0.0.0` in git on purpose: a real number there would be
# a second source of truth for a fact npm already owns.
#
# Usage:  bash packages/bowmark-mcp/mcpb/build.sh  [output-dir]
# Output: <output-dir>/bowmark.mcpb   (default: ./dist under this directory)

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/dist}"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# The icon is COMMITTED next to this script, which contradicts the usual rule
# that brand assets are never duplicated — and the exception is the reason this
# directory sits under packages/bowmark-mcp/ at all.
#
# `.github/workflows/release-bowmark-mcp.yml` one-way-mirrors this whole package
# to the PUBLIC github.com/bowmark-ai/mcp, which is the repo the MCPB submission
# form asks for ("Desktop Extension GitHub Link"). A build that reached up into
# packages/brand/ would work here and break there, so the mirror needs its own
# copy and this script must run standalone.
#
# Drift is handled by refreshing rather than by a rule: inside the monorepo,
# where packages/brand exists, the committed copy is overwritten from source on
# every build. In the mirror that path is absent and the committed copy is used.
BRAND="$HERE/../../brand/out/transparent/icon-lime-512.png"
if [ -f "$BRAND" ]; then
  cp "$BRAND" "$HERE/icon.png"
  echo "→ refreshed icon.png from packages/brand"
fi
[ -f "$HERE/icon.png" ] || { echo "✗ missing $HERE/icon.png" >&2; exit 1; }

echo "→ staging in $STAGE"
mkdir -p "$STAGE/server"
cp "$HERE/manifest.json" "$STAGE/manifest.json"
cp "$HERE/server/index.js" "$STAGE/server/index.js"
cp "$HERE/BUNDLE-README.md" "$STAGE/README.md"
cp "$HERE/icon.png" "$STAGE/icon.png"
printf '*.mcpb\n' > "$STAGE/.mcpbignore"

# `type: module` so server/index.js resolves as ESM. Node walks UP from the
# entry point for the nearest package.json, so this one at the bundle root is
# what governs it — and it is also what makes `node_modules/` resolvable.
cat > "$STAGE/package.json" <<'JSON'
{
  "name": "bowmark-mcpb",
  "private": true,
  "type": "module",
  "version": "0.0.0"
}
JSON

echo "→ vendoring @bowmark/mcp from npm"
( cd "$STAGE" && npm install --no-audit --no-fund --silent @bowmark/mcp@latest )

VERSION="$(node -p "require('$STAGE/node_modules/@bowmark/mcp/package.json').version")"
echo "→ stamping version $VERSION (from the vendored @bowmark/mcp)"
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  const m = JSON.parse(fs.readFileSync(p, "utf8"));
  m.version = process.argv[2];
  fs.writeFileSync(p, JSON.stringify(m, null, 2) + "\n");
' "$STAGE/manifest.json" "$VERSION"

# The CLI is PINNED rather than @latest. It runs in CI on every push that
# touches this package, and a bad release of somebody else's tool should not be
# able to fail a mirror sync or, worse, silently change what a published bundle
# contains. Bump it deliberately.
echo "→ validating against the MANIFEST spec"
npx -y @anthropic-ai/mcpb@2.1.2 validate "$STAGE/manifest.json"

mkdir -p "$OUT"
npx -y @anthropic-ai/mcpb@2.1.2 pack "$STAGE" "$OUT/bowmark.mcpb"

echo
echo "✓ $OUT/bowmark.mcpb — version $VERSION"
echo
echo "Before this is published, the api must already know the \`mcpb\` destination"
echo "in prod, or every install attributes to nothing and nobody notices. Check that"
echo "apps/api/src/mcp-destinations.ts is DEPLOYED, not merely merged."
