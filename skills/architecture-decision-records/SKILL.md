---
name: architecture-decision-records
description: Equips the advisor to review Architecture Decision Records for completeness, decision quality, and lifecycle hygiene.
---

# Architecture Decision Records

An ADR captures a consequential decision with enough context that a future engineer understands why the obvious alternative was rejected.
Reviewing ADRs is not copy-editing: it is checking that the decision is real, the context is honest, and the consequences are not being hidden — a repo full of ADRs that only record conclusions is a liability, not a history.

## Watch for
- ADRs with no rejected alternatives — a decision without options is just a description
- Vague context ("for performance reasons") with no constraint, measurement, or requirement behind it
- Status fields missing or wrong: a superseded decision still marked Accepted
- Consequences sections listing only upsides; downsides and follow-up work omitted
- Decisions recorded after the fact with fabricated deliberation
- One giant ADR bundling several independent decisions that should be split
- ADRs that contradict each other with no supersession link between them

## Best practices
- Use a fixed template (e.g., MADR): Context, Decision, Consequences, Status, date, decision makers
- Number ADRs sequentially and never edit a decided record in place — supersede it with a new one that links back
- Name at least one serious rejected alternative and the specific reason it lost
- State the downsides and the work the decision creates, in writing
- Write the ADR in the same PR that implements the decision, not later
- Keep each ADR to one decision; split when "and" appears in the title
- Review the decision itself, not just the prose: is it reversible, and does the record say so?

## Quick checklist
- [ ] Exactly one decision per record
- [ ] Context names the real constraint or trigger
- [ ] At least one rejected alternative with a reason
- [ ] Consequences include downsides and follow-ups
- [ ] Status field present and current
- [ ] Superseded records link to their replacement
- [ ] ADR lands in the same change as the implementation
