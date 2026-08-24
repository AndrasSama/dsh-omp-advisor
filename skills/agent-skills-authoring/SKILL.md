---
name: agent-skills-authoring
description: Equips the advisor to detect malformed or low-trigger-quality SKILL.md files — broken frontmatter, vague descriptions, and bodies an agent cannot act on.
---

# Agent Skills Authoring Review

A SKILL.md is a contract between a skill library and an agent's router: the frontmatter decides when the skill loads, and the body decides whether the agent can execute it. Bad frontmatter means the skill never triggers; a vague body means it triggers uselessly. Review both halves with equal strictness.

## Watch for
- `name:` in frontmatter that does not exactly match the directory name (routing keys off the id).
- Missing or multi-sentence `description:` — routers match on one crisp sentence.
- Descriptions that state a topic but not the trigger conditions ("about testing" vs "use when reviewing test suites for X").
- Bodies written as essays instead of instructions an agent can follow step by step.
- Advice that is unactionable: "write good tests", "be careful with errors", no concrete red flags.
- Skills that overlap heavily with a sibling skill, causing ambiguous routing between the two.
- Invented statistics, fake citations, or fabricated tool names used to sound authoritative.
- Bodies that assume context the agent will not have at load time (references to "the file above", prior conversation).

## Best practices
- Keep frontmatter minimal and exact: `name` equals the directory id; `description` is one sentence naming both the capability and the trigger.
- Front-load trigger keywords in the description: the situations, artifacts, and verbs that should activate the skill.
- Structure the body as: short overview, then scannable sections (watch for / best practices / checklist) with concrete bullets.
- Every bullet should be checkable — a reviewer or agent can answer yes/no against real code.
- Keep the whole skill short enough to load cheaply; move deep reference material out of the hot path.
- Differentiate sibling skills explicitly: state what this skill covers that the neighboring one does not.
- Use the imperative voice ("reject unknown keys", "flag missing disposers") so the agent treats lines as commands.
- Test triggering by asking: would a router pick this skill for the exact phrasing a user would actually use?

## Quick checklist
- [ ] `name:` exactly equals the skill directory name.
- [ ] `description:` is one sentence and names the trigger situation.
- [ ] Frontmatter parses as valid YAML with no stray keys.
- [ ] Overview explains the discipline and why it matters in 2–3 sentences.
- [ ] Every bullet is concrete and verifiable against real artifacts.
- [ ] No overlap ambiguity with sibling skills in the same library.
- [ ] No fabricated numbers, citations, or nonexistent APIs.
- [ ] Body stands alone with no dependence on outside conversation context.
