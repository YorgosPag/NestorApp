# ADR-127: Ruler Dimensions Centralization (DEFAULT_RULER_HEIGHT/WIDTH)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `systems/rulers-grid/config.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Problem**: Hardcoded ruler dimensions (20 vs 30) scattered across 5+ files
- **Root Cause**: No centralized default constants for ruler dimensions
- **Decision**: Add DEFAULT_RULER_HEIGHT/WIDTH to RULERS_GRID_CONFIG
- **Canonical Location**: `systems/rulers-grid/config.ts`
- **Files Updated**:
  - `BackgroundPass.ts` - 20 → centralized (fixed inconsistency)
  - `DxfCanvas.tsx` - 30 → centralized
  - `CanvasSection.tsx` - fallback → centralized
  - `LayerRenderer.ts` - fallback → centralized
- **Pattern**: Single Source of Truth (SSOT)
- **Companion**: ADR-043 (Zoom Constants), ADR-044 (Canvas Line Widths)
