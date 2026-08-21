# Contributing to the Engineering Improvement Initiative Skill

This repo is a skill — `skills/code-pro-max/SKILL.md`, its
`references/` directory, and its `templates/` — plus the client-specific
entry points (`commands/`, `cursor-rule/`, `codex-prompt/`) that install it
into Claude Code, Cursor, Codex CLI, and Antigravity. There is no code to
build or test; contributions are edits to these markdown files.

## Before You Start

Read [skills/code-pro-max/SKILL.md](skills/code-pro-max/SKILL.md) end to
end. The rule that shapes every file in this repo: **never fabricate.**
Any instruction that would cause the agent to invent a number, owner, date,
or fact instead of marking it `[PLACEHOLDER]`, `[UNKNOWN]`,
`[ASSUMPTION]`, or `[HYPOTHESIS]` will not be merged, regardless of how
complete it looks.

## Workflow

1. Fork or branch from `main`.
2. Make your change in `SKILL.md`, `skills/code-pro-max/references/*.md`,
   or `skills/code-pro-max/templates/*.md`.
3. If you change a section heading, file name, or add/remove a
   reference/template, update every file that links to it —
   `SKILL.md`, the other `references/*.md` files, and the
   `commands/`/`cursor-rule/`/`codex-prompt/` entry points all cross-link
   each other. A broken relative link is a broken skill.
4. Keep the phase structure intact (Discover → Select → Plan → Validate →
   Maintain) unless the change is specifically about restructuring it —
   most edits should slot into an existing phase/reference file rather than
   inventing a new top-level concept.
5. Open a PR describing what changed and why.

## Commit Style

Short, imperative commit subjects prefixed with `feat:`/`fix:`/`docs:`
(see `git log` for examples). Keep the body focused on *why*, not a
restatement of the diff.

## Review Checklist

- Does the changed instruction ever ask the agent to assert something not
  backed by real evidence? If so, it needs an explicit
  `[PLACEHOLDER]`/`[UNKNOWN]`/`[ASSUMPTION]`/`[HYPOTHESIS]` marker instead.
- Do all relative markdown links in the changed file still resolve? (Quick
  check: `grep -oE '\]\([a-zA-Z0-9/_.-]+\.md\)' <file> | tr -d '()' | while
  read f; do test -f "$(dirname <file>)/$f" || echo "MISSING $f"; done`)
- If you added a new template, does `SKILL.md` reference it from the phase
  where it's generated, and does the relevant `references/*.md` file
  describe when/how to fill it in?
- If you changed a client entry point (`commands/`, `cursor-rule/`,
  `codex-prompt/`), did you update the corresponding install instructions
  in [skills/code-pro-max/README.md](skills/code-pro-max/README.md)?

## Reporting Issues

There is no public tracker yet — open a PR or discussion describing the
gap.
