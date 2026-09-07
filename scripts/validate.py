#!/usr/bin/env python3
"""Structural validation for the Code Pro Max skill + plugin package.

Stdlib-only. Checks: required files exist, SKILL.md frontmatter is valid,
plugin.json / marketplace.json are valid JSON with required fields and
consistent versions/names, relative markdown links resolve, and no obvious
secrets or machine-specific local paths have crept into tracked files.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL_DIR = ROOT / "skills" / "code-pro-max"

errors = []
warnings = []


def fail(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def check_required_files():
    required = [
        SKILL_DIR / "SKILL.md",
        SKILL_DIR / "README.md",
        ROOT / ".claude-plugin" / "plugin.json",
        ROOT / ".claude-plugin" / "marketplace.json",
        ROOT / "LICENSE",
        ROOT / "README.md",
    ]
    for path in required:
        if not path.is_file():
            fail(f"Missing required file: {path.relative_to(ROOT)}")


def parse_frontmatter(text):
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    block = text[3:end].strip("\n")
    data = {}
    for line in block.splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        data[key.strip()] = value.strip().strip('"')
    return data


def check_skill_md():
    path = SKILL_DIR / "SKILL.md"
    if not path.is_file():
        return
    text = path.read_text(encoding="utf-8")
    fm = parse_frontmatter(text)
    if fm is None:
        fail("SKILL.md: missing or malformed YAML frontmatter")
        return
    if "name" not in fm or not fm["name"]:
        fail("SKILL.md: frontmatter missing 'name'")
    elif fm["name"] != "code-pro-max":
        warn(f"SKILL.md: frontmatter name '{fm['name']}' != expected 'code-pro-max'")
    if "description" not in fm or len(fm.get("description", "")) < 20:
        fail("SKILL.md: frontmatter 'description' missing or too short to be useful")


def load_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)}: invalid JSON ({exc})")
        return None


def check_manifests():
    plugin_path = ROOT / ".claude-plugin" / "plugin.json"
    marketplace_path = ROOT / ".claude-plugin" / "marketplace.json"
    plugin = load_json(plugin_path) if plugin_path.is_file() else None
    marketplace = load_json(marketplace_path) if marketplace_path.is_file() else None

    if plugin is not None:
        for field in ("name", "version", "description", "author", "license"):
            if field not in plugin:
                fail(f"plugin.json: missing required field '{field}'")
        if "version" in plugin and not re.match(r"^\d+\.\d+\.\d+$", plugin["version"]):
            fail(f"plugin.json: version '{plugin.get('version')}' is not semver")
        if plugin.get("name") and plugin["name"] != plugin["name"].lower():
            fail("plugin.json: name must be lowercase")

    if marketplace is not None:
        entries = marketplace.get("plugins", [])
        if not entries:
            fail("marketplace.json: 'plugins' array is empty or missing")
        for entry in entries:
            if "name" not in entry or "source" not in entry:
                fail("marketplace.json: plugin entry missing 'name' or 'source'")
            if plugin is not None and entry.get("name") == plugin.get("name"):
                pass
        names = {e.get("name") for e in entries}
        if plugin is not None and plugin.get("name") not in names:
            fail("marketplace.json: no plugin entry matches plugin.json's name")


def check_markdown_links():
    # templates/ contain placeholder links describing the shape of *generated*
    # documents (e.g. a future ticket linking to a future epic) - those targets
    # don't exist in this repo by design, so only lint the skill's own docs.
    link_re = re.compile(r"\]\(([^)\s]+\.md)\)")
    doc_files = [SKILL_DIR / "SKILL.md", SKILL_DIR / "README.md"]
    doc_files += list((SKILL_DIR / "references").glob("*.md"))
    for md_file in doc_files:
        if not md_file.is_file():
            continue
        text = md_file.read_text(encoding="utf-8", errors="ignore")
        for match in link_re.finditer(text):
            target = match.group(1)
            if target.startswith("http://") or target.startswith("https://"):
                continue
            if "{{" in target:
                continue
            resolved = (md_file.parent / target).resolve()
            if not resolved.is_file():
                fail(f"{md_file.relative_to(ROOT)}: broken relative link -> {target}")


SECRET_PATTERNS = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----"),
    re.compile(r"ghp_[A-Za-z0-9]{36}"),
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
]
LOCAL_PATH_RE = re.compile(r"/Users/[A-Za-z0-9_.-]+|/home/[A-Za-z0-9_.-]+|C:\\\\Users\\\\")


def check_secrets_and_paths():
    for md_file in list(SKILL_DIR.rglob("*.md")) + [ROOT / "README.md", ROOT / "CONTRIBUTING.md"]:
        if not md_file.is_file():
            continue
        text = md_file.read_text(encoding="utf-8", errors="ignore")
        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                fail(f"{md_file.relative_to(ROOT)}: matches secret-like pattern {pattern.pattern}")
        if LOCAL_PATH_RE.search(text):
            fail(f"{md_file.relative_to(ROOT)}: contains a machine-specific local filesystem path")


def check_version_consistency():
    plugin_path = ROOT / ".claude-plugin" / "plugin.json"
    if not plugin_path.is_file():
        return
    plugin = load_json(plugin_path)
    if plugin is None:
        return
    version = plugin.get("version")
    readme = (ROOT / "README.md").read_text(encoding="utf-8", errors="ignore")
    if version and version not in readme:
        warn(f"README.md does not mention current version {version} (not required, informational)")


def main():
    check_required_files()
    check_skill_md()
    check_manifests()
    check_markdown_links()
    check_secrets_and_paths()
    check_version_consistency()

    for w in warnings:
        print(f"WARNING: {w}")
    for e in errors:
        print(f"ERROR: {e}")

    if errors:
        print(f"\nFAILED: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"PASSED: 0 errors, {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
