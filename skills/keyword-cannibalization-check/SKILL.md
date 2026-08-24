---
name: keyword-cannibalization-check
description: Equips the advisor to detect multiple pages competing for the same keyword and prescribe consolidation or differentiation.
---

# Keyword Cannibalization Checks

Cannibalization happens when two or more pages on the same site target the same keyword and intent, so search engines alternate between them and both underperform.
Reviewing new content means checking it against the existing index before publication: does this page earn its own keyword, or does it split an existing page's rankings?

## Watch for
- New pages whose target keyword matches an existing page's primary keyword at the same intent
- Multiple blog posts answering the same question with slightly different phrasings
- Category/product pages and blog posts both optimized for the same commercial keyword
- Near-duplicate title tags and H1s across URLs
- Internal links using the same anchor text pointing at different pages for the same topic
- Ranking volatility: a keyword flipping between two URLs week to week (the diagnostic signature)
- Tag/archive pages unintentionally ranking and competing with canonical content

## Best practices
- Before publishing, search the site (site:domain.com + keyword) and the keyword map for an existing owner of that keyword
- Maintain a keyword-to-URL ownership map; every new piece gets a unique primary keyword assignment
- When overlap is found, choose: merge into the stronger page, differentiate intent (informational vs transactional), or re-target the new piece to a distinct subquery
- Use canonical tags for true duplicates, 301 redirects for merged pages, and re-optimization for demoted ones
- Vary internal anchor text so links don't send mixed relevance signals
- Check Search Console for queries where multiple URLs alternate impressions — that is the cannibalization report
- After a fix, monitor for 4–8 weeks before judging; ranking consolidation takes time

## Quick checklist
- [ ] New page's primary keyword has no existing owner on the site
- [ ] Title tag and H1 unique across the index
- [ ] Intent distinct from any similar page (or merged)
- [ ] site: search run for the target keyword pre-publication
- [ ] Internal anchors varied, not all pointing at one URL
- [ ] Search Console checked for alternating-URL queries
- [ ] Consolidation fixes given time to show effect
