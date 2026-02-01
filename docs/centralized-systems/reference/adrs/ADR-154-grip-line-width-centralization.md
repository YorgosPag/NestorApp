# ADR-154: Grip Line Width Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `RENDER_LINE_WIDTHS.GRIP_OUTLINE_ACTIVE` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `RENDER_LINE_WIDTHS.GRIP_OUTLINE_ACTIVE` from `config/text-rendering-config.ts`
- **Decision**: Centralize grip outline line width for active state (warm/hot) to single source of truth
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Duplicate hardcoded `gripState !== 'cold' ? 2 : 1` pattern in 2 places:
  - `canvas-v2/layer-canvas/LayerRenderer.ts:650` - Vertex grip outlines
  - `canvas-v2/layer-canvas/LayerRenderer.ts:738` - Edge midpoint grip outlines
  - Inconsistency: Lines 660, 669, 753, 781 use `RENDER_LINE_WIDTHS.NORMAL` but grip outlines were hardcoded
  - Existing constant `GRIP_OUTLINE: 1` only covered cold state
- **Solution**: Add `GRIP_OUTLINE_ACTIVE: 2` to existing `RENDER_LINE_WIDTHS` constant:
  ```typescript
  // config/text-rendering-config.ts
  export const RENDER_LINE_WIDTHS = {
    /** Grip point outlines (cold/normal state) */
    GRIP_OUTLINE: 1,

    /** 🏢 ADR-154: Grip point outlines (warm/hot/active state) */
    GRIP_OUTLINE_ACTIVE: 2,
    // ...
  };
  ```
- **Files Migrated** (1 file, 2 locations):
  - `canvas-v2/layer-canvas/LayerRenderer.ts`:
    - Vertex grips (line ~650):
      - Before: `this.ctx.lineWidth = gripState !== 'cold' ? 2 : 1;`
      - After: `this.ctx.lineWidth = gripState !== 'cold' ? RENDER_LINE_WIDTHS.GRIP_OUTLINE_ACTIVE : RENDER_LINE_WIDTHS.GRIP_OUTLINE;`
    - Edge midpoint grips (line ~738):
      - Before: `this.ctx.lineWidth = gripState !== 'cold' ? 2 : 1;`
      - After: `this.ctx.lineWidth = gripState !== 'cold' ? RENDER_LINE_WIDTHS.GRIP_OUTLINE_ACTIVE : RENDER_LINE_WIDTHS.GRIP_OUTLINE;`
- **Pattern**: Single Source of Truth (SSOT) in text-rendering-config.ts
- **Benefits**:
  - Complete grip outline width centralization (cold + active states)
  - Consistent with other line width constants in the same file
  - Easy to adjust grip visual feedback globally
  - Follows established rendering constants pattern (ADR-044)
- **Companion**: ADR-044 (Canvas Line Widths), ADR-075 (Grip Size Multipliers), ADR-106 (Edge Grip Multipliers)
