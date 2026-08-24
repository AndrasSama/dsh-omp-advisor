---
name: funnel-dropoff-analysis
description: Equips the advisor to audit funnel definitions, identify abnormal drop-off steps, and prioritize fixes by recoverable volume.
---

# Funnel Drop-Off Analysis

Funnel analysis review checks two things: is the funnel defined honestly (real steps, consistent event definitions, comparable cohorts), and does the drop-off diagnosis point at a fixable cause rather than a shrug?
The biggest review risk is a funnel that measures the team's assumptions instead of the user's actual path.

## Watch for
- Funnel steps that skip real user states (e.g., "signup" without email verification), making drop-off invisible
- Inconsistent event definitions across tools (GA vs product analytics) producing contradictory funnel numbers
- Aggregated funnels that hide segment-specific collapse (mobile vs desktop, paid vs organic)
- No session or time window on multi-step funnels, so re-visits days later count as continuations
- Diagnosis stopping at "50% drop at step 3" with no cause investigation (form fields, errors, load time)
- Mid-funnel entrants counted as drop-offs from step 1
- Fixing the biggest percentage drop instead of the biggest absolute recoverable volume

## Best practices
- Define each step as a single, instrumented event with an agreed schema; document the definition next to the dashboard
- Segment every funnel by device, source, and cohort before drawing conclusions
- Set a sensible conversion window (e.g., 30 minutes for checkout, 7 days for trial flows) and stick to it
- For each high-drop step, triangulate cause: session recordings, form analytics, error rates, page speed
- Prioritize by recoverable volume: users at step × drop rate × downstream value, not drop percentage alone
- Benchmark against your own history first; industry benchmarks are context, not targets
- After a fix, re-measure the same funnel definition — don't quietly redefine steps to look better

## Quick checklist
- [ ] Every step is a single instrumented event with documented definition
- [ ] Funnel segmented by device/source before interpretation
- [ ] Conversion window set and appropriate
- [ ] Top drop-off step has a cause investigation, not just a number
- [ ] Prioritization uses recoverable volume × value
- [ ] Mid-funnel entrants handled, not counted as drop-offs
- [ ] Post-fix measurement uses the unchanged definition
