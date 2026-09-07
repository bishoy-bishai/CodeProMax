# Validation

Code Pro Max is a markdown-only prompt skill — there is no application
runtime to test. Validation instead checks **packaging correctness** (the
skill/plugin/marketplace structure is well-formed and internally
consistent) and **behavioral integrity** (the instructions still encode the
rules that make the skill trustworthy).

Everything here is Python standard library only. There are no dependencies
to install and nothing to build.

---

## Quick start

```bash
python3 validation/validate.py            # packaging validation
python3 validation/validate.py --strict   # warnings become failures
python3 -m unittest discover -s tests -v  # behavioral tests
```

All three must pass before a pull request is merged, and CI runs all three.

---

## What `validation/validate.py` checks

**Structure**

- Required files exist: `README.md`, `LICENSE`, `VALIDATION.md`,
  `CONTRIBUTING.md`, both manifests, `SKILL.md`, the skill README, and the
  command file.
- `skills/code-pro-max/` has the `references/`, `templates/`, and
  `commands/` subdirectories, each containing markdown.
- `SKILL.md` has parseable YAML frontmatter with a valid lowercase-slug
  `name` and a `description` long enough to route the skill.
- Exactly one skill is published from `skills/`.

**Claude Code plugin manifest**

- `.claude-plugin/plugin.json` is valid JSON with `name`, `version`,
  `description`, `author`, `license`, `homepage`, `repository`.
- `name` is a valid lowercase plugin slug; `version` is semver.
- Every entry in `commands` resolves to a real file on disk.

**Marketplace manifest**

- `.claude-plugin/marketplace.json` is valid JSON with `name` and an
  `owner` object.
- Each plugin entry has a `name` and a `source`; a local `source` must
  resolve to a directory that actually contains `.claude-plugin/plugin.json`.
- At least one entry's name matches `plugin.json`'s name.

**Documentation**

- Every relative Markdown link in the root docs, `SKILL.md`, the skill
  README, `references/`, and `commands/` resolves to a real file or
  directory. External URLs are parsed but never fetched — availability is
  not checked.
- `templates/` is deliberately excluded: its links describe the shape of
  documents the skill will *generate later*, so those targets do not exist
  in this repo by design.

**Security**

- Scans all tracked `.md`, `.mdc`, `.json`, `.py`, `.yml`, `.sh`, `.toml`
  files for AWS keys, private key blocks, GitHub/OpenAI/Slack/Google token
  shapes, and assigned credential literals (`password = "…"`).
- Flags machine-specific absolute paths (`/Users/<someone>/…`,
  `/home/<someone>/…`, `C:\Users\…`) that would leak an author's local
  filesystem layout. Documented placeholders such as `~/tools/CodeProMax`
  are fine.

**Consistency**

- `SKILL.md`'s name matches `plugin.json`'s name; the marketplace entry
  matches the plugin name.
- `plugin.json`'s declared license matches the actual `LICENSE` header
  (ISC).
- No document states a version that contradicts `plugin.json`.
- `homepage` / `repository` point at the canonical repo URL.
- No document claims Anthropic verification or official endorsement.

Errors always fail the run (exit code 1). With `--strict`, warnings fail it
too.

---

## What the behavioral tests check

`tests/test_behavior.py` (stdlib `unittest`, deterministic, no network and
no model calls) asserts that the *instructions themselves* still encode the
invariants:

- **Evidence discipline** — the "never recommend a generic improvement
  without evidence" rule, the Problem → Evidence → Impact → Initiative →
  Cost → Recommendation chain, the FACT/INFERENCE/HYPOTHESIS/UNKNOWN claim
  tiers, and the `[PLACEHOLDER]` / `[UNKNOWN]` / `[ASSUMPTION]` /
  `[HYPOTHESIS]` no-fabrication markers.
- **Placeholder conventions** — every template uses bracketed
  placeholder tokens for unknown fields instead of inviting invented
  content, and no template carries a machine-specific path.
- **Planning chain** — Initiative → Epic → Tech Spec → ADR → Tickets →
  Release Ticket → Stakeholder Report is documented, a template exists for
  each link, design precedes tickets, the INVEST gate is referenced, and
  the scope-to-ticket traceability gate ("every ticket maps back to a Scope
  item") survives.
- **Safety boundaries** — Discover changes no code; branch onboarding and
  branch review are labelled read-only in both `SKILL.md` and the command
  file; MR generation never creates a branch, commits, pushes, or opens an
  MR/PR; `ticket-to-prompt` produces a prompt and implements nothing;
  implementation requires explicit approval.
- **Documentation consistency** — every workflow the README advertises
  exists in `SKILL.md`, and every `references/` and `templates/` file is
  linked from `SKILL.md`.

---

## Expected successful output

```
$ python3 validation/validate.py --strict
PASSED: 0 errors, 0 warning(s)

$ python3 -m unittest discover -s tests
...........................
----------------------------------------------------------------------
Ran 27 tests in 0.04s

OK
```

---

## Claude Code plugin validation

If the `claude` CLI is installed, it can validate the plugin manifests
directly:

```bash
claude plugin validate . --strict
```

This is the Claude Code CLI's own check, not part of this repo's scripts;
if the command is unavailable in your environment, the Python validation
above still covers manifest structure, resolution, and consistency.

---

## CI

`.github/workflows/validate.yml` runs on every push to `main` and every
pull request:

1. `python3 validation/validate.py`
2. `python3 validation/validate.py --strict`
3. `python3 -m unittest discover -s tests -v`
4. `claude plugin validate . --strict` (after installing the Claude Code
   CLI)

No secrets, no network access beyond the toolchain installs, no external
services.

---

## Security & privacy posture

- The skill itself is markdown: it executes nothing, makes no network
  calls, and emits no telemetry.
- The only executable files in this repository are `validation/validate.py`
  and `tests/test_behavior.py`. Both are stdlib-only, read-only against the
  repository, and are never invoked by the skill — only by you or CI.
- The skill writes planning documents into the user's working tree. It does
  not modify source code, and it never creates a branch, commit, tag, push,
  or pull/merge request. Implementation is a separate, explicitly approved
  workflow.

---

## Contributor checklist before opening a PR

- [ ] `python3 validation/validate.py --strict` passes.
- [ ] `python3 -m unittest discover -s tests -v` passes.
- [ ] If you changed a load-bearing rule in `SKILL.md`, you updated the
      matching behavioral test rather than deleting it.
- [ ] New `references/` or `templates/` files are linked from `SKILL.md`.
- [ ] New workflows described in the README exist in `SKILL.md`.
- [ ] No absolute local paths, secrets, or invented example output added.
- [ ] Version strings (if bumped) are consistent across `plugin.json`,
      `marketplace.json`, and the docs.
