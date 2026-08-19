# Deployment Guide

Covers the three deployment methods that actually fit Code Pro Max's shape
(a local CLI + stdio MCP server, no HTTP endpoint). See
[deploy-strategy.md](deploy-strategy.md) for why Docker/Heroku/AWS
Fargate/Docker Hub aren't covered here.

All scripts below are safe to run repeatedly: every one of them is
non-destructive by default (dry run / preview only) and requires an explicit
flag plus an interactive "yes" before doing anything irreversible.

## Prerequisites

| Tool | Needed for | Check |
|---|---|---|
| Node.js 18+, npm | All methods | `node --version`, `npm --version` |
| git | GitHub Releases; also required for the tool's own git-evidence collection | `git --version` |
| An npm account, logged in | npm publish | `npm whoami` |
| [GitHub CLI](https://cli.github.com/) (`gh`), authenticated | GitHub Releases | `gh auth status` |

None of these are bundled or auto-installed — `scripts/deploy-prep.sh` and
`scripts/deploy-github.sh` check for what they need and tell you exactly
what's missing rather than failing opaquely.

## Method 1: Local Install

No deployment step — this is how the tool is used today. See the
[README Quick Start](README.md#quick-start). Nothing in this section needs a
script.

```bash
git clone <repo-url>
cd CodeProMax
npm install
npx tsx src/cli/entry-point.ts find 5 .
```

## Method 2: npm Publish

**Estimated time:** under 5 minutes once `deploy-prep.sh` passes.

```bash
# 1. Dry run first — always safe, publishes nothing
./scripts/deploy-npm.sh

# 2. Review the dry-run output (file list, size, package name/version)

# 3. Publish for real (interactive confirmation)
./scripts/deploy-npm.sh --publish
```

What it does, step by step:

1. Runs `deploy-prep.sh` (Node/npm version, build, tests, git-clean check,
   `package.json` validity, `npm audit`, CHANGELOG/README sanity, `npm pack
   --dry-run` file listing). Aborts here if anything blocking is found.
2. Checks `npm whoami` — if you're not logged in, tells you to run
   `npm login` (or configure `NPM_TOKEN` for CI) before `--publish` will
   proceed.
3. Checks whether the current `package.json` version is already published
   (`npm view <name> version`) — refuses to proceed if so, since `npm
   publish` would just fail.
4. Runs `npm publish --dry-run` and shows you exactly what would be
   uploaded.
5. Without `--publish`, stops here.
6. With `--publish`: prompts for confirmation (skippable with `--yes` for
   CI), then runs the real `npm publish`.

**Expected output on success:**

```
✓ Published codepromax@0.1.0
  Registry page: https://www.npmjs.com/package/codepromax
  Install:       npm install -g codepromax
  Verify:        ./scripts/verify-deployment.sh --npm
```

**Verify:**

```bash
./scripts/verify-deployment.sh --npm
```

### Private / Enterprise Registry

Mechanically identical — point npm at your registry before running the
script:

```bash
npm config set registry https://your-registry.example.com
./scripts/deploy-npm.sh --publish
```

or scope it to just this invocation with `npm_config_registry=... ./scripts/deploy-npm.sh --publish`.

## Method 3: GitHub Release

**Estimated time:** under 5 minutes.

```bash
# 1. Preview — shows the tag name and the CHANGELOG excerpt that would become release notes
./scripts/deploy-github.sh

# 2. Publish for real (tags, pushes, creates the release)
./scripts/deploy-github.sh --publish
```

What it does:

1. Runs `deploy-prep.sh` (same gate as npm publish).
2. Checks that `gh` is installed and authenticated — stops with install
   instructions if not.
3. Checks the target tag (`v<package.json version>`) doesn't already exist,
   locally or on `origin`.
4. Extracts the `## [<version>]` section from `CHANGELOG.md` as the release
   notes body.
5. Shows a preview of what would be tagged/pushed/released.
6. Without `--publish`, stops here.
7. With `--publish`: confirms, then `git tag`, `git push origin main`,
   `git push origin <tag>`, and `gh release create`.

**Expected output on success:**

```
✓ Released v0.1.0
  Release page: https://github.com/<owner>/<repo>/releases/tag/v0.1.0
```

## Post-Deployment Verification

```bash
./scripts/verify-deployment.sh --local   # verify a freshly-built npm pack tarball, no registry needed
./scripts/verify-deployment.sh --npm     # verify what's actually live on the npm registry
```

Both install into an isolated, temporary global prefix (never touches your
real global npm packages), then for real:

1. Runs `codepro help` and checks the output contains the command list.
2. Runs `codepro find 1` against a freshly-created, git-initialized
   throwaway repo.
3. Checks `documents/initiatives/register.json` was created and is valid
   JSON, and that `initiative-register.md` exists.
4. Starts `codepro-mcp` and checks it logs
   `MCP server running on stdio (6 tools registered).` on stderr.
5. Cleans up the temp directory and any tarball it created, unconditionally
   (via a `trap ... EXIT`), whether it passed or failed.

If any step fails, the script reports which one and points at the relevant
log file — it does not silently report success.

## Troubleshooting

### `npm publish` fails with `403 Forbidden` / `You do not have permission`

- You're logged in as a user without publish rights to this package name (or
  the name is already claimed by someone else). Check with
  `npm view codepromax` — if it exists and you don't own it, you'll need a
  different package name (`name` field in `package.json`) or publish under
  an npm organization scope you control (`@yourscope/codepromax`).
- Not logged in: `npm whoami` will be empty. Run `npm login`.

### `npm publish` fails with `You cannot publish over the previously published versions`

- The version in `package.json` was already published. Bump it
  (`npm version patch/minor/major`) and re-run.

### `deploy-prep.sh` reports uncommitted changes

- This is the most common blocker. Either commit the work
  (`git add -A && git commit`) or stash it (`git stash`) before deploying —
  the script deliberately refuses to publish from a dirty tree so the
  published artifact matches a real commit.

### `deploy-github.sh` says `gh` is not installed

- Install it: <https://cli.github.com/> (`brew install gh` on macOS,
  `apt install gh` on many Linux distros). Then `gh auth login`.

### `deploy-github.sh` says the tag already exists

- Someone already released this version. Bump `package.json`'s version (and
  add a corresponding `## [x.y.z]` CHANGELOG section) before releasing again.

### `verify-deployment.sh` fails at "register.json was not created"

- This almost always means the CLI was invoked from a different directory
  than the one being analyzed. Code Pro Max writes `documents/` relative to
  where you *run* the command, not the `repoPath` argument — see the
  callout in [docs/OPERATOR-GUIDE.md](docs/OPERATOR-GUIDE.md#codepro-find-n-repopath).
  `verify-deployment.sh` itself accounts for this by `cd`-ing into the
  throwaway test repo before invoking the CLI.

### `verify-deployment.sh --npm` fails at "Install"

- The package may not be visible on the registry yet (npm's CDN can lag a
  few seconds to a minute after `npm publish`). Retry once, or run
  `npm view codepromax version` to confirm what's actually live.

## Rollback

See [ROLLBACK.md](ROLLBACK.md).
