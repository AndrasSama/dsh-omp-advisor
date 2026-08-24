---
name: xss-sanitization-rules
description: Equips the advisor to find XSS sinks — innerHTML, framework escape hatches, scriptable URLs — and verify context-correct output encoding.
---

# XSS Sanitization Rules

XSS review is sink-hunting: find every place untrusted data enters the DOM, an attribute, a URL, or a script context, and verify the encoding or sanitization matches that exact context.
Framework auto-escaping covers the default path, so the review concentrates on the deliberate escape hatches and the contexts (attributes, URLs, CSS, event handlers) where generic escaping is wrong.

## Watch for
- Direct DOM sinks: innerHTML, outerHTML, document.write, insertAdjacentHTML with non-constant data
- Framework escape hatches: React dangerouslySetInnerHTML, Vue v-html, Angular [innerHTML], Svelte {@html}
- URL sinks without protocol validation: href/src built from user input allowing javascript:, data:, vbscript:
- Attribute-context injection: user data placed into onclick, style, or arbitrary attributes with HTML-style escaping only
- Server templates with autoescape disabled ({% autoescape off %}, triple-stache Mustache, |safe filters)
- postMessage handlers accepting messages from any origin and writing them to the DOM
- Client-side template engines or markdown renderers with raw HTML enabled

## Best practices
- Default to framework auto-escaping; every escape-hatch use must be justified in review and paired with a sanitizer
- Sanitize rich HTML with DOMPurify (or server-side sanitize-html) immediately before insertion, with an explicit tag/attribute allowlist
- Validate and normalize URLs: allowlist http/https/mailto, reject scriptable schemes, including after entity decoding
- Encode per context: HTML body, HTML attribute, JavaScript string, and CSS each need different encoders — use a context-aware library
- Set a strict CSP (no unsafe-inline; nonces or hashes for scripts) as defense in depth, and collect violation reports
- Sanitize on output, not only on input — stored data may be rendered in multiple contexts
- Verify postMessage origins and never pass message data to DOM sinks without validation

## Quick checklist
- [ ] No innerHTML/document.write with untrusted data in the diff
- [ ] Every dangerouslySetInnerHTML/v-html paired with DOMPurify or equivalent
- [ ] User-derived URLs scheme-validated (no javascript:/data:)
- [ ] Template autoescape not disabled without a sanitizer
- [ ] Context-correct encoding for attributes/JS/CSS
- [ ] CSP present without unsafe-inline
- [ ] postMessage origins checked before DOM use
