# Code Pro Max

Code Pro Max scans a repository, turns what it finds into scored,
evidence-backed engineering **Initiatives**, and generates the planning
documents needed to act on them — an initiative brief, a product epic, a
technical specification, and INVEST-validated implementation tickets.

Every claim in every generated document traces back to real evidence (code,
git history, test results, dependency manifests) or is explicitly marked
`[PLACEHOLDER]`, `[UNKNOWN]`, or `[ASSUMPTION]`. Nothing is fabricated to make
output look more complete than the evidence supports — that rule applies to
the tool's own output, and to this README.

> **Status:** v0.1.0, run from a local checkout. Not published to a package
> registry; there is no `.env` configuration, no Jira/Slack/GitHub API
> integration, and no LangChain/OpenAI/Semantic Kernel wrapper today. See
> [Roadmap](#roadmap--not-yet-implemented) for what's planned versus what
> exists. Full gap list in [RELEASE-NOTES.md](RELEASE-NOTES.md).

---

## Table of Contents

- [Overview & Value Proposition](#overview--value-proposition)
- [Prerequisites & Installation](#prerequisites--installation)
- [Command Reference](#command-reference)
- [Usage Examples](#usage-examples)
- [Error Handling & Limitations](#error-handling--limitations)
- [Testing](#testing)
- [Compatibility & Integration](#compatibility--integration)
- [Roadmap / Not Yet Implemented](#roadmap--not-yet-implemented)

---

## Overview & Value Proposition

**Code Pro Max turns "the codebase feels risky" into a ranked, evidence-backed
list of specific problems — each with a scored priority, a traced root cause,
and a ready-to-build implementation plan.**

### The Difference Evidence Makes

| Generic recommendation | Code Pro Max finding |
|---|---|
| "Improve error handling" | `INIT-00N`: 2 error-handling findings (missing try/catch on async functions, no structured logging), each pointing at the exact file/function, classified `FACT` from direct code inspection, with a 5-Whys root cause ("no shared error-handling middleware exists across services") |
| "Reduce technical debt" | A `finalScore` of 0-100 derived from a documented formula (`round((impact+confidence+urgency+leverage+(6-cost)+(6-risk))/30*100)`), with a `decisionTrace` narrative explaining every axis — never a bare number |
| "This file is complex" | A `CodeIssue` with `functionName`, `lineCount`, `complexity`, and the exact threshold it exceeded, in `src/analyzers/evidence-collector.ts` |

If the evidence isn't there, Code Pro Max says so — a `Finding` with zero
evidence records is rejected at the schema level; it's not a finding, it's
speculation.

### Use Cases

| Scenario | How Code Pro Max helps |
|---|---|
| **Repository health assessment** | `codepro find 5` surfaces the highest-scored real problems (error handling gaps, complexity hotspots, duplicated code, high coupling, outdated dependencies, churn/instability) without a human triage pass |
| **Engineering roadmap planning** | `documents/initiatives/initiative-register.md` gives a ranked, scored backlog with confidence levels — useful as roadmap input, not a finished roadmap |
| **Technical debt tracking** | Each initiative's `evidence` array is traceable back to file:line; `codepro re-analyze` detects when a tracked problem is resolved or a new one appears |
| **Onboarding new engineers** | An `initiative.md` + `tech-spec.md` pair gives a new engineer a concrete, evidence-grounded entry point into an unfamiliar area of the codebase |
| **Budget justification for engineering investment** | The scoring breakdown and decision trace on each initiative are the same artifact you'd hand to a lead/PM to justify prioritizing the work — because they're generated from evidence, not asserted after the fact |
| **Team alignment on priorities** | A shared, deterministic ranking (the same repo state always produces the same score) gives a team something concrete to disagree with, instead of competing gut feelings |

### How It's Different

| | SonarQube / Codacy | Manual code review | Traditional tech-debt tracker | Code Pro Max |
|---|---|---|---|---|
| Output | Rule violations, style/quality metrics | Opinions, PR comments | Manually-written tickets | Scored, evidence-backed Initiatives |
| Root cause | Not addressed | Sometimes, informally | Rarely | 5-Whys analysis with systemic/actionable classification |
| Prioritization | Severity levels, not a unified score | Whoever's loudest | Arbitrary or absent | Documented 6-axis formula with a decision trace |
| Planning docs | None | None | Written by hand | Initiative brief, epic, tech spec, tickets — generated from the same source data, so they can't drift from each other |
| Confidence signaling | Implicit | Implicit | Implicit | Explicit: `FACT`/`INFERENCE`/`HYPOTHESIS`/`UNKNOWN` classification, `[PLACEHOLDER]` markers for anything not backed by evidence |

Code Pro Max is not a replacement for SonarQube-style linting or human code
review — it consumes the same kind of static-analysis signal SonarQube does
(plus git and dependency signal) and turns it into prioritized, documented
*work items*, which those tools don't do.

---

## Prerequisites & Installation

### System Requirements

| Requirement | Minimum | Notes |
|---|---|---|
| Node.js | 18+ | Developed and tested against Node 22; the codebase uses `ES2022`/`NodeNext` module resolution (`tsconfig.json`) |
| npm | Any version bundled with a supported Node release | No yarn/pnpm-specific tooling is used |
| Git | Required for full evidence collection | Git evidence collection (commit history, churn, authorship) is skipped gracefully with a warning if the target isn't a git repository — it does not fail the whole run |
| RAM | No enforced minimum | Not benchmarked; repository scanning and evidence collection are file-by-file and hold the current file's content in memory, not the whole repo |
| Disk | Space for the target repo plus generated Markdown (typically small — a handful of files per initiative) | |
| OS | Any OS Node.js runs on | Uses `fs/promises` and `path`; no shell-outs to OS-specific tools except `git` |

### Environment Variables

**None required.** Code Pro Max is a local CLI tool with no `.env` file, no
API keys, and no external service calls. All configuration is either a CLI
argument (`codepro find <N> [repoPath]`) or a programmatic option
(`PipelineOptions.timeoutMs`, `onProgress`) not currently exposed as a flag.
See [Roadmap](#roadmap--not-yet-implemented) for planned CLI flags.

### Installation Steps

**Via npm (recommended)** — once published, no checkout is needed; `npx`
fetches and runs the CLI on demand:

```bash
npx -y -p codepromax codepro help
npx -y -p codepromax codepro find 3 .
```

The `-p codepromax` form is required because the package exposes two bins
(`codepro` and `codepro-mcp`), so a plain `npx codepromax` can't infer which
one to run.

**From a local checkout** — for development, or before the package is
published:

```bash
git clone <repo-url>
cd CodeProMax
npm install
```

Verify the install:

```bash
npm run typecheck   # see the caveat in the note below
npm test
```

Expected: `npm test` prints `Test Files  20 passed (20)` /
`Tests  357 passed (357)`. `npm run typecheck` currently reports errors —
this is a known, repo-wide condition (see the note below), not a sign your
install is broken.

> **Note on `npm run typecheck`:** every source file imports sibling modules
> with an explicit `.ts` extension (NodeNext-style). The installed TypeScript
> version rejects that without `allowImportingTsExtensions`, which is off in
> `tsconfig.json`. This affects the entire codebase, not anything specific to
> your checkout — `npm test` (via `vitest`, which resolves these imports
> correctly) is the reliable signal that the install works.

### Verification Checklist

```bash
# 1. Tests pass
npm test
# → Test Files  20 passed (20) / Tests  357 passed (357)

# 2. CLI runs and prints help
npx tsx src/cli/entry-point.ts help
# → lists all 7 commands with descriptions and examples

# 3. Analyze a real repository
npx tsx src/cli/entry-point.ts find 3 .
# → writes documents/initiatives/register.json + initiative-register.md
#   and one initiative.md per top-3 finding (fewer if fewer are found)
```

If all three succeed, the install is verified.

**Common issues:**

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot find module ... .ts` when running with plain `node` | Node's built-in loader doesn't resolve the project's `.ts`-extension imports | Run via `npx tsx src/cli/entry-point.ts ...` (or another TS-aware runner), not `node src/cli/entry-point.ts` directly |
| `npm run typecheck` reports many errors | Known repo-wide `.ts`-import-extension condition (see above) | Not a broken install — rely on `npm test` instead |
| `find`/`build`/etc. throw immediately | Argument validation failed (e.g. `N` outside 1-10, missing `INIT-ID`) | The error message states exactly which argument and why — see [Error Handling](#error-handling--limitations) |

---

## Command Reference

Code Pro Max exposes seven commands through `CommandHandler`
(`src/commands/command-handler.ts`) and the CLI wrapper
(`src/cli/entry-point.ts`). The schemas below are the actual TypeScript
return types (`src/commands/types.ts`), not a separate API spec — the CLI
prints a formatted summary of the same data it returns programmatically.

### `find`

**Purpose:** Analyze a repository and generate initiative briefs for the top
`N` scored opportunities.

**CLI:** `codepro find <N> [repoPath]`

**Parameters:**

| Name | Required | Type | Constraint | Default |
|---|---|---|---|---|
| `n` | Yes | integer | 1–10 | — |
| `repoPath` | No | string | any readable path | current working directory |

There is no `analysis_depth`, `include_runtime_signals`, or `timeout_seconds`
CLI flag. The pipeline underneath accepts a `timeoutMs` option and an
`onProgress` callback programmatically (`PipelineOptions`, defaulting to a
15-minute timeout), but the CLI does not expose either as a flag yet.

**Output (`FindResult`):**

```typescript
interface FindResult {
  initiatives: Initiative[];      // the top-N, full Initiative objects
  filesCreated: string[];         // one initiative.md path per initiative
  analysisId: string;             // e.g. "analysis-1755612345678"
  analysisStatus: "COMPLETE" | "PARTIAL" | "FAILED";
  analysisDurationMs: number;
  evidenceCount: number;
}
```

An `Initiative` (the real shape, `src/schemas/types.ts`) includes `id`
(`INIT-NNN`), `name`, `status`, `problemStatement`, `opportunity`, `evidence`
(non-empty array of `EvidenceRecord`), and `scoring` (`breakdown` across 6
axes, `finalScore` 0-100, `scoreConfidence`, `decisionTrace`,
`derivationRules`). There is no separate `impact`/`effort` shorthand field —
those live inside `scoring.breakdown`.

### `build`

**Purpose:** Generate the full document package for one initiative already in
the register, and attempt to advance its status through the guarded state
machine.

**CLI:** `codepro build <INIT-ID>`

Generates **four** documents, not six: `initiative.md`, `epic.md`,
`tech-spec.md`, and one `tickets/{NN}-{slug}.md` per scope item.
`release.md` and `stakeholder-report.md` are not implemented — see
[Roadmap](#roadmap--not-yet-implemented).

**Output (`BuildResult`):**

```typescript
interface BuildResult {
  initiativeId: InitiativeId;
  filesCreated: string[];
  ticketCount: number;
  consistencyValid: boolean;
  consistencyErrors: string[];
  finalStatus: InitiativeStatus;      // e.g. "Selected" or "Planned"
  transitionWarnings: string[];       // why status didn't advance further, if it didn't
}
```

### `review`

**Purpose:** Audit every initiative in the register for three real, checkable
conditions — not a generic "validation" pass:

1. **Stale evidence** — `updatedAt` more than 90 days old
2. **Potential duplicates** — identical (normalized) problem-statement text
3. **Missing tech spec** — status is `Planned`/`In Progress` but no
   `tech-spec.md` exists on disk

**CLI:** `codepro review`

**Output (`ReviewResult`):**

```typescript
interface ReviewResult {
  initiativeCount: number;
  issuesFound: number;
  issues: Array<{
    severity: "error" | "warning" | "info";
    initiativeId: InitiativeId;
    issue: string;
    recommendation: string;
  }>;
}
```

### `re-analyze`

**Purpose:** Re-run the full analysis pipeline and reconcile it against the
existing register, matched by normalized problem-statement text.

**CLI:** `codepro re-analyze [repoPath]`

**Output (`ReAnalysisResult`):**

```typescript
interface ReAnalysisResult {
  newInitiatives: number;
  resolvedInitiatives: number;      // matched in the old register, not in the fresh one
  changedScores: number;
  unchangedInitiatives: number;
  changedDetails: Array<{ id: InitiativeId; previousScore: number; newScore: number; reason: string }>;
  summary: string;                  // human-readable one-line rollup
}
```

### `update`

**Purpose:** Re-run analysis and refresh one initiative's evidence and score.

**CLI:** `codepro update <INIT-ID> [repoPath]`

There is no evidence-collection API scoped to a single finding — this command
re-runs the full pipeline and matches the result back to the target
initiative by problem-statement text, then throws if nothing matches (see
[Error Handling](#error-handling--limitations)).

**Output (`UpdateResult`):**

```typescript
interface UpdateResult {
  initiativeId: InitiativeId;
  evidenceCount: number;
  scoreChanged: boolean;
  previousScore: number;
  newScore: number;
}
```

### `status`

**Purpose:** Register overview.

**CLI:** `codepro status`

**Output (`StatusResult`):**

```typescript
interface StatusResult {
  totalInitiatives: number;
  byStatus: Record<InitiativeStatus, number>;
  topOpportunity: { id: InitiativeId; name: string; score: number } | null; // highest-scored "Proposed" initiative
  lastAnalyzed: string; // ISO-8601
}
```

### `help`

**Purpose:** List all commands.

**CLI:** `codepro help` (also the default when no command is given)

**Output (`HelpResult`):** an array of `{ name, description, example }` for
all seven commands.

---

## Usage Examples

All examples assume you're in the Code Pro Max checkout and invoking the CLI
via `tsx` (see [Installation](#installation-steps)); adjust `repoPath` to
point at whatever repository you want analyzed.

### Example 1 — Find opportunities

```bash
npx tsx src/cli/entry-point.ts find 5 ./my-app
```

Illustrative output (the actual initiatives, scores, and count depend
entirely on what evidence exists in `./my-app` — the format below is real,
the numbers are a stand-in):

```
[repository-mapping] Scanning ./my-app…
[code-evidence] Collecting code, git, test, and dependency evidence…
[rca-analysis] Running RCA on 6 finding(s)…
[opportunity-generation] Generating opportunities from 6 finding(s)…
[initiative-creation] Creating 6 initiative(s)…
[scoring] Ranking 6 initiative(s)…
[complete] Analysis complete. 6 initiative(s) ranked.

Generated 5 file(s) for 5 initiative(s).
  INIT-001 — Improve Production Error Observability (83/100)
  INIT-002 — Reduce products.ts Complexity and Maintainability Risk (71/100)
  INIT-003 — Consolidate Shared Utilities and Eliminate Code Duplication (64/100)
  INIT-004 — Establish Module Boundary Architecture for api (58/100)
  INIT-005 — Modernize and Secure the Dependency Stack (52/100)
```

(Progress lines come from `PipelineStep`/`onProgress` in
`src/services/types.ts`; the summary lines come from the CLI's own
`console.log` calls in `src/cli/entry-point.ts` — this is the real format,
not a mockup.)

### Example 2 — Build an initiative

```bash
npx tsx src/cli/entry-point.ts build INIT-001
```

```
Built 4 ticket(s) across 7 file(s).
Status: Selected — Consistency: OK
  ! Stopped at "Selected": Transition "Selected" → "Planned" blocked: 1 guard(s) failed
```

That last line is normal, not an error: `build` only advances status as far
as the real guards in `src/core/state-machine.ts` allow. A freshly-discovered
initiative typically has an unanswered open question, which blocks
`Selected → Planned` until someone answers it.

### Example 3 — Review the register

```bash
npx tsx src/cli/entry-point.ts review
```

```
2 issue(s) across 5 initiative(s).
  [error] INIT-003: Tech spec missing for planned initiative — Run /codepro build INIT-003 or change status
  [warning] INIT-005: Evidence may be stale (94 days since last update) — Re-analyze and update
```

### Example 4 — Re-analyze after changes

```bash
npx tsx src/cli/entry-point.ts re-analyze ./my-app
```

```
Found 1 new opportunity. 1 resolved. 2 changed priority. 2 remain unchanged.
```

### Example 5 — Check overall status

```bash
npx tsx src/cli/entry-point.ts status
```

```
Total initiatives: 5
  Proposed: 3
  Selected: 1
  Planned: 1
  In Progress: 0
  Released: 0
  Validated: 0
  Completed: 0
Top opportunity: INIT-002 — Reduce products.ts Complexity and Maintainability Risk (71/100)
Last analyzed: 2026-08-19T12:03:44.000Z
```

### Prompt Examples (for driving Code Pro Max from an AI assistant)

These are prompts for a coding assistant that has shell/CLI access to this
repository and can run the commands above — Code Pro Max itself has no LLM
integration layer (see [Roadmap](#roadmap--not-yet-implemented)).

**Simple:**
> "Run Code Pro Max's `find` command with N=5 on this repository and
> summarize the top opportunities."

**Detailed:**
> "Run `codepro find 5` on this repo, then `codepro build` on the
> highest-scored initiative, and show me the generated tech spec."

**Recurring:**
> "Run `codepro re-analyze` and tell me what changed since the last run —
> new opportunities, resolved ones, and anything whose priority shifted."

There is currently no supported prompt pattern for Jira export, Slack
notification, or any other external-service integration — none of that
exists yet.

---

## Error Handling & Limitations

### How Errors Actually Surface

Code Pro Max does not define a fixed error-code enum (no `REPO_NOT_FOUND`,
`API_RATE_LIMIT`, etc.). Two real error shapes exist:

1. **`ValidationError`** (`src/schemas/types.ts`) — thrown for argument
   validation failures (e.g. `find` with `N` outside 1-10, `build`/`update`
   on an unknown initiative ID, a blocked state transition, or malformed
   register data). Carries a `message` plus a `details` array, each with
   `field`, `expected`, `received`, and an optional `suggestion`. The CLI
   prints all of these.
2. **Generic `Error`** — for CLI-level argument problems (e.g. a missing
   required argument), and anything an underlying operation (like `git`)
   throws that isn't wrapped.

Real examples:

| What you did | What you get |
|---|---|
| `codepro find 0` or `codepro find 11` | `ValidationError: N must be an integer between 1 and 10` |
| `codepro build INIT-999` (not in the register) | `ValidationError: Initiative INIT-999 not found` |
| `codepro update INIT-001` where the matched problem no longer appears in a fresh analysis | `ValidationError: No matching finding for INIT-001 in the current repository state` — suggests running `re-analyze` instead |
| `codepro build` on a fresh `INIT-XXX` with an open question | Not an error — `build` completes, `finalStatus` stops at `"Selected"`, and `transitionWarnings` explains which guard blocked `Selected → Planned` |
| Target path isn't a git repository | Not a hard failure — git evidence collection is skipped with a warning; other evidence sources still run |

### Pipeline-Level Degradation

`AnalysisPipeline.runFullAnalysis` returns a `status` of `"COMPLETE"`,
`"PARTIAL"` (one or more evidence sources failed but others succeeded), or
`"FAILED"` (repository mapping itself failed or timed out), plus a
`warnings: string[]` array — never a thrown exception for a partial evidence
failure. `find`/`re-analyze`/`update` all pass this status straight through.

### Real Limitations

- **No configurable repo-size cap.** Nothing enforces a maximum repository
  size; large repositories will simply take longer.
- **Timeout is 15 minutes by default, not CLI-configurable.**
  `AnalysisPipeline` accepts `timeoutMs` programmatically; the CLI doesn't
  expose a flag for it yet.
- **Code evidence collection considers these languages:** typescript,
  javascript, python, go, java, kotlin, ruby, php, rust (the exact set in
  `EvidenceCollector`, `src/analyzers/evidence-collector.ts`). Repository
  *mapping* (language/framework/dependency detection) recognizes a broader
  set of file types for structural stats, but function-level complexity and
  error-handling analysis is scoped to that language list.
- **Git evidence looks at the last 6 months of commit history** per file
  (`src/analyzers/evidence-collector.ts`), not a fixed commit count.
- **No real-time/runtime metrics.** All evidence is static: code, git
  history, test files, and dependency manifests. There is no
  `include_runtime_signals` option because there's no runtime signal
  collection at all.
- **Confidence reflects evidence quality already**, via the
  `FACT`/`INFERENCE`/`HYPOTHESIS`/`UNKNOWN` classification on every finding
  and the `scoreConfidence` (`High`/`Medium`/`Low`) on every initiative —
  this is load-bearing in the schema, not a documentation convention layered
  on top.

### What It Does NOT Do

- ✗ Modify source code — analysis and document generation only
- ✗ Deploy changes
- ✗ Real-time monitoring — static analysis only, on demand
- ✗ Guarantee effort or ROI — `scoring.breakdown` is a documented estimate
  formula, not a promise

### Removing an Initiative

There is no dedicated "remove" command. The register (`register.json`) is
plain JSON at `documents/initiatives/register.json`
(`src/commands/register-manager.ts`) — edit it directly to remove an entry,
then delete its document folder:

```bash
rm -rf documents/initiatives/INIT-XXX-slug
# then hand-edit documents/initiatives/register.json to drop the INIT-XXX entry
npx tsx src/cli/entry-point.ts status   # confirms the register still loads
```

---

## Testing

```bash
npm test                # full suite, single run — 357 tests across 20 files
npm run test:watch      # watch mode
npm run test:coverage   # coverage, scoped to src/schemas/ (see vitest.config.ts)
./scripts/run-tests.sh  # typecheck (informational) + test + coverage in one pass
```

Run a subset with vitest's own filtering:

```bash
npx vitest run src/schemas       # schema/validation tests
npx vitest run src/core          # pipeline + algorithm tests
npx vitest run src/generators    # document generator tests
npx vitest run src/commands      # /codepro command tests
```

There is no `npm run test:integration` or `npm run test:performance` script —
integration-style coverage exists (`src/core/__tests__/pipeline.test.ts` runs
the real pipeline against the checked-in `fixtures/test-repo/`), but it's
part of the same `npm test` run, not a separate benchmark suite. No
performance numbers are published because none have been measured against a
large repository — see [RELEASE-NOTES.md](RELEASE-NOTES.md).

### Local Smoke Test

```bash
npx tsx src/cli/entry-point.ts find 3 .
ls documents/initiatives/
cat documents/initiatives/initiative-register.md
npx tsx src/cli/entry-point.ts build $(ls documents/initiatives | grep INIT | head -1 | sed 's/.*/&/')  # or use a known INIT-ID
npx tsx src/cli/entry-point.ts review
```

---

## Compatibility & Integration

Code Pro Max exposes its commands two ways:

1. **CLI** (`src/cli/entry-point.ts`) — any shell, any coding agent with
   shell access.
2. **MCP server** (`src/adapters/mcp-server.ts`, launched via
   `npm run start:mcp` or `bin/mcp-server.js`) — 6 tools
   (`find_initiatives`, `build_initiative`, `review_initiatives`,
   `re_analyze`, `update_initiative`, `get_status`) over the standard [Model
   Context Protocol](https://modelcontextprotocol.io) stdio transport, for
   any MCP-speaking client (Claude Code, Claude Desktop, the Claude API via
   MCP, and other MCP clients). `help` is intentionally not a registered
   tool — MCP already gives the client a tool list with descriptions.

Both sit over the same plain TypeScript API (`CommandHandler`) and return the
same data — the MCP layer doesn't reformat or rename fields, it just wraps
each result in `{ success, data }` / `{ success: false, error }` (see
[docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md#mcp-adapter)).

There is no bundled adapter for frameworks that predate or sit outside MCP —
no LangChain tool wrapper, no OpenAI-function-calling shim, no Semantic
Kernel plugin, no Cursor command, no GitHub Actions workflow ships in this
repo.

| Platform | Status |
|---|---|
| CLI (any shell) | ✅ Works today via `npx tsx src/cli/entry-point.ts` |
| MCP client (Claude Code, Claude Desktop, other MCP clients) | ✅ `npm run start:mcp` — 6 tools, tested end-to-end over the real MCP protocol (`src/adapters/__tests__/mcp-server.test.ts`) |
| Programmatic (Node/TypeScript) | ✅ Import `CommandHandler` directly |
| LangChain, Semantic Kernel, OpenAI function calling (non-MCP), LlamaIndex | ❌ No bundled adapter — would need to be written against `CommandHandler`'s TypeScript API, unless the framework itself speaks MCP |
| Cursor command palette, GitHub Actions workflow | ❌ Not provided |
| Jira / Confluence / Slack export | ❌ Not implemented |

Output today is Markdown (generated documents) and JSON (`register.json`,
every `CommandHandler` method's return value, and every MCP tool response).
No YAML or CSV export exists.

### Running the MCP Server

From a local checkout:

```bash
npm run start:mcp
```

Via npm, once published:

```bash
npx -y -p codepromax codepro-mcp
```

See [docs/OPERATOR-GUIDE.md](docs/OPERATOR-GUIDE.md#mcp-server) for client
configuration and [docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md#mcp-adapter)
for the adapter's internals.

---

## Roadmap / Not Yet Implemented

Tracked honestly rather than silently — these were described in earlier
planning material for this project but are not in v0.1.0:

- `release.md` and `stakeholder-report.md` document generators (`build`
  currently produces four documents, not six)
- CLI flags for timeout and directory exclusion (`timeoutMs` exists on the
  pipeline API; nothing wires it to `codepro find`/`re-analyze`)
- `.env`-based configuration
- GitHub/Jira/Slack API integration and credential setup
- Non-MCP framework adapters (LangChain, Semantic Kernel, OpenAI function
  calling, LlamaIndex) — MCP itself is implemented (`src/adapters/`)
- YAML/CSV/Jira/Confluence export formats
- Performance benchmarking against large repositories
- A published npm package

See [RELEASE-NOTES.md](RELEASE-NOTES.md) for the complete, current list of
gaps, and [docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md) for how to
extend the system if you want to build one of these.

---

## Architecture

```
schemas/     Types, Zod schemas, validators, state machine definition
core/        Repository mapping, evidence classification, scoring, guarded state machine, pipeline
analyzers/   Evidence collection + root cause analysis (5 Whys)
services/    Opportunity generation, Initiative assembly/scoring
generators/  Markdown document generators (initiative, epic, tech-spec, tickets)
validators/  INVEST ticket validation
commands/    /codepro command orchestration, file I/O, register persistence
cli/         CLI entry point
```

Details: [docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md) ·
[docs/algorithms.md](docs/algorithms.md) ·
[docs/pipeline.md](docs/pipeline.md) ·
[docs/evidence-types.md](docs/evidence-types.md) ·
[docs/OPERATOR-GUIDE.md](docs/OPERATOR-GUIDE.md)

## Deployment

See [deploy-strategy.md](deploy-strategy.md) for which deployment methods
actually fit this tool (local install, npm publish, GitHub Releases — not
Docker/Heroku/AWS, and why), [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step
instructions and the `scripts/deploy-*.sh` automation, and
[ROLLBACK.md](ROLLBACK.md) if a release needs to be undone.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — in particular the no-fabrication
convention every generator and analyzer follows, and that this README
follows too.

## License

ISC (see `LICENSE`).
