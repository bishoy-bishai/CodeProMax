# Deployment Strategy

Code Pro Max is a **local CLI + stdio MCP server**: it runs on-demand,
analyzes a repository on the machine it's invoked from, and writes Markdown
to disk. It is not a long-running HTTP service. That shape determines which
of the eight deployment methods in the original request actually apply.

## Methods Evaluated

| Method | Fits this tool? | Why |
|---|---|---|
| Local install (git clone + npm install) | ✅ Yes | Already the primary, documented path (`README.md`) |
| npm package (public registry) | ✅ Yes | `package.json` now has correct `bin` entries, `files`, and a real `0.1.0` version — see below |
| GitHub Releases | ✅ Yes | Tags a commit and publishes CHANGELOG-derived notes; no server involved |
| Docker container | ❌ No, as-is | No `Dockerfile` exists. A container *could* wrap the CLI/MCP server for portability, but nothing in this tool needs containerizing to run — it's a local process, not a service with dependencies to isolate. Building one is a real option if you want reproducible execution environments, but it wasn't built here to avoid shipping an untested, unrequested artifact. |
| Docker Hub | ❌ No | Downstream of "Docker container" above — doesn't apply without one |
| Heroku | ❌ No | Heroku deploys apps behind a web dyno (a `Procfile` running an HTTP server). Code Pro Max has no HTTP server — `src/adapters/mcp-server.ts` speaks MCP over **stdio**, not HTTP. There's nothing for Heroku to route traffic to. |
| AWS Fargate | ❌ No | Same problem as Heroku: Fargate runs containerized services behind ECS, typically fronted by a load balancer expecting an HTTP or TCP listener. An MCP stdio server has no listening socket to expose that way. |
| Private npm registry (enterprise) | ⚠️ Same as public npm | Mechanically identical to public npm publish, pointed at a different registry URL (`npm config set registry ...` or `.npmrc` scoping) — not a separate script, just a different `--registry` flag on the same `deploy-npm.sh`. |

## Recommendation

**Local install → npm publish → GitHub Release, in that order.** This
matches how the tool is actually used today (a developer runs it against
their own or a colleague's repository) and requires no new infrastructure.

```
                        ┌─────────────────────┐
                        │  Is this for you or  │
                        │  one team, right now? │
                        └──────────┬───────────┘
                                   │
                     yes ──────────┴────────── no, want it installable elsewhere
                     │                                    │
                     ▼                                    ▼
          git clone + npm install              ┌─────────────────────────┐
          (README.md Quick Start)               │ Do consumers need       │
          — nothing to deploy                    │ `npm install -g` /      │
                                                  │ `npx codepromax`?       │
                                                  └───────────┬─────────────┘
                                                     yes ──────┴────── no
                                                     │                  │
                                                     ▼                  ▼
                                          scripts/deploy-npm.sh   scripts/deploy-github.sh
                                          (publishes to the       (tags + GitHub Release;
                                           npm registry)           consumers `git clone` a
                                                                    tagged version instead)
```

Both npm publish and GitHub Release are not mutually exclusive — a typical
release does both: publish to npm for `npm install -g`/`npx` users, and cut a
GitHub Release so the tag, commit, and release notes are discoverable without
touching the npm registry.

## What Changed to Make npm Publish Real

Before this pass, `package.json` would have produced a broken package:
`version` was `1.0.0` (mismatched with every doc claiming `v0.1.0`), there
was no `bin` entry for the CLI itself (only `codepro-mcp` existed), `tsx`
(required at runtime by both launcher scripts) was a devDependency and so
would not have installed for a package consumer, and there was no `LICENSE`
file despite `"license": "ISC"`. All four are fixed in this repo:
`version: "0.1.0"`, `bin.codepro` added (`bin/codepro.js`), `tsx` moved to
`dependencies`, and `LICENSE` added. Verified end-to-end with
`scripts/verify-deployment.sh --local` (installs from a real `npm pack`
tarball into an isolated prefix and exercises the CLI, an analysis run, and
the MCP server).

## What Was Deliberately Not Built

- **Dockerfile / container image** — no current need; would be a reasonable
  follow-up if reproducible execution environments become a requirement, not
  before.
- **Heroku / AWS Fargate deployment scripts** — would require first building
  an HTTP-facing wrapper around `CommandHandler` (turning a CLI/MCP tool into
  a web service is a real architecture change, not a deploy-script problem),
  which nothing in the current scope calls for.
- **Monitoring dashboards, CloudWatch/Datadog integration** — there is no
  running service to monitor; see `MONITORING.md` for what *would* be worth
  logging if this ever becomes one.
