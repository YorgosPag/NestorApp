# ADR-108: Text Metrics Ratios Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-31 |
| **Category** | Data & State |
| **Canonical Location** | `TEXT_METRICS_RATIOS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `TEXT_METRICS_RATIOS` from `config/text-rendering-config.ts`
- **Decision**: Centralize hardcoded font/text metrics multipliers (0.6, 0.75, 0.8, etc.) to named constants
- **Problem**: 27+ hardcoded font/text metrics multipliers across 16 files:
  - `TextMetricsCache.ts`: 5 occurrences (0.6, 0.8, 0.2)
  - `useTextPreviewStyle.ts`: 6 occurrences (0.75, 0.3, 0.2, 0.05, 0.15)
  - `LinePreview.tsx`: 4 occurrences (0.6, 0.55, 1.15, 1.2)
  - `Bounds.ts`: 1 occurrence (0.6)
  - `TextRenderer.ts`: 1 occurrence (0.6)
  - `entities.ts`: 1 occurrence (0.6)
  - `TextSettings.tsx`: 1 occurrence (0.75)
  - `systems/zoom/utils/bounds.ts`: 2 occurrences (0.6, 0.7)
- **Semantic Categories**:
  - **Character Width Estimation**:
    - `CHAR_WIDTH_MONOSPACE`: 0.6 - Average monospace character width (60% of fontSize)
    - `CHAR_WIDTH_PROPORTIONAL`: 0.55 - Average proportional character width (55% of fontSize)
    - `CHAR_WIDTH_WIDE`: 0.7 - Wider estimate for text bounds (70% of fontSize)
  - **Vertical Metrics**:
    - `ASCENT_RATIO`: 0.8 - Ascender height (80% of fontSize)
    - `DESCENT_RATIO`: 0.2 - Descender height (20% of fontSize)
  - **Superscript/Subscript**:
    - `SCRIPT_SIZE_RATIO`: 0.75 - Font size reduction (75% of normal)
    - `SUPERSCRIPT_OFFSET`: 0.3 - Vertical raise (30% of fontSize)
    - `SUBSCRIPT_OFFSET`: 0.2 - Vertical drop (20% of fontSize)
  - **Text Decorations**:
    - `UNDERLINE_OFFSET`: 0.15 - Position below text (15% of fontSize)
    - `STRIKETHROUGH_OFFSET`: 0.05 - Position above baseline (5% of fontSize)
    - `DECORATION_LINE_WIDTH`: 0.05 - Line thickness (5% of fontSize)
  - **Bold/Script Adjustments**:
    - `BOLD_WIDTH_MULTIPLIER`: 1.15 - Bold text width increase (115% of normal)
    - `SCRIPT_SPACING_MULTIPLIER`: 1.2 - Script spacing increase (120% of normal)
- **API**:
  ```typescript
  import { TEXT_METRICS_RATIOS } from '../config/text-rendering-config';

  // Character width estimation
  const width = text.length * fontSize * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;

  // Superscript font size
  const scriptSize = fontSize * TEXT_METRICS_RATIOS.SCRIPT_SIZE_RATIO;

  // Ascent/descent for bounding box
  const ascent = fontSize * TEXT_METRICS_RATIOS.ASCENT_RATIO;
  const descent = fontSize * TEXT_METRICS_RATIOS.DESCENT_RATIO;
  ```
- **Industry Standard**: CSS font-size-adjust, OpenType OS/2 metrics
- **Files Migrated** (9 files, 21 replacements):
  - `rendering/cache/TextMetricsCache.ts` - 5 replacements (ascent, descent, char width)
  - `hooks/useTextPreviewStyle.ts` - 6 replacements (script size, offsets, decorations)
  - `ui/.../LinePreview.tsx` - 4 replacements (char width, bold/script multipliers)
  - `rendering/hitTesting/Bounds.ts` - 1 replacement (char width)
  - `rendering/entities/TextRenderer.ts` - 1 replacement (char width)
  - `types/entities.ts` - 1 replacement (char width)
  - `ui/.../TextSettings.tsx` - 1 replacement (script size)
  - `systems/zoom/utils/bounds.ts` - 2 replacements (char width)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero magic numbers for text metrics calculations
  - Semantic constant names (`CHAR_WIDTH_MONOSPACE` vs `0.6`)
  - Single point of change for typography adjustments
  - Typography-correct documentation (CSS/OpenType reference)
  - Consistent text measurement across all systems
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Grep: `grep -rE "fontSize \* 0\.[0-9]" src/subapps/dxf-viewer --include="*.ts" --include="*.tsx"` (should return minimal results)
- **Companion**: ADR-042 (UI Fonts), ADR-091 (Fonts + Formatting), ADR-107 (UI Size Defaults)
