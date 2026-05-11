# ADR-031: Enterprise Command Pattern (Undo/Redo)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `core/commands/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `core/commands/`
- **Pattern**: GoF Command Pattern (AutoCAD/Photoshop/Figma)
- **Features**: Serialization, Audit Trail, Persistence, Batch Operations

## Changelog

- **2026-05-11** — `CreateEntityOptions.existingId` added. When set,
  `CreateEntityCommand.execute()` preserves the caller's entity id instead of
  generating a new one. This is the contract `completeEntity()` (ADR-057) uses
  to route drawing-tool completions (line, rectangle, circle, polyline, …)
  through the global command history, giving every freshly drawn entity full
  Ctrl+Z / undo-button support without breaking grip/AI/overlay references
  that depend on the pre-existing id.
