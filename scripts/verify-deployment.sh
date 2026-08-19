#!/usr/bin/env bash
# scripts/verify-deployment.sh
#
# Post-deployment smoke test: installs Code Pro Max from a real source
# (a freshly-built npm tarball, or the npm registry) into an isolated global
# prefix, runs the CLI against a throwaway repo, and checks the real output
# shape — not a mock. Cleans up everything it creates.
#
# Usage:
#   ./scripts/verify-deployment.sh --local    # verify from `npm pack` (no registry needed)
#   ./scripts/verify-deployment.sh --npm      # verify from the published npm registry
set -uo pipefail
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

MODE="${1:-}"
if [ "$MODE" != "--local" ] && [ "$MODE" != "--npm" ]; then
  echo "Usage: $0 --local | --npm" >&2
  exit 1
fi

FAILURES=0
ok()   { echo -e "  ${GREEN}✓${RESET} $1"; }
fail() { echo -e "  ${RED}✗${RESET} $1"; FAILURES=$((FAILURES + 1)); }

WORKDIR="$(mktemp -d)"
PREFIX="${WORKDIR}/npm-prefix"
TESTREPO="${WORKDIR}/test-repo"
mkdir -p "$PREFIX" "$TESTREPO"

cleanup() {
  rm -rf "$WORKDIR"
  rm -f codepromax-*.tgz
}
trap cleanup EXIT

echo -e "${BOLD}Step 1/5: Install${RESET}"
PKG_NAME="$(node -p "require('./package.json').name")"
if [ "$MODE" = "--local" ]; then
  npm pack > /dev/null
  TARBALL="$(ls codepromax-*.tgz | head -1)"
  if npm install -g --prefix "$PREFIX" "./${TARBALL}" > "${WORKDIR}/install.log" 2>&1; then
    ok "installed from local tarball ${TARBALL}"
  else
    fail "install from local tarball failed — see ${WORKDIR}/install.log"
  fi
else
  if npm install -g --prefix "$PREFIX" "$PKG_NAME" > "${WORKDIR}/install.log" 2>&1; then
    ok "installed ${PKG_NAME} from the npm registry"
  else
    fail "install from npm registry failed — see ${WORKDIR}/install.log"
  fi
fi

CODEPRO="${PREFIX}/bin/codepro"

echo -e "\n${BOLD}Step 2/5: CLI responds${RESET}"
if [ -x "$CODEPRO" ] && "$CODEPRO" help > "${WORKDIR}/help.log" 2>&1; then
  if grep -q "codepro find N" "${WORKDIR}/help.log"; then
    ok "'codepro help' lists commands"
  else
    fail "'codepro help' ran but output looked wrong — see ${WORKDIR}/help.log"
  fi
else
  fail "'codepro help' did not run — see ${WORKDIR}/help.log"
fi

echo -e "\n${BOLD}Step 3/5: Analysis runs against a throwaway repo${RESET}"
mkdir -p "${TESTREPO}/src"
cat > "${TESTREPO}/package.json" <<'EOF'
{ "name": "verify-target", "version": "1.0.0" }
EOF
cat > "${TESTREPO}/src/handler.ts" <<'EOF'
export async function handle(req: unknown): Promise<void> {
  try {
    JSON.parse(req as string);
  } catch (e) {
    // swallowed — no logging, no rethrow
  }
}
EOF
(cd "$TESTREPO" && git init -q && git add -A && git commit -q -m "seed" --author="Verify <verify@test>")

# Documents land relative to the CLI's invocation directory, not repoPath —
# run from inside the target repo, matching the documented usage pattern.
if (cd "$TESTREPO" && "$CODEPRO" find 1 .) > "${WORKDIR}/find.log" 2>&1; then
  ok "'codepro find 1' completed"
else
  fail "'codepro find 1' failed — see ${WORKDIR}/find.log"
fi

echo -e "\n${BOLD}Step 4/5: Output files exist and are valid${RESET}"
REGISTER_JSON="${TESTREPO}/documents/initiatives/register.json"
if [ -f "$REGISTER_JSON" ]; then
  ok "register.json was created"
  if node -e "JSON.parse(require('fs').readFileSync('${REGISTER_JSON}','utf8'))" 2>/dev/null; then
    ok "register.json is valid JSON"
  else
    fail "register.json is not valid JSON"
  fi
else
  fail "register.json was not created"
fi

if [ -f "${TESTREPO}/documents/initiatives/initiative-register.md" ]; then
  ok "initiative-register.md was created"
else
  fail "initiative-register.md was not created"
fi

echo -e "\n${BOLD}Step 5/5: MCP server starts${RESET}"
MCP="${PREFIX}/bin/codepro-mcp"
if [ -x "$MCP" ]; then
  "$MCP" < /dev/null > "${WORKDIR}/mcp.log" 2>&1 &
  MCP_PID=$!
  sleep 2
  if grep -q "MCP server running on stdio" "${WORKDIR}/mcp.log"; then
    ok "codepro-mcp starts and logs readiness"
  else
    fail "codepro-mcp did not log readiness — see ${WORKDIR}/mcp.log"
  fi
  kill "$MCP_PID" 2>/dev/null || true
  wait "$MCP_PID" 2>/dev/null || true
else
  fail "codepro-mcp binary not found at ${MCP}"
fi

echo -e "\n${BOLD}────────────────────────────────────────${RESET}"
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}✓ Deployment verified. Install, CLI, analysis, and MCP server all work.${RESET}"
  exit 0
else
  echo -e "${RED}${BOLD}✗ ${FAILURES} check(s) failed.${RESET} Review the logs above before treating this as ready."
  exit 1
fi
