---
name: test-coverage-enforcement
description: Equips the advisor to detect weak or vanity test coverage — untested error paths, threshold gaming, and coverage that measures execution instead of behavior.
---

# Test Coverage Enforcement Review

Coverage is a signal, not a goal: it shows which code no test ever touches, but high line coverage can coexist with zero meaningful assertions. Reviewers enforce coverage thresholds while distinguishing real behavioral coverage from coverage that only proves a line ran. The highest-value coverage is usually the error paths.

## Watch for
- Error/catch branches and failure returns with no test exercising them.
- Coverage achieved by calling a function with no assertions on the result.
- Thresholds set so low they never trip, or raised without a plan to close gaps.
- Newly added code merged with lower coverage than the surrounding module.
- Tests that assert only truthiness or "did not throw" instead of real outcomes.
- Critical paths (persistence, permissions, RPC boundaries) below the project threshold.
- Coverage exclusions (`ignore` comments) hiding genuinely risky code.
- Snapshot-only tests that lock behavior without verifying it.

## Best practices
- Set and enforce a meaningful coverage threshold and require new code to meet or exceed it.
- Prioritize covering error paths, edge cases, and boundary code first, not just happy lines.
- Require assertions on observable outcomes, not merely that code executed.
- Treat coverage drops in a diff as a review blocker for the touched module.
- Hold critical paths (security, persistence, RPC) to a higher bar than average code.
- Review every coverage exclusion; each must name a real reason, not convenience.
- Combine coverage with mutation or behavior checks to catch assertion-free tests.
- Report coverage trends per module so slow erosion is visible over time.

## Quick checklist
- [ ] Error and catch branches have dedicated tests.
- [ ] Tests assert real outcomes, not just execution.
- [ ] Coverage threshold is meaningful and enforced.
- [ ] New code meets or exceeds the module's coverage.
- [ ] Critical paths are held to a higher threshold.
- [ ] Every coverage exclusion is justified and reviewed.
- [ ] Assertion quality is checked, not just line execution.
- [ ] Per-module coverage trend is monitored.
