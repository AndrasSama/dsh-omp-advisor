---
name: markdown-linting-rules
description: Equips the advisor to enforce markdownlint-style rules so documentation renders consistently across tools and stays diff-friendly.
---

# Markdown Linting Rules

Markdown linting keeps a docs corpus mechanically consistent: heading hygiene, list style, code fences, and line structure that survive rendering in GitHub, doc sites, and IDE previews alike.
A reviewer should treat lint violations as signals — most of them predict a real rendering bug or a hostile diff, not just a style preference.

## Watch for
- Heading level skips (H1 → H3) that break outline-based navigation and TOC generation
- Multiple H1s in one file, or an H1 that duplicates the frontmatter title
- Fenced code blocks without a language identifier (breaks highlighting and some doc pipelines)
- Inconsistent list markers (- vs * vs +) or mixed indentation that flips list nesting
- Bare URLs instead of proper links, and angle-bracket links that render differently per parser
- Trailing whitespace and hard-wrapped lines that make diffs noisy (decide the MD013 line-length policy explicitly)
- Tables with misaligned column counts that silently break rendering

## Best practices
- Run markdownlint (or markdownlint-cli2) in CI with a committed .markdownlint.json so rules are explicit, not tribal
- One H1 per file; headings increment by exactly one level
- Require a language on every fence; use `text` for intentionally unhighlighted output
- Pick one list marker and one emphasis style and enforce them repo-wide
- Set a deliberate line-length policy: wrap at 80 for diff-friendly prose, or disable MD013 and rely on semantic line breaks
- Fix lint at the source in the same PR; never merge with inline overrides unless the rule is wrong for the repo
- Keep frontmatter valid YAML and lint it in the same pipeline

## Quick checklist
- [ ] markdownlint passes with the repo config; no inline disables in the diff
- [ ] Single H1; no skipped heading levels
- [ ] Every code fence has a language tag
- [ ] List markers and indentation consistent
- [ ] All URLs are proper markdown links
- [ ] Table column counts align on every row
- [ ] Frontmatter parses as valid YAML
