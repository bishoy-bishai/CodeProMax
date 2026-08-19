#!/usr/bin/env bash
# scripts/deploy-npm.sh
#
# Publishes Code Pro Max to the npm registry.
#
# Safe by default: without --publish, this only runs deploy-prep.sh and
# `npm publish --dry-run` — it never touches the registry. Pass --publish to
# actually publish, which still requires an interactive "yes" confirmation
# (or --yes to skip the prompt in CI).
#
# Usage:
#   ./scripts/deploy-npm.sh              # dry run only (default, safe)
#   ./scripts/deploy-npm.sh --publish     # real publish, prompts to confirm
#   ./scripts/deploy-npm.sh --publish --yes  # real publish, no prompt (CI)
set -uo pipefail
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

PUBLISH=false
ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --publish) PUBLISH=true ;;
    --yes) ASSUME_YES=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

echo -e "${BOLD}Step 1/5: Pre-deployment checks${RESET}"
if ! ./scripts/deploy-prep.sh; then
  echo -e "${RED}deploy-prep.sh reported blocking issues — aborting.${RESET}" >&2
  exit 1
fi

PKG_NAME="$(node -p "require('./package.json').name")"
PKG_VERSION="$(node -p "require('./package.json').version")"

echo -e "\n${BOLD}Step 2/5: npm login status${RESET}"
WHOAMI="$(npm whoami 2>/dev/null || true)"
if [ -z "$WHOAMI" ]; then
  echo -e "  ${YELLOW}!${RESET} Not logged in to npm."
  if [ "$PUBLISH" = true ]; then
    echo "  Run 'npm login' first, or export NPM_TOKEN and configure ~/.npmrc for CI."
    exit 1
  else
    echo "  (Not blocking a dry run, but required before --publish.)"
  fi
else
  echo -e "  ${GREEN}✓${RESET} Logged in as ${WHOAMI}"
fi

echo -e "\n${BOLD}Step 3/5: Name availability${RESET}"
if npm view "$PKG_NAME" version > /dev/null 2>&1; then
  PUBLISHED_VERSION="$(npm view "$PKG_NAME" version 2>/dev/null)"
  echo "  '${PKG_NAME}' already exists on the registry (latest published: ${PUBLISHED_VERSION})."
  if [ "$PUBLISHED_VERSION" = "$PKG_VERSION" ]; then
    echo -e "  ${RED}✗${RESET} version ${PKG_VERSION} is already published — npm publish would fail."
    echo "  Bump the version in package.json first."
    exit 1
  else
    echo -e "  ${GREEN}✓${RESET} ${PKG_VERSION} has not been published yet"
  fi
else
  echo -e "  ${GREEN}✓${RESET} '${PKG_NAME}' is unclaimed (or this is the first publish)"
fi

echo -e "\n${BOLD}Step 4/5: Dry run${RESET}"
npm publish --dry-run

if [ "$PUBLISH" = false ]; then
  echo -e "\n${YELLOW}Dry run complete. No package was published.${RESET}"
  echo "Re-run with --publish to actually publish ${PKG_NAME}@${PKG_VERSION}."
  exit 0
fi

echo -e "\n${BOLD}Step 5/5: Publish${RESET}"
if [ "$ASSUME_YES" = false ]; then
  read -r -p "Publish ${PKG_NAME}@${PKG_VERSION} to the npm registry? This cannot be fully undone (npm's unpublish policy is restrictive after 72h — see ROLLBACK.md). Type 'yes' to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted — nothing was published."
    exit 1
  fi
fi

npm publish
PUBLISH_STATUS=$?

if [ $PUBLISH_STATUS -ne 0 ]; then
  echo -e "${RED}npm publish failed.${RESET} See ROLLBACK.md if a partial publish needs cleanup."
  exit $PUBLISH_STATUS
fi

echo -e "\n${GREEN}${BOLD}✓ Published ${PKG_NAME}@${PKG_VERSION}${RESET}"
echo "  Registry page: https://www.npmjs.com/package/${PKG_NAME}"
echo "  Install:       npm install -g ${PKG_NAME}"
echo "  Verify:        ./scripts/verify-deployment.sh --npm"
