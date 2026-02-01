# ADR-131: clampScale Function Centralization (PDF + Zoom)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `clampScale()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `clampScale()`, `clampPdfScale()` from `config/transform-config.ts`
- **Problem**: 2 duplicate `clampScale` implementations with different signatures:
  - `pdf.types.ts:321` - `clampScale(scale: number): number` with hardcoded MIN=0.01, MAX=10
  - `calculations.ts:185` - `clampScale(scale, minScale, maxScale): number` with parameters
- **Solution**: Unified `clampScale()` in transform-config.ts with:
  - Default parameters for Zoom system (0.01 - 1000)
  - `clampPdfScale()` wrapper for PDF-specific limits (0.01 - 10)
- **Files Migrated**:
  - `config/transform-config.ts` - Added `PDF_SCALE_LIMITS`, `clampScale()`, `clampPdfScale()`
  - `pdf-background/types/pdf.types.ts` - Re-exports `clampPdfScale` as `clampScale` for backward compatibility
  - `systems/zoom/utils/calculations.ts` - Re-exports centralized `clampScale`
- **Consumers** (no changes needed - backward compatible):
  - `pdfBackgroundStore.ts` - Uses `clampScale` from pdf.types.ts (lines 188, 210)
  - `ZoomManager.ts` - Uses `clampScale` from calculations.ts (lines 69, 88)
- **Pattern**: Single Source of Truth + Backward Compatibility via re-exports
- **API**:
  - `clampScale(scale, minScale?, maxScale?)`: Generic scale clamping with defaults
  - `clampPdfScale(scale)`: PDF-specific clamping (0.01 - 10)
  - `PDF_SCALE_LIMITS`: Constants { MIN_SCALE: 0.01, MAX_SCALE: 10 }
- **Benefits**:
  - Single source of truth for scale limits
  - PDF and Zoom systems share same core function
  - Backward compatible - no consumer changes needed
  - Consistent with ADR-043 (Zoom Constants) and ADR-071 (Clamp Function)
- **Companion**: ADR-043 (Zoom Constants), ADR-071 (Clamp Function)
