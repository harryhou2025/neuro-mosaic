#!/usr/bin/env python3
"""
Lightweight validator for this skill directory.

Why: the upstream skill-creator quick_validate.py requires PyYAML, which may not
be available in minimal Python environments.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from typing import Dict, List, Tuple


def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _parse_frontmatter(skill_md: str) -> Tuple[Dict[str, str], List[str]]:
    lines = skill_md.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, ["SKILL.md missing YAML frontmatter start '---' on first line"]
    try:
        end_idx = lines[1:].index("---") + 1
    except ValueError:
        return {}, ["SKILL.md missing YAML frontmatter end '---'"]

    fm_lines = lines[1:end_idx]
    kv: Dict[str, str] = {}
    errors: List[str] = []
    for ln in fm_lines:
        if not ln.strip():
            continue
        m = re.match(r"^([a-zA-Z0-9_-]+):\s*(.*)$", ln)
        if not m:
            errors.append(f"Unrecognized frontmatter line: {ln!r}")
            continue
        key, val = m.group(1), m.group(2)
        kv[key] = val.strip()
    return kv, errors


def _parse_openai_yaml(openai_yaml: str) -> Dict[str, str]:
    # Not a full YAML parser. Good enough for a small, known file shape.
    out: Dict[str, str] = {}
    for ln in openai_yaml.splitlines():
        m = re.match(r"^\s*([a-zA-Z0-9_]+):\s*\"(.*)\"\s*$", ln)
        if m:
            out[m.group(1)] = m.group(2)
    return out


def main(argv: List[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Validate neuro-lit-search skill files.")
    p.add_argument("skill_dir", nargs="?", default=".", help="Path to skill directory")
    args = p.parse_args(argv)

    skill_dir = os.path.abspath(args.skill_dir)
    expected_name = os.path.basename(skill_dir)

    ok = True

    skill_md_path = os.path.join(skill_dir, "SKILL.md")
    if not os.path.exists(skill_md_path):
        print(f"[FAIL] Missing: {skill_md_path}", file=sys.stderr)
        return 2

    fm, fm_errs = _parse_frontmatter(_read_text(skill_md_path))
    for e in fm_errs:
        ok = False
        print(f"[FAIL] {e}", file=sys.stderr)

    if set(fm.keys()) != {"name", "description"}:
        ok = False
        print(
            f"[FAIL] Frontmatter must contain only 'name' and 'description' keys (got: {sorted(fm.keys())})",
            file=sys.stderr,
        )
    if fm.get("name") != expected_name:
        ok = False
        print(
            f"[FAIL] Frontmatter name must match directory name: {expected_name!r} (got: {fm.get('name')!r})",
            file=sys.stderr,
        )
    if not (fm.get("description") or "").strip():
        ok = False
        print("[FAIL] Frontmatter description must be non-empty", file=sys.stderr)

    openai_path = os.path.join(skill_dir, "agents", "openai.yaml")
    if not os.path.exists(openai_path):
        ok = False
        print(f"[FAIL] Missing: {openai_path}", file=sys.stderr)
    else:
        data = _parse_openai_yaml(_read_text(openai_path))
        sd = data.get("short_description", "")
        dp = data.get("default_prompt", "")
        if not (25 <= len(sd) <= 64):
            ok = False
            print(
                f"[FAIL] agents/openai.yaml short_description length must be 25-64 (got {len(sd)})",
                file=sys.stderr,
            )
        if f"${expected_name}" not in dp:
            ok = False
            print(
                f"[FAIL] agents/openai.yaml default_prompt must mention ${expected_name}",
                file=sys.stderr,
            )

    if ok:
        print("[OK] Skill looks valid.", file=sys.stderr)
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

