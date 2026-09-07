#!/usr/bin/env python3
"""Packaging validation for the Code Pro Max skill + Claude Code plugin.

Stdlib-only. Verifies that the repository is structurally well-formed and
internally consistent before it is offered for installation or marketplace
submission.

Usage:
    python3 validation/validate.py
    python3 validation/validate.py --strict   # warnings are treated as errors
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL_ROOT = ROOT / "skills"
SKILL_NAME = "code-pro-max"
SKILL_DIR = SKILL_ROOT / SKILL_NAME

errors = []
warnings = []


def fail(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def rel(path):
    try:
        return str(Path(path).relative_to(ROOT))
    except ValueError:
        return str(path)


def load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001 - report any parse problem
        fail(f"{rel(path)}: invalid JSON ({exc})")
        return None


def read_text(path):
    return Path(path).read_text(encoding="utf-8", errors="ignore")


# --------------------------------------------------------------------------
# 1. Structure
# --------------------------------------------------------------------------

REQUIRED_FILES = [
    "README.md",
    "LICENSE",
    "VALIDATION.md",
    "CONTRIBUTING.md",
    ".claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    f"skills/{SKILL_NAME}/SKILL.md",
    f"skills/{SKILL_NAME}/README.md",
    f"skills/{SKILL_NAME}/commands/{SKILL_NAME}.md",
]

REQUIRED_SKILL_DIRS = ["references", "templates", "commands"]


def parse_frontmatter(text):
    """Minimal YAML frontmatter parser (flat key: value pairs only)."""
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    block = text[3:end].strip("\n")
    data = {}
    key = None
    for line in block.splitlines():
        if not line.strip():
            continue
        if re.match(r"^[A-Za-z0-9_-]+\s*:", line):
            key, _, value = line.partition(":")
            key = key.strip()
            data[key] = value.strip().strip('"').strip("'")
        elif key is not None:
            data[key] = (data[key] + " " + line.strip()).strip()
    return data


def check_structure():
    for relpath in REQUIRED_FILES:
        if not (ROOT / relpath).is_file():
            fail(f"Missing required file: {relpath}")

    if not SKILL_DIR.is_dir():
        fail(f"Missing skill directory: skills/{SKILL_NAME}/")
        return

    for sub in REQUIRED_SKILL_DIRS:
        directory = SKILL_DIR / sub
        if not directory.is_dir():
            fail(f"Missing skill subdirectory: skills/{SKILL_NAME}/{sub}/")
        elif not list(directory.glob("*.md*")):
            fail(f"skills/{SKILL_NAME}/{sub}/ contains no markdown files")

    # Exactly one skill should be published from skills/.
    published = [d for d in SKILL_ROOT.iterdir() if d.is_dir() and (d / "SKILL.md").is_file()]
    if len(published) != 1:
        warn(
            "skills/ publishes "
            f"{len(published)} skill(s) ({', '.join(sorted(d.name for d in published))}); "
            "the manifests describe exactly one"
        )


def check_skill_md():
    path = SKILL_DIR / "SKILL.md"
    if not path.is_file():
        return None
    fm = parse_frontmatter(read_text(path))
    if fm is None:
        fail("SKILL.md: missing or malformed YAML frontmatter")
        return None
    name = fm.get("name", "")
    if not name:
        fail("SKILL.md: frontmatter missing required field 'name'")
    elif name != SKILL_NAME:
        fail(f"SKILL.md: frontmatter name '{name}' != expected '{SKILL_NAME}'")
    elif name != name.lower() or not re.match(r"^[a-z0-9][a-z0-9-]*$", name):
        fail(f"SKILL.md: frontmatter name '{name}' is not a valid lowercase slug")
    description = fm.get("description", "")
    if not description:
        fail("SKILL.md: frontmatter missing required field 'description'")
    elif len(description) < 40:
        fail("SKILL.md: frontmatter 'description' is too short to route the skill reliably")
    return fm


# --------------------------------------------------------------------------
# 2. Claude Code plugin manifest
# --------------------------------------------------------------------------

SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")
PLUGIN_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def check_plugin_manifest():
    path = ROOT / ".claude-plugin" / "plugin.json"
    if not path.is_file():
        return None
    plugin = load_json(path)
    if plugin is None:
        return None

    for field in ("name", "version", "description", "author", "license", "homepage", "repository"):
        if not plugin.get(field):
            fail(f"plugin.json: missing required field '{field}'")

    name = plugin.get("name", "")
    if name and not PLUGIN_NAME_RE.match(name):
        fail(f"plugin.json: name '{name}' must be a lowercase slug (a-z, 0-9, '-')")

    version = plugin.get("version", "")
    if version and not SEMVER_RE.match(version):
        fail(f"plugin.json: version '{version}' is not semver (MAJOR.MINOR.PATCH)")

    description = plugin.get("description", "")
    if description and len(description) < 40:
        warn("plugin.json: description is very short for a marketplace listing")

    author = plugin.get("author")
    if isinstance(author, dict) and not author.get("name"):
        fail("plugin.json: author object missing 'name'")

    keywords = plugin.get("keywords", [])
    if not isinstance(keywords, list) or not keywords:
        warn("plugin.json: no keywords set (hurts marketplace discoverability)")

    for command in plugin.get("commands", []) or []:
        target = (ROOT / command.lstrip("./")).resolve()
        if not target.is_file():
            fail(f"plugin.json: command path does not resolve to a file -> {command}")
    return plugin


# --------------------------------------------------------------------------
# 3. Marketplace manifest
# --------------------------------------------------------------------------


def check_marketplace_manifest(plugin):
    path = ROOT / ".claude-plugin" / "marketplace.json"
    if not path.is_file():
        return None
    marketplace = load_json(path)
    if marketplace is None:
        return None

    if not marketplace.get("name"):
        fail("marketplace.json: missing required field 'name'")
    owner = marketplace.get("owner")
    if not isinstance(owner, dict) or not owner.get("name"):
        fail("marketplace.json: missing required 'owner' object with a 'name'")

    entries = marketplace.get("plugins") or []
    if not entries:
        fail("marketplace.json: 'plugins' array is empty or missing")

    for entry in entries:
        entry_name = entry.get("name")
        source = entry.get("source")
        if not entry_name:
            fail("marketplace.json: a plugin entry is missing 'name'")
        if not source:
            fail(f"marketplace.json: plugin entry '{entry_name}' is missing 'source'")
        elif isinstance(source, str) and not source.startswith(("http://", "https://", "git@")):
            resolved = (ROOT / source).resolve()
            if not resolved.is_dir():
                fail(f"marketplace.json: source '{source}' does not resolve to a directory")
            elif not (resolved / ".claude-plugin" / "plugin.json").is_file():
                fail(f"marketplace.json: source '{source}' contains no .claude-plugin/plugin.json")
        if not entry.get("description"):
            warn(f"marketplace.json: plugin entry '{entry_name}' has no description")

    if plugin is not None:
        names = {e.get("name") for e in entries}
        if plugin.get("name") not in names:
            fail(
                f"marketplace.json: no plugin entry matches plugin.json name '{plugin.get('name')}'"
            )
    return marketplace


# --------------------------------------------------------------------------
# 4. Documentation links
# --------------------------------------------------------------------------

LINK_RE = re.compile(r"\]\(([^)\s]+)\)")


def linted_docs():
    docs = [ROOT / "README.md", ROOT / "CONTRIBUTING.md", ROOT / "VALIDATION.md"]
    docs += [ROOT / "RELEASE_NOTES.md"]
    docs += [SKILL_DIR / "SKILL.md", SKILL_DIR / "README.md"]
    docs += sorted((SKILL_DIR / "references").glob("*.md"))
    docs += sorted((SKILL_DIR / "commands").glob("*.md"))
    return [d for d in docs if d.is_file()]


def check_markdown_links():
    # templates/ are deliberately excluded: their links describe the shape of
    # documents the skill will generate later, so their targets do not (and
    # should not) exist in this repository.
    for md_file in linted_docs():
        for match in LINK_RE.finditer(read_text(md_file)):
            target = match.group(1)
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            if "{{" in target or "$" in target:
                continue
            target = target.split("#", 1)[0]
            if not target:
                continue
            resolved = (md_file.parent / target).resolve()
            if not (resolved.is_file() or resolved.is_dir()):
                fail(f"{rel(md_file)}: broken relative link -> {target}")


# --------------------------------------------------------------------------
# 5. Security scan
# --------------------------------------------------------------------------

SECRET_PATTERNS = [
    ("AWS access key id", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("private key block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("GitHub token", re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}")),
    ("OpenAI-style key", re.compile(r"\bsk-[A-Za-z0-9]{24,}")),
    ("Slack token", re.compile(r"xox[abprs]-[A-Za-z0-9-]{10,}")),
    ("Google API key", re.compile(r"AIza[0-9A-Za-z_-]{35}")),
    (
        "assigned credential literal",
        re.compile(
            r"(?i)\b(?:api[_-]?key|secret|password|passwd|token|credential)\b\s*[:=]\s*"
            r"['\"][A-Za-z0-9/+_=-]{16,}['\"]"
        ),
    ),
]

LOCAL_PATH_RE = re.compile(r"(?:/Users/|/home/)[A-Za-z0-9._-]+/|[Cc]:\\\\?Users\\\\?[A-Za-z0-9._-]+")

SCAN_SUFFIXES = {".md", ".mdc", ".json", ".py", ".yml", ".yaml", ".sh", ".toml"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv"}


def scanned_files():
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix not in SCAN_SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts):
            continue
        yield path


def check_security():
    self_path = Path(__file__).resolve()
    for path in scanned_files():
        text = read_text(path)
        if path.resolve() != self_path:
            for label, pattern in SECRET_PATTERNS:
                match = pattern.search(text)
                if match:
                    fail(f"{rel(path)}: possible {label} at offset {match.start()}")
        for line_no, line in enumerate(text.splitlines(), start=1):
            # Documented placeholders like `~/tools/...` are fine; a real
            # machine-specific home directory path is not.
            if path.resolve() == self_path:
                continue
            match = LOCAL_PATH_RE.search(line)
            if match and "/Users/<" not in line and "/home/<" not in line:
                fail(
                    f"{rel(path)}:{line_no}: machine-specific local path "
                    f"'{match.group(0)}' — use a placeholder or ~ instead"
                )


# --------------------------------------------------------------------------
# 6. Cross-file consistency
# --------------------------------------------------------------------------

REPO_URL = "https://github.com/bishoy-bishai/CodeProMax"


def check_consistency(plugin, marketplace, skill_fm):
    if plugin is None:
        return
    version = plugin.get("version", "")
    name = plugin.get("name", "")
    license_id = plugin.get("license", "")

    if skill_fm and name and skill_fm.get("name") and skill_fm["name"] != name:
        fail(
            f"Consistency: SKILL.md name '{skill_fm['name']}' != plugin.json name '{name}'"
        )

    if marketplace and marketplace.get("name") != name:
        warn(
            f"Consistency: marketplace.json name '{marketplace.get('name')}' "
            f"differs from plugin name '{name}'"
        )

    # License must match the LICENSE file.
    license_path = ROOT / "LICENSE"
    if license_path.is_file() and license_id:
        license_text = read_text(license_path)
        first_line = license_text.strip().splitlines()[0] if license_text.strip() else ""
        if license_id.lower() not in first_line.lower():
            fail(
                f"Consistency: plugin.json license '{license_id}' does not match "
                f"LICENSE header '{first_line}'"
            )

    # Version must not be contradicted anywhere in the docs.
    other_versions = set()
    version_re = re.compile(r"(?:^|\s)v?(\d+\.\d+\.\d+)\b")
    for doc in (ROOT / "README.md", ROOT / "VALIDATION.md", ROOT / "RELEASE_NOTES.md"):
        if not doc.is_file():
            continue
        for line in read_text(doc).splitlines():
            if "python" in line.lower() or "node" in line.lower() or "actions/" in line:
                continue
            for found in version_re.findall(line):
                if found != version:
                    other_versions.add((rel(doc), found))
    for doc, found in sorted(other_versions):
        fail(f"Consistency: {doc} mentions version {found} but plugin.json is {version}")

    # Repository URLs agree.
    for field in ("homepage", "repository"):
        value = plugin.get(field, "")
        if value and not value.startswith(REPO_URL):
            warn(f"Consistency: plugin.json {field} '{value}' is not the canonical repo URL")

    readme = read_text(ROOT / "README.md") if (ROOT / "README.md").is_file() else ""
    if readme and version and version not in readme:
        warn(f"Consistency: README.md does not state the current version ({version})")

    # No unverifiable endorsement claims.
    banned = ["anthropic verified", "official anthropic", "officially verified"]
    for doc in linted_docs():
        lowered = read_text(doc).lower()
        for phrase in banned:
            if phrase in lowered:
                fail(f"{rel(doc)}: contains unsupported endorsement claim '{phrase}'")


# --------------------------------------------------------------------------


def main(argv=None):
    parser = argparse.ArgumentParser(description="Validate the Code Pro Max package.")
    parser.add_argument(
        "--strict", action="store_true", help="treat warnings as failures"
    )
    args = parser.parse_args(argv)

    check_structure()
    skill_fm = check_skill_md()
    plugin = check_plugin_manifest()
    marketplace = check_marketplace_manifest(plugin)
    check_markdown_links()
    check_security()
    check_consistency(plugin, marketplace, skill_fm)

    for w in warnings:
        print(f"WARNING: {w}")
    for e in errors:
        print(f"ERROR: {e}")

    failed = bool(errors) or (args.strict and bool(warnings))
    if failed:
        print(f"\nFAILED: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"PASSED: 0 errors, {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
