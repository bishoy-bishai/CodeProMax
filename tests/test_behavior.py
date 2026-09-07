#!/usr/bin/env python3
"""Behavioral regression tests for the Code Pro Max instructions.

Code Pro Max is a prompt-only skill: there is no runtime to unit-test, so its
"behavior" lives in the wording of SKILL.md, references/, templates/, and the
command file. These tests assert that the load-bearing invariants are still
present and consistent, so an edit cannot silently drop the evidence rules,
the planning chain, the read-only boundaries, or the approval gate.

Deterministic, stdlib-only, no network and no model calls.

Run:
    python3 -m unittest discover -s tests -v
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL_DIR = ROOT / "skills" / "code-pro-max"
TEMPLATES = SKILL_DIR / "templates"
REFERENCES = SKILL_DIR / "references"

NO_FABRICATION_MARKERS = ("[PLACEHOLDER]", "[UNKNOWN]", "[ASSUMPTION]", "[HYPOTHESIS]")

PLANNING_CHAIN = [
    "Initiative",
    "Epic",
    "Tech Spec",
    "ADR",
    "Ticket",
    "Release Ticket",
    "Stakeholder Report",
]


def flat(path):
    """Read a file with whitespace normalized, so hard-wrapped prose matches."""
    return re.sub(r"\s+", " ", path.read_text(encoding="utf-8"))


def flat_lower(path):
    return flat(path).lower()


class SkillFileSetTest(unittest.TestCase):
    """The files the instructions rely on must actually be there."""

    def test_skill_md_exists_and_is_substantive(self):
        skill = SKILL_DIR / "SKILL.md"
        self.assertTrue(skill.is_file(), "SKILL.md must exist")
        self.assertGreater(len(skill.read_text(encoding="utf-8")), 2000)

    def test_every_reference_and_template_is_non_empty(self):
        for directory in (REFERENCES, TEMPLATES):
            files = sorted(directory.glob("*.md"))
            self.assertTrue(files, f"{directory.name}/ must contain markdown files")
            for path in files:
                with self.subTest(file=path.name):
                    self.assertGreater(
                        len(path.read_text(encoding="utf-8").strip()),
                        100,
                        f"{path.name} is empty or a stub",
                    )


class EvidenceDisciplineTest(unittest.TestCase):
    """Recommendations must be evidence-backed, and gaps marked, never invented."""

    def test_evidence_before_initiative_principle_present(self):
        self.assertIn(
            "Never recommend a generic improvement without evidence",
            flat(SKILL_DIR / "SKILL.md"),
        )

    def test_reasoning_chain_documented(self):
        text = flat(SKILL_DIR / "SKILL.md")
        for step in ("Problem", "Evidence", "Impact", "Initiative", "Cost", "Recommendation"):
            with self.subTest(step=step):
                self.assertIn(step, text)

    def test_claim_classification_tiers_defined(self):
        text = flat(SKILL_DIR / "SKILL.md")
        for tier in ("FACT", "INFERENCE", "HYPOTHESIS", "UNKNOWN"):
            with self.subTest(tier=tier):
                self.assertIn(tier, text)

    def test_no_fabrication_markers_defined_in_skill(self):
        text = flat(SKILL_DIR / "SKILL.md")
        for marker in NO_FABRICATION_MARKERS:
            with self.subTest(marker=marker):
                self.assertIn(marker, text)

    def test_evidence_reference_exists_and_covers_classification(self):
        ref = REFERENCES / "evidence-and-analysis.md"
        self.assertTrue(ref.is_file())
        text = flat_lower(ref)
        self.assertIn("evidence", text)
        self.assertTrue(
            "fact" in text and "unknown" in text,
            "evidence-and-analysis.md must define the claim classification tiers",
        )

    def test_command_file_repeats_the_no_fabrication_rule(self):
        text = flat(SKILL_DIR / "commands" / "code-pro-max.md")
        self.assertIn("Never fabricate", text)


class PlaceholderConventionTest(unittest.TestCase):
    """Templates must ask for bracketed placeholders rather than invented facts."""

    BRACKET_TOKEN = re.compile(r"\[[A-Z][A-Z0-9 _/-]{2,}[:\]]")

    def test_every_template_uses_bracketed_placeholder_tokens(self):
        templates = sorted(TEMPLATES.glob("*.md"))
        self.assertTrue(templates)
        for path in templates:
            with self.subTest(template=path.name):
                self.assertRegex(
                    path.read_text(encoding="utf-8"),
                    self.BRACKET_TOKEN,
                    f"{path.name} must use [PLACEHOLDER]-style tokens for unknown fields",
                )

    def test_placeholder_markers_are_used_somewhere_in_templates(self):
        corpus = "\n".join(p.read_text(encoding="utf-8") for p in TEMPLATES.glob("*.md"))
        self.assertTrue(
            any(m.rstrip("]") in corpus for m in NO_FABRICATION_MARKERS),
            "templates must demonstrate the no-fabrication marker convention",
        )

    def test_templates_do_not_carry_machine_specific_paths(self):
        for path in sorted(TEMPLATES.glob("*.md")):
            with self.subTest(template=path.name):
                text = path.read_text(encoding="utf-8")
                self.assertNotRegex(text, r"/Users/[A-Za-z0-9._-]+/")
                self.assertNotRegex(text, r"/home/[A-Za-z0-9._-]+/")


class PlanningChainTest(unittest.TestCase):
    """Initiative -> Epic -> Tech Spec -> ADR -> Tickets -> Release -> Report."""

    def test_full_chain_is_documented_in_skill(self):
        text = flat_lower(SKILL_DIR / "SKILL.md")
        for artifact in PLANNING_CHAIN:
            with self.subTest(artifact=artifact):
                self.assertIn(artifact.lower(), text)

    def test_a_template_exists_for_each_chain_artifact(self):
        expected = [
            "initiative.md",
            "epic.md",
            "tech-spec.md",
            "adr.md",
            "ticket.md",
            "release-ticket.md",
            "stakeholder-report.md",
        ]
        for name in expected:
            with self.subTest(template=name):
                self.assertTrue((TEMPLATES / name).is_file(), f"missing templates/{name}")

    def test_design_precedes_tickets(self):
        text = flat_lower(SKILL_DIR / "SKILL.md")
        self.assertIn(
            "never jump to tickets before the design",
            text,
            "Plan phase must forbid generating tickets before Tech Spec/ADR is settled",
        )

    def test_scope_to_ticket_traceability_gate(self):
        text = flat(SKILL_DIR / "SKILL.md")
        self.assertIn(
            "every ticket maps back to a Scope item",
            text,
            "Validate phase must gate on scope-to-ticket traceability",
        )

    def test_invest_gate_documented(self):
        self.assertTrue((REFERENCES / "invest.md").is_file())
        self.assertIn("INVEST", flat(SKILL_DIR / "SKILL.md"))

    def test_register_keeps_initiatives_traceable(self):
        self.assertTrue((TEMPLATES / "initiative-register.md").is_file())
        self.assertIn("initiative-register.md", flat(SKILL_DIR / "SKILL.md"))


class SafetyBoundaryTest(unittest.TestCase):
    """Read-only workflows stay read-only; implementation stays approval-gated."""

    def test_branch_utilities_documented_read_only(self):
        text = flat_lower(SKILL_DIR / "SKILL.md")
        self.assertIn("neither operation modifies code", text)
        self.assertTrue((REFERENCES / "branch-operations.md").is_file())

    def test_command_file_marks_branch_operations_read_only(self):
        text = flat_lower(SKILL_DIR / "commands" / "code-pro-max.md")
        self.assertGreaterEqual(
            text.count("read-only"),
            2,
            "onboarding and review must both be labelled read-only in the command file",
        )

    def test_mr_generation_never_touches_the_remote(self):
        needle = "never creates a branch, commits, pushes, or opens an"
        self.assertIn(needle, flat_lower(SKILL_DIR / "SKILL.md"))
        self.assertIn(needle, flat_lower(SKILL_DIR / "commands" / "code-pro-max.md"))
        self.assertTrue((REFERENCES / "mr-generation.md").is_file())

    def test_discovery_writes_no_code(self):
        text = flat_lower(SKILL_DIR / "SKILL.md")
        self.assertIn("do not change code in this phase", text)

    def test_implementation_requires_explicit_approval(self):
        skill = flat_lower(SKILL_DIR / "SKILL.md")
        self.assertIn("approval stays explicit", skill)
        command = flat_lower(SKILL_DIR / "commands" / "code-pro-max.md")
        self.assertIn("explicit approval", command)
        self.assertIn("never implement code changes from this command alone", command)

    def test_ticket_to_prompt_does_not_implement(self):
        self.assertIn("does not implement anything", flat(SKILL_DIR / "SKILL.md"))
        self.assertTrue((REFERENCES / "ticket-to-prompt.md").is_file())

    def test_readme_documents_the_same_boundaries(self):
        text = flat_lower(ROOT / "README.md")
        self.assertIn("read-only", text)
        self.assertIn("approval stays explicit", text)
        self.assertIn("telemetry", text)


class DocumentationConsistencyTest(unittest.TestCase):
    """The root README must not describe workflows the skill does not define."""

    WORKFLOWS = {
        "discover": "Phase 1",
        "select": "Phase 2",
        "plan": "Phase 3",
        "validate": "Phase 4",
        "maintain": "Phase 5",
        "epic-to-dev": "Epic",
        "ticket-to-prompt": "Ticket",
        "onboarding": "Branch",
        "mr": "Merge Request",
    }

    def test_every_readme_workflow_exists_in_the_skill(self):
        skill = flat_lower(SKILL_DIR / "SKILL.md")
        readme = flat_lower(ROOT / "README.md")
        for workflow in self.WORKFLOWS:
            with self.subTest(workflow=workflow):
                if workflow in readme:
                    self.assertIn(
                        workflow, skill, f"README advertises '{workflow}' but SKILL.md omits it"
                    )

    def test_every_reference_file_is_linked_from_the_skill(self):
        skill = SKILL_DIR / "SKILL.md"
        text = skill.read_text(encoding="utf-8")
        for path in sorted(REFERENCES.glob("*.md")):
            with self.subTest(reference=path.name):
                self.assertIn(f"references/{path.name}", text)

    def test_every_template_is_linked_from_the_skill(self):
        text = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
        for path in sorted(TEMPLATES.glob("*.md")):
            with self.subTest(template=path.name):
                self.assertIn(f"templates/{path.name}", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
