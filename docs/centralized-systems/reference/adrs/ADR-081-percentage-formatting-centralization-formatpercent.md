# ADR-081: Percentage Formatting Centralization (formatPercent)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `formatPercent()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `formatPercent()` from `distance-label-utils.ts`
- **Impact**: 22 inline `Math.round(value * 100)%` implementations → 1 function
- **Problem**: Duplicate percentage formatting patterns scattered across 12 files for:
  - Opacity display (0-1 → 0%-100%)
  - Zoom display (0.5-10 → 50%-1000%)
  - Alpha channel display
- **Solution**: Centralized `formatPercent(value, includeSymbol?)` function
- **API**:
  ```typescript
  formatPercent(value: number, includeSymbol: boolean = true): string
  // formatPercent(0.75)        → "75%"
  // formatPercent(0.75, false) → "75"
  ```
- **Files Migrated**:
  - `distance-label-utils.ts` - Canonical source (ADR-069 companion)
  - `SelectionSettings.tsx` - Window/crossing opacity (4 patterns)
  - `LineSettings.tsx` - Line opacities (3 patterns)
  - `CursorSettings.tsx` - Cursor opacity (1 pattern)
  - `GripSettings.tsx` - Grip opacity (1 pattern)
  - `CurrentSettingsDisplay.tsx` - Summary display (1 pattern)
  - `EnterpriseColorSlider.tsx` - Alpha channel (1 pattern)
  - `ZoomControls.tsx` - Zoom input (2 patterns)
  - `RulerCornerBox.tsx` - Corner zoom (1 pattern)
  - `ToolbarStatusBar.tsx` - Status bar (1 pattern)
  - `PdfControlsPanel.tsx` - Scale & opacity (2 patterns)
  - `usePanelDescription.ts` - Zoom description (1 pattern)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero inline percentage formatting
  - Consistent rounding (Math.round)
  - Optional % symbol for i18n interpolation
  - Companion to formatDistance/formatAngle
- **Companion**: ADR-069 (Number Formatting), ADR-043 (Zoom Constants)
