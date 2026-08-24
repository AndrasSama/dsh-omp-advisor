---
name: microcopy-optimization
description: Equips the advisor to audit buttons, labels, errors, hints, and empty states for clarity, reassurance, and conversion impact.
---

# Microcopy Optimization

Microcopy is the small text doing big jobs: button labels, form hints, error messages, empty states, tooltips, and confirmation lines.
Reviewing it means checking each string for clarity (can the user predict what happens next), reassurance (does it reduce anxiety at risk moments), and voice consistency — tiny strings are disproportionately high-leverage, because a confusing error or vague button directly suppresses conversion.

## Watch for
- Buttons labeled with process words (Submit, OK, Continue) instead of the outcome (Get my report, Start trial)
- Error messages that blame the user or state a code without a fix ("Invalid input", "Error 422")
- Missing inline validation: users discover problems only at submit time
- Empty states that say "No data" without showing the next action to populate it
- Form labels that don't show the expected format (no example for date/phone fields)
- Destructive actions with vague confirmation copy ("Are you sure?" without saying what will be lost)
- Voice whiplash: playful marketing tone followed by robotic system strings

## Best practices
- Label buttons with first-person outcomes: "Start my free trial", "Send the invite" — the label predicts the result
- Write errors as: what happened + why + how to fix it, in plain language, next to the field ("That email looks incomplete — check for the @ symbol")
- Validate inline and early, with specific guidance, not just red borders
- Make empty states an opportunity: show what belongs there and a button to create it ("No projects yet — Start your first one")
- Give format examples inline: "Phone: +1 555 123 4567"
- Confirmation dialogs state the consequence and the undo path where one exists ("Delete 3 files? You can restore from trash for 30 days")
- Keep one voice guide for all system strings; review microcopy in the same PR as the feature

## Quick checklist
- [ ] Buttons state outcomes, not process words
- [ ] Errors say what + why + fix, in plain language
- [ ] Inline validation with specific guidance
- [ ] Empty states include the next action
- [ ] Format examples shown for structured inputs
- [ ] Destructive confirmations state consequences + undo
- [ ] Voice consistent across all system strings
