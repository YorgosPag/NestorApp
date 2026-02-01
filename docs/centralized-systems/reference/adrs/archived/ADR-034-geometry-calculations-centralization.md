# ADR-034: Geometry Calculations Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `geometry-utils.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `geometry-utils.ts` (SSOT for polygon calculations)
- **Separation**: Math (geometry-utils) ↔ Rendering (geometry-rendering-utils)
