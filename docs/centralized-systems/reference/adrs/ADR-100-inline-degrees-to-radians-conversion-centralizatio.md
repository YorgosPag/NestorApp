# ADR-100: Inline Degrees-to-Radians Conversion Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-31 |
| **Category** | Data & State |
| **Canonical Location** | `degToRad()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `degToRad()` from `geometry-utils.ts` (extends ADR-067)
- **Decision**: Migrate remaining 5 inline `Math.PI / 180` patterns to centralized `degToRad()` function
- **Problem**: After ADR-067, 5 inline patterns remained in 2 files:
  - `PreviewRenderer.ts`: 4 patterns (`(entity.startAngle * Math.PI) / 180`)
    - Lines 541-542: Arc preview start/end radians
    - Lines 564-565: Radial construction line angle calculation
  - `FormatterRegistry.ts`: 1 pattern (`degrees * (Math.PI / 180)`)
    - Line 537: `formatRadians()` method
- **Solution**: Simple import of existing `degToRad()` function
- **Files Changed** (2 files, 5 replacements):
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - 4 replacements (added `degToRad` to imports)
  - `formatting/FormatterRegistry.ts` - 1 replacement (added import + replaced inline calc)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero remaining inline `Math.PI / 180` patterns in DXF Viewer
  - Consistent with ADR-067 architecture
  - Single point of change for conversion precision
  - Cleaner, more readable code
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Grep: `grep -rE "Math\.PI.*180|180.*Math\.PI" src/subapps/dxf-viewer --include="*.ts" --include="*.tsx"` (should return only geometry-utils.ts)
- **Companion**: ADR-067 (Radians/Degrees), ADR-058 (Canvas Primitives), ADR-082 (FormatterRegistry)
