# ADR-002: Enterprise Z-Index Hierarchy

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Design System |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Source**: `design-tokens.json` → CSS variables
- **Pattern**: `var(--z-index-*)` for all z-index values
- **Prohibited**: Hardcoded z-index (e.g., `z-[9999]`)
