#!/usr/bin/env bash
# scripts/deploy-github.sh
#
# Tags the current commit and creates a GitHub Release from CHANGELOG.md.
#
# Safe by default: without --publish this only shows what it *would* do
# (the tag name, the release notes excerpt) and makes no changes. Pass
# --publish to actually tag, push, and create the release — still requires
# an interactive "yes" confirmation unless --yes is also passed.
#
# Requires the GitHub CLI (`gh`), authenticated (`gh auth login`). If `gh`
# isn't installed, this script says so and stops rather than trying to
# fall back to raw `curl` calls against the GitHub API.
#
# Usage:
#   ./scripts/deploy-github.sh              # preview only (default, safe)
#   ./scripts/deploy-github.sh --publish     # real tag + push + release, prompts
#   ./scripts/deploy-github.sh --publish --yes
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

echo -e "${BOLD}Step 1/6: Pre-deployment checks${RESET}"
if ! ./scripts/deploy-prep.sh; then
  echo -e "${RED}deploy-prep.sh reported blocking issues — aborting.${RESET}" >&2
  exit 1
fi

echo -e "\n${BOLD}Step 2/6: gh CLI availability${RESET}"
if ! command -v gh > /dev/null 2>&1; then
  echo -e "  ${RED}✗${RESET} GitHub CLI ('gh') is not installed on this machine."
  echo "  Install: https://cli.github.com/ (e.g. 'brew install gh' on macOS)"
  echo "  Then authenticate: gh auth login"
  exit 1
fi
if ! gh auth status > /dev/null 2>&1; then
  echo -e "  ${RED}✗${RESET} 'gh' is installed but not authenticated."
  echo "  Run: gh auth login"
  exit 1
fi
echo -e "  ${GREEN}✓${RESET} gh installed and authenticated"

PKG_VERSION="$(node -p "require('./package.json').version")"
TAG="v${PKG_VERSION}"

echo -e "\n${BOLD}Step 3/6: Tag availability${RESET}"
if git rev-parse "$TAG" > /dev/null 2>&1; then
  echo -e "  ${RED}✗${RESET} Tag ${TAG} already exists locally."
  exit 1
fi
if git ls-remote --tags origin | grep -q "refs/tags/${TAG}$"; then
  echo -e "  ${RED}✗${RESET} Tag ${TAG} already exists on origin."
  exit 1
fi
echo -e "  ${GREEN}✓${RESET} ${TAG} is available"

echo -e "\n${BOLD}Step 4/6: Release notes${RESET}"
# Extract the section of CHANGELOG.md under the heading matching this version.
NOTES="$(awk "/^## \[${PKG_VERSION}\]/{flag=1; next} /^## \[/{flag=0} flag" CHANGELOG.md)"
if [ -z "$NOTES" ]; then
  echo -e "  ${YELLOW}!${RESET} No '## [${PKG_VERSION}]' section found in CHANGELOG.md."
  echo "  Add one before releasing, or release notes will be empty."
else
  echo "  Extracted $(echo "$NOTES" | wc -l | tr -d ' ') line(s) from CHANGELOG.md:"
  echo "$NOTES" | head -5 | sed 's/^/    /'
  echo "    ..."
fi

echo -e "\n${BOLD}Step 5/6: Preview${RESET}"
echo "  Would tag:    ${TAG} (current HEAD: $(git rev-parse --short HEAD))"
echo "  Would push:   origin main, origin ${TAG}"
echo "  Would create: GitHub release '${TAG}' with the notes above"

if [ "$PUBLISH" = false ]; then
  echo -e "\n${YELLOW}Preview only. Nothing was tagged, pushed, or released.${RESET}"
  echo "Re-run with --publish to actually do it."
  exit 0
fi

echo -e "\n${BOLD}Step 6/6: Publish${RESET}"
if [ "$ASSUME_YES" = false ]; then
  read -r -p "Tag ${TAG}, push it, and create a GitHub release? Type 'yes' to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted — nothing was tagged, pushed, or released."
    exit 1
  fi
fi

git tag "$TAG"
git push origin main
git push origin "$TAG"

NOTES_FILE="$(mktemp)"
echo "$NOTES" > "$NOTES_FILE"
gh release create "$TAG" --title "Code Pro Max ${TAG}" --notes-file "$NOTES_FILE"
RELEASE_STATUS=$?
rm -f "$NOTES_FILE"

if [ $RELEASE_STATUS -ne 0 ]; then
  echo -e "${RED}gh release create failed after the tag was already pushed.${RESET}"
  echo "See ROLLBACK.md — you likely need to delete the tag or create the release manually."
  exit $RELEASE_STATUS
fi

REPO_URL="$(gh repo view --json url -q .url)"
echo -e "\n${GREEN}${BOLD}✓ Released ${TAG}${RESET}"
echo "  Release page: ${REPO_URL}/releases/tag/${TAG}"
