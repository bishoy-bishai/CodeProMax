#!/usr/bin/env python3
"""Behavioral regression tests for the Code Pro Max skill's own instructions.

This is a prompt-only skill: there's no runtime to unit-test, so these tests
assert that the *instructions themselves* still encode the rules that make
the skill trustworthy - no-fabrication markers, phase ordering, ticket
coverage gates, and read-only boundaries for the branch utilities. If a future
edit accidentally drops one of these rules from SKILL.md/references, this
test suite catches it before it reaches users.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL_DIR = ROOT / "skills" / "code-pro-max"

failures = []


def read(*parts):
    text = (SKILL_DIR.joinpath(*parts)).read_text(encoding="utf-8")
    # Markdown hard-wraps prose across lines, which breaks naive substring
    # matching on multi-word phrases - normalize whitespace for matching.
    return re.sub(r"\s+", " ", text)


def check(condition, description):
    if not condition:
        failures.append(description)


def test_no_fabrication_markers_present():
    skill = read("SKILL.md")
    for marker in ("[PLACEHOLDER]", "[UNKNOWN]", "[ASSUMPTION]", "[HYPOTHESIS]"):
        check(marker in skill, f"SKILL.md must define the '{marker}' no-fabrication marker")


def test_evidence_before_initiative_rule():
    skill = read("SKILL.md")
    check(
        "Never recommend a generic improvement without evidence" in skill,
        "SKILL.md must retain the 'evidence before initiative' core principle",
    )


def test_ticket_coverage_gate_present():
    skill = read("SKILL.md")
    check(
        "every ticket maps back to a Scope item" in skill,
        "Phase 4 Validate must gate on every scope item having ticket coverage (prevents an incomplete package from being marked done)",
    )


def test_approval_stays_explicit_for_implementation():
    skill = read("SKILL.md")
    check(
        "approval stays explicit" in skill.lower(),
        "Lifecycle rule must state implementation requires explicit approval, never silent code changes",
    )


def test_branch_utilities_are_read_only():
    branch_ops = read("references", "branch-operations.md")
    skill = read("SKILL.md")
    check(
        "read-only" in skill.lower() or "does not modify" in skill.lower(),
        "SKILL.md must document that onboarding/review branch utilities are read-only",
    )
    check(len(branch_ops) > 0, "branch-operations.md must exist and be non-empty")


def test_mr_generation_never_touches_remote():
    mr_gen_ref = read("SKILL.md")
    check(
        "never creates a branch, commits, pushes, or opens an" in mr_gen_ref,
        "MR generation must be documented as producing text only, never a real git/remote action",
    )


def test_phase_order_is_evidence_then_design_then_tickets():
    skill = read("SKILL.md")
    # The plan phase must explicitly forbid jumping to tickets before design.
    check(
        "never jump to tickets before the design" in skill.lower(),
        "Phase 3 Plan must forbid generating tickets before Tech Spec/ADR design is settled",
    )


def test_ticket_to_prompt_does_not_implement():
    ref = read("references", "ticket-to-prompt.md")
    skill = read("SKILL.md")
    check(
        "does not implement anything" in skill,
        "ticket-to-prompt utility must be documented as prompt-generation only, not an implementation step",
    )
    check(len(ref) > 0, "ticket-to-prompt.md reference must exist")


def main():
    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    for test in tests:
        test()
    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        print(f"\n{len(failures)} behavioral rule(s) missing")
        return 1
    print(f"PASSED: {len(tests)} behavioral rule checks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
