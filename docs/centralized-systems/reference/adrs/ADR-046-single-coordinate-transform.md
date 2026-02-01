# ADR-046: Single Coordinate Transform

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Pattern**: Pass WORLD coords to `onCanvasClick`
- **Fix**: Double conversion bug causing ~80px X-axis offset
