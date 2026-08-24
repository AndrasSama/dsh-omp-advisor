---
name: dsh-doc-standards
description: Equips the advisor to evaluate documentation against a consistent house standard covering structure, voice, code samples, and terminology.
---

# Documentation Standards

A documentation standard is the contract every page must honor before it ships: predictable structure, consistent voice, verified code samples, and controlled terminology.
When reviewing docs, the standard is what separates "reads fine" from "maintainable at scale" — drift in any one dimension compounds across a whole knowledge base.

## Watch for
- Pages that mix Diátaxis modes: a tutorial drifting into reference tables, or an explanation smuggling in step-by-step instructions
- Code samples without a language tag on the fence, or samples that cannot be copy-pasted and run as written
- Inconsistent terminology for the same concept (e.g., "workspace" vs "project" vs "session" used interchangeably)
- Missing or stale frontmatter (title, description) that breaks search indexing and link previews
- Second-person instructions ("you") mixed with impersonal description inside the same procedural section
- Dead links, or links pointing at source files instead of the rendered doc page
- Version-specific instructions that never state which version they apply to

## Best practices
- Classify every page as tutorial, how-to guide, reference, or explanation (Diátaxis) and enforce the matching structure
- Keep one canonical term per concept in a glossary; flag synonyms during review
- Require every code block to be tested or explicitly marked as pseudocode
- Front-load the page purpose: the first sentence states what the reader can do or learn
- Use sentence case for headings and imperative mood for procedural steps
- Put prerequisites, inputs, and expected outputs at the top of every how-to
- Review the diff, not the whole page: check what changed and whether the change keeps the page in its declared mode

## Quick checklist
- [ ] Page type (tutorial/how-to/reference/explanation) identifiable within the first lines
- [ ] One term per concept; no synonym drift in the diff
- [ ] Every code fence has a language and matches the current API
- [ ] Headings in sentence case, nesting without skipped levels
- [ ] Prerequisites stated before the first step
- [ ] No dead or version-ambiguous links
- [ ] Changed steps still read as numbered imperatives
