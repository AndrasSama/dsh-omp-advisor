---
name: wcag-accessibility-audit
description: Equips the advisor to detect common WCAG 2.1/2.2 AA failures in agent-built interfaces and to demand a credible mix of automated and manual accessibility testing.
---

# WCAG Accessibility Audit

Accessibility is a functional requirement, not polish: interfaces that fail keyboard users, screen readers, or low-vision users exclude real people and carry growing legal exposure, including the European Accessibility Act applying from June 2025 to covered e-commerce and digital services. This skill reviews work against common WCAG 2.1/2.2 AA failure modes. Findings are review flags; whether a product is in scope is a legal determination.

## Watch for
- Insufficient color contrast on text, icons, and focus indicators.
- Keyboard traps: focus enters a component and cannot leave, or interactive elements unreachable by keyboard.
- Missing or meaningless alt text on informative images; decorative images not marked as such.
- Form inputs without programmatically associated labels; errors not announced.
- Custom widgets (menus, dialogs, tabs) lacking correct roles, states, and focus management.
- Meaning conveyed by color or shape alone.
- Missing skip links, illogical heading order, or broken reading order.
- "Automated scan passed" presented as a complete accessibility assessment.

## Best practices
- Treat automated scans as a floor, not a finish line: they catch only a fraction of WCAG failures; require manual keyboard and screen-reader passes.
- Test the critical paths — search, product page, checkout, account, support — entirely by keyboard.
- Verify focus is always visible and moves in logical order through every new component.
- Require accessible names on all interactive controls, checked in the accessibility tree, not just visually.
- Check reflow and zoom: content must remain usable at 200% zoom and narrow viewports.
- For multimedia, verify captions and transcripts actually exist, not just the player.
- Document evidence: what was tested, with which tools, by whom.
- Keep EAA 2025 scope awareness: flag coverage questions for counsel instead of deciding them.

## Quick checklist
- [ ] Text contrast meets AA thresholds (measured, not eyeballed).
- [ ] All functionality reachable and operable by keyboard, no traps.
- [ ] Informative images have meaningful alt text.
- [ ] Every form field has an associated label and announced errors.
- [ ] Custom widgets expose correct roles, states, and focus management.
- [ ] No meaning conveyed by color alone.
- [ ] Manual screen-reader pass performed on key flows.
- [ ] Automated scan results paired with manual test evidence.
