#!/usr/bin/env bash
# scripts/deploy-prep.sh
#
# Pre-deployment verification for Code Pro Max. Read-only: never publishes,
# tags, or pushes anything. Every check here reflects a real, current
# condition of this repo — see the printed rationale for each.
#
# Usage: ./scripts/deploy-prep.sh
set -uo pipefail

cd "$(dirname "$0")/.."

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="deploy-${TIMESTAMP}.log"
: > "$LOG_FILE"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

STEP=0
TOTAL_STEPS=11
FAILURES=0
WARNINGS=0

log() { echo -e "$1" | tee -a "$LOG_FILE" >&2; }
step() {
  STEP=$((STEP + 1))
  log "\n${BOLD}[${STEP}/${TOTAL_STEPS}] $1${RESET}"
}
ok()   { log "  ${GREEN}✓${RESET} $1"; }
fail() { log "  ${RED}✗${RESET} $1"; FAILURES=$((FAILURES + 1)); }
warn() { log "  ${YELLOW}!${RESET} $1"; WARNINGS=$((WARNINGS + 1)); }

# ── 1. Node.js version ────────────────────────────────────────────────────
step "Node.js version (>= 18 required)"
NODE_VERSION="$(node --version 2>/dev/null | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if [ -z "$NODE_VERSION" ]; then
  fail "node not found on PATH"
elif [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
  ok "node v${NODE_VERSION}"
else
  fail "node v${NODE_VERSION} — need >= 18"
fi

# ── 2. npm version ─────────────────────────────────────────────────────────
step "npm version"
NPM_VERSION="$(npm --version 2>/dev/null)"
if [ -z "$NPM_VERSION" ]; then
  fail "npm not found on PATH"
else
  ok "npm v${NPM_VERSION}"
fi

# ── 3. Typecheck (informational — see caveat) ───────────────────────────────
step "npm run build (tsc --noEmit)"
if npm run build > /tmp/codepromax-deploy-build.log 2>&1; then
  ok "0 TypeScript errors"
else
  TSC_ERRORS=$(grep -c "error TS" /tmp/codepromax-deploy-build.log || true)
  warn "${TSC_ERRORS} TypeScript diagnostic(s) — see docs/DEVELOPER-GUIDE.md's"
  warn "  note on the repo-wide .ts-import-extension / allowImportingTsExtensions"
  warn "  condition. Not currently a hard blocker (npm test is the reliable"
  warn "  signal), but 'zero TypeScript errors' cannot be claimed as met."
fi

# ── 4. Tests ─────────────────────────────────────────────────────────────
step "npm test"
if npm test > /tmp/codepromax-deploy-test.log 2>&1; then
  SUMMARY=$(grep -E "Tests +[0-9]+ passed" /tmp/codepromax-deploy-test.log | tail -1)
  ok "${SUMMARY:-all tests passed}"
else
  fail "npm test failed — see /tmp/codepromax-deploy-test.log"
fi

# ── 5. Lint (only if a lint script actually exists) ─────────────────────────
step "Lint"
HAS_LINT="$(node -p "require('./package.json').scripts?.lint ? 'yes' : 'no'")"
if [ "$HAS_LINT" = "no" ]; then
  warn "no 'lint' script is defined in package.json — skipped, not run"
elif npm run lint > /tmp/codepromax-deploy-lint.log 2>&1; then
  ok "lint passed"
else
  fail "lint failed — see /tmp/codepromax-deploy-lint.log"
fi

# ── 6. Uncommitted changes ──────────────────────────────────────────────────
step "Git working tree clean"
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  warn "not inside a git repository — skipping"
elif [ -z "$(git status --porcelain)" ]; then
  ok "working tree clean"
else
  fail "uncommitted changes present — commit or stash before deploying"
  git status --porcelain | sed 's/^/    /' | tee -a "$LOG_FILE" >&2
fi

# ── 7. package.json validity ────────────────────────────────────────────────
step "package.json validity"
if node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" 2>/dev/null; then
  PKG_VERSION="$(node -p "require('./package.json').version")"
  PKG_NAME="$(node -p "require('./package.json').name")"
  ok "valid JSON — ${PKG_NAME}@${PKG_VERSION}"
  if ! [[ "$PKG_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    fail "version '${PKG_VERSION}' does not follow semver X.Y.Z"
  fi
else
  fail "package.json is not valid JSON"
fi

# ── 8. Dependency audit ─────────────────────────────────────────────────────
step "npm audit"
AUDIT_JSON="$(npm audit --json 2>/dev/null || true)"
PROD_VULNS="$(echo "$AUDIT_JSON" | node -e "
  let data='';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    try {
      const r = JSON.parse(data);
      const total = r.metadata?.vulnerabilities?.total ?? 0;
      console.log(total);
    } catch { console.log('unknown'); }
  });
")"
if [ "$PROD_VULNS" = "0" ]; then
  ok "0 vulnerabilities (npm audit)"
else
  warn "${PROD_VULNS} vulnerabilities reported by npm audit — run 'npm audit' for"
  warn "  detail. As of this script's authoring, all known vulnerabilities here"
  warn "  are in devDependencies (test tooling: vitest/vite/esbuild), not in the"
  warn "  runtime dependency tree published to consumers — verify this is still"
  warn "  true before treating it as low-risk."
fi

# ── 9. CHANGELOG has an entry for this version ──────────────────────────────
step "CHANGELOG.md references the current version"
if [ -f CHANGELOG.md ] && grep -q "\[${PKG_VERSION:-__none__}\]" CHANGELOG.md; then
  ok "CHANGELOG.md has an entry for ${PKG_VERSION}"
else
  warn "CHANGELOG.md has no '[${PKG_VERSION:-?}]' heading — add one before release"
fi

# ── 10. README exists and isn't a stub ──────────────────────────────────────
step "README.md present and substantial"
if [ -f README.md ]; then
  WORDS=$(wc -w < README.md | tr -d ' ')
  if [ "$WORDS" -gt 300 ]; then
    ok "README.md present (${WORDS} words)"
  else
    warn "README.md is only ${WORDS} words — looks like a stub"
  fi
else
  fail "README.md is missing"
fi

# ── 11. List what would actually be published ───────────────────────────────
step "Files that would be published (npm pack --dry-run)"
npm pack --dry-run 2>&1 | tee -a "$LOG_FILE" | tail -5 >&2

# ── Summary ──────────────────────────────────────────────────────────────
log "\n${BOLD}────────────────────────────────────────${RESET}"
if [ "$FAILURES" -eq 0 ]; then
  log "${GREEN}${BOLD}✓ No blocking issues found.${RESET} (${WARNINGS} warning(s) — review above)"
  log "Log written to ${LOG_FILE}"
  exit 0
else
  log "${RED}${BOLD}✗ ${FAILURES} blocking issue(s) found, ${WARNINGS} warning(s).${RESET} Fix before deploying."
  log "Log written to ${LOG_FILE}"
  exit 1
fi
