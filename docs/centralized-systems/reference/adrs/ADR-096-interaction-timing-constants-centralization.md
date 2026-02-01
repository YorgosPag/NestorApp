# ADR-096: Interaction Timing Constants Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-31 |
| **Category** | Tools & Keyboard |
| **Canonical Location** | `PANEL_LAYOUT.TIMING` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `PANEL_LAYOUT.TIMING` from `config/panel-tokens.ts`
- **Problem**: CRITICAL CONFLICT - `DOUBLE_CLICK_TIME` (400ms) vs `DOUBLE_CLICK_THRESHOLD` (300ms) in different files
- **Solution**: Centralize all interaction timing to `PANEL_LAYOUT.TIMING`
- **Decision**: Use 300ms as standard (CAD industry: 200-400ms range, 300ms is middle ground)
- **Constants Centralized**:
  - `DOUBLE_CLICK_MS: 300` - Double-click detection window
  - `DRAG_THRESHOLD_PX: 5` - Pixels to move before drag starts
  - `CURSOR_UPDATE_THROTTLE: 50` - Cursor context update throttle (20fps)
  - `SNAP_DETECTION_THROTTLE: 16` - Snap detection throttle (60fps)
- **Files Migrated**:
  - `systems/interaction/InteractionEngine.ts` (2 constants)
  - `systems/cursor/useCentralizedMouseHandlers.ts` (3 constants)
- **Benefits**: Single Source of Truth, consistent UX, no timing conflicts
