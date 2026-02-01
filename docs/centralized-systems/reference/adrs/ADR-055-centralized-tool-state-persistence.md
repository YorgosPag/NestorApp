# ADR-055: Centralized Tool State Persistence

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Tools & Keyboard |
| **Canonical Location** | `ToolStateStore.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `ToolStateStore.ts`
- **Pattern**: `useSyncExternalStore` + `allowsContinuous`
