---
name: user-journey-mapping
description: Equips the advisor to evaluate whether documentation follows real user journeys instead of internal project structure.
---

# User Journey Mapping

User journey mapping for documentation means organizing content around what readers are trying to accomplish — install, first success, integrate, troubleshoot — rather than around the org chart or the code layout.
Reviewing through this lens catches the most common docs failure: pages that are individually fine but unreachable at the moment a user needs them.

## Watch for
- Navigation organized by internal team or module instead of by user task
- Missing "first success" path: a user can install but cannot find the shortest route to a working result
- Dead ends: pages that finish without a next step, link, or decision pointer
- The same question answered on three pages with three different answers
- Troubleshooting content scattered across feature pages instead of indexed by symptom
- Journey gaps where the docs assume knowledge that is never taught anywhere
- Onboarding that front-loads concepts a user only needs at step five

## Best practices
- Define the top 3–5 journeys explicitly (e.g., new user to first API call) and audit each for continuity
- Every page ends with a next step appropriate to its position in a journey
- Index troubleshooting by error message and symptom, cross-linked from the relevant feature pages
- Teach concepts at the point of use, not in a wall of prerequisites
- Give each journey one canonical answer page; redirect or merge duplicates
- Validate journeys with real traces: support tickets, search queries, and forum questions reveal the actual paths
- Review new pages by asking which journey they serve and where they slot in

## Quick checklist
- [ ] New content names the journey/task it serves
- [ ] A first-success path exists and is reachable in ≤5 clicks
- [ ] Each page ends with a clear next step
- [ ] No duplicate answers to the same question
- [ ] Troubleshooting indexed by symptom/error text
- [ ] Concepts introduced at point of use
- [ ] Navigation labels use user vocabulary, not internal names
