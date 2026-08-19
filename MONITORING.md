# Monitoring

**There is no running service to monitor.** Code Pro Max is invoked on
demand — a CLI command or an MCP tool call — and exits when the command
finishes. There is no uptime, no request rate, no server process sitting
between deployments waiting for traffic. Dashboards for "error rate," "p99
response time," or "daily active users" would describe a service that
doesn't exist; writing them here would be exactly the kind of fabrication
this project's own generators are built to refuse (see
[CONTRIBUTING.md](CONTRIBUTING.md)).

This is not a gap to be filled in later by better tooling — it's a
consequence of the deployment methods actually in use (see
[deploy-strategy.md](deploy-strategy.md)). If that changes — specifically,
if an HTTP-facing wrapper around `CommandHandler` gets built (see the note
in `deploy-strategy.md`'s "What Was Deliberately Not Built" section) — this
file should be rewritten from scratch against whatever that service actually
looks like, not patched.

## What's Real Today

### Per-Run Diagnostics

Every `AnalysisResult` (`src/services/types.ts`) already carries structured
run-level telemetry, printed by the CLI and returned by every MCP tool call:

- `status`: `COMPLETE` / `PARTIAL` / `FAILED`
- `durationMs`: wall-clock time for the run
- `evidenceSources`: per-source (`code`/`git`/`test`/`dependency`)
  success/partial/skipped/failed status, finding count, and warnings
- `warnings`: every non-fatal issue encountered

There's nothing to "set up" here — it's already in every `find`/`re-analyze`
result. If you're running Code Pro Max in a script (CI, a cron job, an
agent), capture and log that JSON yourself; there's no reason to build a
separate telemetry pipeline for data the tool already hands you.

### MCP Server Process Logs

`bin/mcp-server.js` writes one line to stderr on startup
(`Code Pro Max MCP server running on stdio (6 tools registered).`) and logs
uncaught startup failures. If you run it under a process supervisor
(systemd, pm2, a container orchestrator — none of which are set up here),
point its log capture at stderr; that's the entire current logging surface.

### What You'd Actually Want to Track, If This Becomes a Service

Documented for a future reader who does build the HTTP wrapper, not as a
current setup guide:

| Signal | Source | Why |
|---|---|---|
| Request success/failure rate | Wrap each `CommandHandler` call | `AnalysisResult.status` already distinguishes COMPLETE/PARTIAL/FAILED — surface it |
| Analysis duration distribution | `AnalysisResult.durationMs` | Already computed; needs an aggregator, not new instrumentation |
| Evidence source failure rate | `AnalysisResult.evidenceSources[].status` | Tells you if e.g. git access is failing systematically, not per-run |
| Consistency check failure rate | `BuildResult.consistencyValid` / `.consistencyErrors` | A rising rate would indicate a generator regression |

None of this requires CloudWatch, Datadog, or any specific vendor — it's
"log the JSON the tool already returns, and look at it." Pick a log
aggregator when there's an actual deployment target that produces enough
volume to need one.
