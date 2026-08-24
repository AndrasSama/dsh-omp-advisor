---
name: mermaid-diagram-syntax
description: Equips the advisor to catch Mermaid diagram syntax errors, renderer version failures, and diagrams that no longer match the system.
---

# Mermaid Diagram Syntax

Mermaid diagrams are code: they have a grammar, version-sensitive features, and failure modes that silently render nothing or the wrong thing.
Reviewing them means checking that the block parses on the target renderer, that labels are quoted where required, and that the picture still matches the system the prose describes.

## Watch for
- Node labels containing reserved characters (parentheses, brackets, quotes, #) that break parsing unless quoted
- flowchart vs graph keyword mismatches and missing direction declarations (LR/TD) on new blocks
- Sequence diagrams with undeclared participants or wrong arrow syntax (->> vs ->)
- Subgraph blocks with mismatched `end` statements, which swallow the rest of the diagram
- Class/entity names in diagrams that do not match the actual code identifiers
- Features gated behind newer mermaid versions than the doc site ships (quadrant charts, sankey, xychart)
- Diagrams so dense they defeat their purpose: 30+ nodes with no clustering

## Best practices
- Quote any label containing special characters: `A["Service (v2)"]` instead of `A[Service (v2)]`
- Declare participants explicitly at the top of every sequenceDiagram
- Validate blocks in CI with mermaid-cli (mmdc) or a lint action so parse errors fail the build
- Keep one diagram per concern; split architecture into component, sequence, and state views
- Sync diagram node names with code identifiers in the same PR that renames them
- Pin or document the mermaid version the docs renderer uses
- Render the diagram and look at it before approving — parsing is not the same as communicating

## Quick checklist
- [ ] Block parses with the repo's mermaid version (mmdc or preview)
- [ ] All special-character labels are quoted
- [ ] Sequence diagrams declare every participant
- [ ] Every subgraph has a matching end
- [ ] Node names match current code identifiers
- [ ] No version-gated syntax for the target renderer
- [ ] Diagram legible at rendered size, clustered by concern
