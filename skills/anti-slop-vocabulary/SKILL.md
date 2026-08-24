---
name: anti-slop-vocabulary
description: Equips the advisor to detect AI-generated filler vocabulary and hollow intensifiers that degrade documentation credibility.
---

# Anti-Slop Vocabulary

"Slop" is the tell-tale filler vocabulary of unedited machine-generated prose: grandiose verbs, hollow intensifiers, and throat-clearing openers that carry zero information.
In documentation it actively harms: it buries the fact a reader came for and signals that nobody reviewed the page — a reviewer should flag it on sight and demand the concrete replacement.

## Watch for
- Banned tell-tale words: delve, leverage, utilize, seamless(ly), robust, cutting-edge, state-of-the-art, game-changer, unlock, empower, elevate, streamline, foster, testament, landscape, realm, tapestry
- Throat-clearing openers: "In today's fast-paced world", "It's important to note that", "At the end of the day"
- Hedging stacks: "may potentially help to possibly improve"
- Intensifiers with no measurable claim: very, extremely, incredibly, "blazingly fast" without a number
- Em-dash-heavy sentences and "Not X. Not Y. But Z." staccato patterns used as a substitute for substance
- Marketing adjectives inside technical reference pages: powerful, elegant, lightning-fast
- Vague collective nouns: "various improvements", "several enhancements", "better performance"

## Best practices
- Replace each flagged word with the concrete fact: "leverage caching" → "cache responses for 300 s"
- Delete openers entirely; start the sentence with the subject and verb
- Require a number, command, or observable behavior wherever an intensifier appears
- Keep one canonical plain verb per action (use, run, configure) and reuse it consistently
- Apply the deletion test: if removing a phrase changes nothing, remove it
- Allow personality in tutorials and blog posts, but keep reference pages austere
- Flag patterns, not single occurrences: three "seamless" on one page is a systemic failure, not a typo

## Quick checklist
- [ ] Zero occurrences of the banned tell-tale list in the diff
- [ ] No sentence begins with a throat-clearing clause
- [ ] Every performance or scale claim carries a number
- [ ] One plain verb per repeated action
- [ ] No hedging stacks (at most one modal per claim)
- [ ] Reference pages contain no marketing adjectives
- [ ] Removing any flagged phrase would lose real information
