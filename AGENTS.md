# Agent Instructions (Binding)

This repository uses `Local_Protocol.txt` as the single, binding source of truth for engineering standards and acceptance rules.

## Mandatory startup
- Before doing any work, read `Local_Protocol.txt` and follow it.
- If anything in this file conflicts with `Local_Protocol.txt`, `Local_Protocol.txt` wins.

## Non-negotiables (enforced by Local_Protocol.txt)
- ZERO hardcoded values (design tokens & domain constants/configs must come from centralized systems)
- ZERO `any`
- NO inline styles
- NO duplicates (mandatory repo-wide pre-check before writing code)
- Semantic DOM (no div-soup)
- Security/OWASP checks where relevant
- Quality gates must pass: lint, typecheck, tests, build
- Stop immediately if compliance is not possible; do not proceed without an explicit waiver and remediation plan.

## Working mode
- Prefer small, single-topic diffs.
- Always provide evidence (commands run + results) for quality gates.
