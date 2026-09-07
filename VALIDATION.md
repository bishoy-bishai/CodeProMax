# Validation

Code Pro Max is a markdown-only prompt skill — there is no application
runtime to test. Validation instead checks packaging correctness (the
skill/plugin/marketplace structure is well-formed) and behavioral integrity
(the instructions still encode the rules that make the skill trustworthy).

## Structural validation

```bash
python3 scripts/validate.py
```

Checks, stdlib-only:

- Required files exist (`SKILL.md`, `README.md`, `LICENSE`,
  `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`).
- `SKILL.md` has valid YAML frontmatter with a `name` and a substantive
  `description`.
- `plugin.json` / `marketplace.json` are valid JSON, have required fields,
  use semver, and reference each other consistently by name.
- Every relative markdown link inside `SKILL.md`, `README.md`, and
  `references/*.md` resolves to a real file (placeholder links inside
  `templates/*.md` that describe the shape of *future generated* documents
  are intentionally excluded).
- No hardcoded secrets (API keys, private key headers, GitHub/OpenAI-style
  tokens) or machine-specific local filesystem paths (`/Users/...`,
  `/home/...`) in tracked files.

## Behavioral tests

```bash
python3 scripts/test_behavior.py
```

This skill's "behavior" is its written instructions, so these tests assert
that specific load-bearing rules are still present in `SKILL.md` and
`references/`:

- The no-fabrication markers (`[PLACEHOLDER]`, `[UNKNOWN]`, `[ASSUMPTION]`,
  `[HYPOTHESIS]`) are defined.
- The "evidence before initiative" core principle is present.
- Phase 4 Validate still gates on every Initiative scope item having ticket
  coverage.
- Implementation requires explicit user approval — never triggered merely
  by discovery.
- The branch onboarding/review utilities are documented as read-only.
- MR generation is documented as producing text only — it never creates a
  branch, commits, pushes, or opens a real MR/PR.
- The Plan phase forbids generating tickets before the Tech Spec/ADR design
  is settled.
- `ticket-to-prompt` is documented as prompt-generation only, not an
  implementation step.

## Claude Code plugin validation

Requires the `claude` CLI:

```bash
claude plugin validate . --strict
```

## Manual smoke tests performed for this release

- `claude plugin validate . --strict` — passed.
- `claude plugin marketplace add ./` + `claude plugin install
  code-pro-max@code-pro-max` from a clean `git clone` — installed with a
  single correctly-detected skill component (no duplicates).
- `npx skills add bishoy-bishai/CodeProMax -l` — correctly discovered the
  one published skill (`code-pro-max`) with its full description, from the
  live GitHub repository.
- `npx skills add bishoy-bishai/CodeProMax --skill code-pro-max --agent
  claude-code --copy -y` into an isolated temp directory — installed
  `SKILL.md` correctly to `.claude/skills/code-pro-max/`.
- `gh` CLI was not available in the environment this release was prepared
  in, so `gh skill preview` / `gh skill publish --dry-run` were not run —
  see the final report for this as an open item, not a failure.

## CI

`.github/workflows/validate.yml` runs structural validation, behavioral
tests, and `claude plugin validate . --strict` on every push and pull
request to `main`.
