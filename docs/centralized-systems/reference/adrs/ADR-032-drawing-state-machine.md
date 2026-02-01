# ADR-032: Drawing State Machine

| Metadata | Value |
|----------|-------|
| **Status** | COMPLETED |
| **Date** | 2026-01-01 |
| **Category** | Drawing System |
| **Canonical Location** | `core/state-machine/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `core/state-machine/`
- **Pattern**: Formal State Machine (XState patterns)
- **States**: IDLE → TOOL_READY → COLLECTING_POINTS → COMPLETING → COMPLETED
