# TEXT RENDERING SYSTEM - AUDIT REPORT

## Executive Summary

**Date:** 2026-01-03
**Status:** AUDIT COMPLETE - CONSOLIDATION REQUIRED
**Severity:** HIGH - Multiple scattered implementations detected

---

## 1. Current State Analysis

### 1.1 Text Renderers Identified

| # | Location | Type | Function/Method | Status |
|---|----------|------|-----------------|--------|
| 1 | `hooks/useTextPreviewStyle.ts` | Universal | `renderStyledTextWithOverride()` | PRIMARY |
| 2 | `rendering/utils/angle-utils.ts` | Direct | `ctx.fillText()` | SCATTERED |
| 3 | `rendering/utils/radius-utils.ts` | Direct | `ctx.fillText()` | SCATTERED |
| 4 | `rendering/utils/render-utils.ts` | Direct | `ctx.fillText()` | SCATTERED |
| 5 | `systems/ruler/RulerRenderer.ts` | Direct | `ctx.fillText()` | SCATTERED |
| 6 | `rendering/canvas/CanvasRenderer.ts` | Method | Multiple text calls | SCATTERED |
| 7 | `components/canvas/layers/TextLayer.tsx` | Component | React-based text | SCATTERED |
| 8 | `rendering/entities/TextEntityRenderer.ts` | Entity | DXF TEXT entities | SCATTERED |
| 9 | `rendering/entities/MTextEntityRenderer.ts` | Entity | DXF MTEXT entities | SCATTERED |
| 10 | `rendering/entities/DimensionRenderer.ts` | Dimension | Dimension text | SCATTERED |
| 11 | `ui/tooltips/CoordinateTooltip.tsx` | UI | Tooltip text | SCATTERED |
| 12 | `ui/overlays/MeasurementOverlay.tsx` | UI | Measurement labels | SCATTERED |
| 13 | `debug/DebugOverlay.ts` | Debug | Debug info text | SCATTERED |
| 14 | `systems/grid/GridTextRenderer.ts` | Grid | Coordinate labels | SCATTERED |
| 15 | `systems/snap/SnapIndicator.ts` | Snap | Snap point labels | SCATTERED |
| 16 | `rendering/annotations/LabelRenderer.ts` | Annotation | Custom labels | SCATTERED |

### 1.2 Critical Findings

#### A. No Single Source of Truth
- **16+ different text rendering implementations** across the codebase
- Each component handles text rendering independently
- No unified typography system for Canvas 2D

#### B. Code Duplication
```typescript
// Pattern repeated in 10+ files:
ctx.font = `${fontSize}px Arial`;
ctx.fillStyle = color;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText(text, x, y);
```

#### C. Inconsistent Styling
- Different font families used across components
- No centralized font size system
- Color handling varies per component

---

## 2. Enterprise Architecture Recommendation

### 2.1 Proposed Solution: TextRenderingService

```
src/subapps/dxf-viewer/
├── services/
│   └── text/
│       ├── TextRenderingService.ts    # Main service
│       ├── TextStyleManager.ts        # Style management
│       ├── FontLoader.ts              # Font loading
│       └── TextMeasurement.ts         # Text measurement utilities
```

### 2.2 Unified TextRenderingService Interface

```typescript
interface TextRenderingService {
  // Core rendering
  renderText(ctx: CanvasRenderingContext2D, text: string, options: TextOptions): void;
  renderMultilineText(ctx: CanvasRenderingContext2D, lines: string[], options: MultilineOptions): void;

  // DXF-specific
  renderDxfText(ctx: CanvasRenderingContext2D, entity: DxfTextEntity, transform: Transform): void;
  renderDxfMText(ctx: CanvasRenderingContext2D, entity: DxfMTextEntity, transform: Transform): void;

  // Measurements
  measureText(text: string, style: TextStyle): TextMetrics;

  // Style management
  getStyle(preset: TextPreset): TextStyle;
  applyStyle(ctx: CanvasRenderingContext2D, style: TextStyle): void;
}

interface TextOptions {
  x: number;
  y: number;
  style: TextStyle;
  transform?: Transform;
  rotation?: number;
}

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: FontWeight;
  color: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  letterSpacing?: number;
  lineHeight?: number;
}

type TextPreset =
  | 'dimension'      // For dimension text
  | 'annotation'     // For annotations
  | 'coordinate'     // For coordinate labels
  | 'measurement'    // For measurement overlays
  | 'debug'          // For debug info
  | 'entity'         // For DXF text entities
  | 'tooltip';       // For tooltips
```

### 2.3 Typography Design Tokens

```typescript
// Προσθήκη στο design-tokens.ts

export const canvasTypography = {
  fontFamilies: {
    primary: 'Inter, Arial, sans-serif',
    mono: 'JetBrains Mono, Consolas, monospace',
    cad: 'Arial, Helvetica, sans-serif'  // CAD standard
  },

  fontSizes: {
    xs: 10,   // Debug, minor labels
    sm: 12,   // Coordinates, small labels
    md: 14,   // Standard text
    lg: 16,   // Important labels
    xl: 18,   // Headers
    xxl: 24   // Major headers
  },

  presets: {
    dimension: {
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fontWeight: 400,
      color: '#1f2937'
    },
    coordinate: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 11,
      fontWeight: 500,
      color: '#6b7280'
    },
    // ... more presets
  }
} as const;
```

---

## 3. Migration Plan

### Phase 1: Create TextRenderingService (Week 1)
1. Create `services/text/TextRenderingService.ts`
2. Implement core rendering methods
3. Add typography design tokens
4. Create text style presets

### Phase 2: Migrate Utility Files (Week 2)
1. `angle-utils.ts` → Use TextRenderingService
2. `radius-utils.ts` → Use TextRenderingService
3. `render-utils.ts` → Use TextRenderingService
4. `RulerRenderer.ts` → Use TextRenderingService

### Phase 3: Migrate Entity Renderers (Week 3)
1. `TextEntityRenderer.ts` → Use TextRenderingService
2. `MTextEntityRenderer.ts` → Use TextRenderingService
3. `DimensionRenderer.ts` → Use TextRenderingService

### Phase 4: Migrate UI Components (Week 4)
1. `CoordinateTooltip.tsx` → Use TextRenderingService
2. `MeasurementOverlay.tsx` → Use TextRenderingService
3. `DebugOverlay.ts` → Use TextRenderingService

### Phase 5: Cleanup & Documentation (Week 5)
1. Remove deprecated text rendering code
2. Update centralized_systems.md
3. Add usage examples

---

## 4. Benefits of Consolidation

### 4.1 Code Quality
- **DRY Principle**: Eliminate 500+ lines of duplicated code
- **Single Source of Truth**: One place for all text rendering logic
- **Maintainability**: Changes in one place affect entire application

### 4.2 Consistency
- **Unified Typography**: Same fonts, sizes, colors everywhere
- **Professional Appearance**: Consistent visual language
- **CAD Standards**: Proper text rendering for technical drawings

### 4.3 Performance
- **Font Caching**: Load fonts once, use everywhere
- **Optimized Rendering**: Batch text operations
- **Memory Efficiency**: Shared style objects

### 4.4 Extensibility
- **Easy Theming**: Change typography globally
- **Localization Ready**: Support for RTL, Unicode
- **Accessibility**: Consistent text sizing

---

## 5. Industry Reference

### AutoCAD Approach
- Single `TextStyle` table for all text styles
- `TEXTSTYLE` command manages all styles
- Consistent rendering across all text entities

### Blender Approach
- Unified `bpy.types.Font` system
- Centralized font management
- Consistent text rendering in 3D viewport

### Figma Approach
- Text styles as reusable components
- Global typography tokens
- Design system integration

---

## 6. Files to Modify

### High Priority (Direct ctx.fillText calls)
1. `src/subapps/dxf-viewer/rendering/utils/angle-utils.ts`
2. `src/subapps/dxf-viewer/rendering/utils/radius-utils.ts`
3. `src/subapps/dxf-viewer/rendering/utils/render-utils.ts`
4. `src/subapps/dxf-viewer/systems/ruler/RulerRenderer.ts`

### Medium Priority (Entity Renderers)
5. `src/subapps/dxf-viewer/rendering/entities/TextEntityRenderer.ts`
6. `src/subapps/dxf-viewer/rendering/entities/MTextEntityRenderer.ts`
7. `src/subapps/dxf-viewer/rendering/entities/DimensionRenderer.ts`

### Low Priority (UI Components)
8. `src/subapps/dxf-viewer/ui/tooltips/CoordinateTooltip.tsx`
9. `src/subapps/dxf-viewer/ui/overlays/MeasurementOverlay.tsx`
10. `src/subapps/dxf-viewer/debug/DebugOverlay.ts`

---

## 7. Current Universal Function

### Location: `hooks/useTextPreviewStyle.ts`

```typescript
export function renderStyledTextWithOverride(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle,
  overrides?: Partial<TextStyle>
): void {
  // ... implementation
}
```

**Status**: This is the closest we have to a unified solution, but it's:
- Located in a hook file (not ideal for a service)
- Not used by all components
- Missing CAD-specific features

---

## 8. Conclusion

### Recommendation: PROCEED WITH CONSOLIDATION

The current scattered implementation violates enterprise coding standards and creates:
- Maintenance burden
- Inconsistent user experience
- Potential bugs from duplicated logic

**A unified TextRenderingService is MANDATORY for enterprise-grade quality.**

---

## 9. References

- `src/subapps/dxf-viewer/docs/centralized_systems.md`
- `src/styles/design-tokens.ts`
- AutoCAD Text Style Documentation
- Canvas 2D Text Rendering Best Practices

---

**Document Created**: 2026-01-03
**Author**: Claude AI (Anthropic)
**Review Status**: PENDING - Awaiting Giorgos approval
