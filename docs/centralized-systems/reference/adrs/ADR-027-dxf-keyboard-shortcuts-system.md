# ADR-027: DXF Keyboard Shortcuts System

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Tools & Keyboard |
| **Canonical Location** | `keyboard-shortcuts.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `keyboard-shortcuts.ts`
- **API**: `matchesShortcut()`, `getShortcutDisplayLabel()`
- **Pattern**: AutoCAD F-key standards

---

## Escape priority chain (canvas)

Defined in `hooks/canvas/useCanvasKeyboardShortcuts.ts`. Each level fires only if its precondition holds; once one level consumes the event, lower levels are skipped.

1. **Rotation cancel** — `rotationIsActive && handleRotationEscape()` (ADR-188)
2. **Grip following cancel** — `dxfGripInteraction.handleGripEscape()` returns `true` if consumed
3. **Always**: `setDraftPolygon([])` + `onExitDrawMode?.()` — idempotent reset of overlay-draw state
4. **Grip selection clear** — `selectedGrips.length > 0 → setSelectedGrips([])`
5. **Entity deselect-all (SSoT)** — `selectedEntityIds.length > 0 → clearEntitySelection()`
   - Single callback wired in `CanvasSection.tsx` that clears BOTH the React `selectedEntityIds` state and `UniversalSelection.clearAll()` — mirrors the `canvas:select-all` event handler.
   - Added 2026-05-11.

## Changelog

| Date | Change |
|------|--------|
| 2026-05-11 | **Esc deselect entities**: extended `useCanvasKeyboardShortcuts` with `clearEntitySelection` param. Selected entities (one or many) clear on Esc through the SSoT clear callback. AutoCAD/BricsCAD parity. |
