# ADR-067: FillText Offset Centralization

## Status
✅ **IMPLEMENTED** (2026-02-01)

## Context

Hardcoded offsets σε `fillText()` calls για text positioning διασπαρμένα σε πολλαπλά αρχεία:
- BackgroundPass.ts: axis labels (X, Y, origin)
- OverlayPass.ts: grab cursor icon
- ControlPointDrawer.ts: coordinate text, labels, indicators

Υπήρχαν ήδη κεντρικοποιημένα offsets στο `TEXT_LABEL_OFFSETS` (ADR-091) αλλά δεν χρησιμοποιούνταν σε όλα τα αρχεία.

## Decision

### 1. Επέκταση TEXT_LABEL_OFFSETS

Προσθήκη νέων constants στο `text-rendering-config.ts`:

```typescript
// 🏢 ADR-067: BACKGROUND PASS AXIS LABELS
AXIS_X_LABEL_H_OFFSET: 5,    // X axis horizontal offset
AXIS_X_LABEL_V_OFFSET: -7,   // X axis vertical offset (negative = above)
AXIS_Y_LABEL_V_OFFSET: -20,  // Y axis vertical offset
ORIGIN_LABEL_OFFSET: 5,      // Origin "(0,0)" offset

// 🏢 ADR-067: CONTROL POINT OFFSETS
COORD_TEXT_ABOVE: -12,       // Coordinate text above point
INDICATOR_OFFSET: 4,         // "?" indicator offset
```

### 2. Ενημέρωση BackgroundPass.ts

- Import: `TEXT_LABEL_OFFSETS`, `UI_FONTS`
- Font: `UI_FONTS.ARIAL.LARGE` αντί `'14px Arial'`
- Offsets: Χρήση κεντρικοποιημένων constants

### 3. Ενημέρωση OverlayPass.ts

- Import: `TEXT_LABEL_OFFSETS`
- Grab cursor: `TOOLTIP_HORIZONTAL`, `TOOLTIP_VERTICAL`

### 4. Ενημέρωση ControlPointDrawer.ts

Τοπικά constants (λόγω package boundaries):
```typescript
const CONTROL_POINT_OFFSETS = {
  COORD_TEXT_ABOVE: -12,
  MEASUREMENT_VERTICAL: 20,
  INDICATOR_OFFSET: 4,
};

const CONTROL_POINT_FONTS = {
  SMALL: '10px Arial',
  NORMAL: '12px Arial',
};
```

## Files Changed

| File | Changes |
|------|---------|
| `config/text-rendering-config.ts` | +6 constants in TEXT_LABEL_OFFSETS |
| `rendering/passes/BackgroundPass.ts` | Import + font + offset replacements |
| `rendering/passes/OverlayPass.ts` | Import + offset replacement |
| `packages/core/.../ControlPointDrawer.ts` | Local constants + offset/font replacements |

## Consequences

### Positive
- ✅ Single source of truth για text positioning
- ✅ Consistent spacing across all canvas text
- ✅ Easier maintenance and adjustments
- ✅ Enterprise-grade code quality

### Negative
- ⚠️ ControlPointDrawer uses local copies (package boundary)

## Related ADRs

- **ADR-042**: UI Fonts Centralization
- **ADR-091**: Text Label Offsets Centralization
- **ADR-093**: Text Label Offsets (original)

## Category
Canvas & Rendering
