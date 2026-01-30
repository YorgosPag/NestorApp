# 🎨 **DESIGN TOKENS**

> **Single Source of Truth**: Centralized design tokens for visual consistency
>
> Related ADRs: **ADR-002** (Z-Index), **ADR-004** (Canvas Theme), **ADR-042** (UI Fonts), **ADR-UI-001** (Visual Primitives)

---

## 📋 **ADR-002: Enterprise Z-Index Hierarchy**

**Status**: ✅ APPROVED | **Date**: 2026-01-02

### Problem
Multiple sources of truth for z-index values:
- `globals.css`: `--dropdown-z-index: 75` (conflicting)
- `design-tokens.ts`: `zIndex.dropdown = 1000`
- Components: hardcoded `!z-[9999]`

### Decision

| Rule | Description |
|------|-------------|
| **SOURCE** | `design-tokens.json` → `zIndex` section |
| **GENERATION** | `build-design-tokens.js` creates CSS variables |
| **USAGE** | All components use `var(--z-index-*)` |
| **PROHIBITION** | ❌ Hardcoded z-index values (e.g., `z-[9999]`) |

### Z-Index Hierarchy

| Layer | Value | CSS Variable | Use Case |
|-------|-------|--------------|----------|
| base | 0 | `--z-index-base` | Base content |
| docked | 10 | `--z-index-docked` | Panels, sidebars |
| dropdown | 1000 | `--z-index-dropdown` | Dropdowns, selects |
| sticky | 1100 | `--z-index-sticky` | Sticky headers |
| banner | 1200 | `--z-index-banner` | Notification banners |
| overlay | 1300 | `--z-index-overlay` | Overlays, backdrops |
| modal | 1400 | `--z-index-modal` | Modal dialogs |
| popover | 1500 | `--z-index-popover` | Floating cards |
| skipLink | 1600 | `--z-index-skipLink` | Accessibility links |
| toast | 1700 | `--z-index-toast` | Toast notifications |
| tooltip | 1800 | `--z-index-tooltip` | Tooltips |
| critical | 2147483647 | `--z-index-critical` | System overlays only |

### Implementation

```typescript
// ✅ ENTERPRISE: Use CSS variable
<SelectContent className="[z-index:var(--z-index-dropdown)]">

// ❌ PROHIBITED: Hardcoded z-index
<SelectContent className="!z-[9999]">
```

---

## 📋 **ADR-004: Canvas Theme System**

**Status**: ✅ APPROVED | **Date**: 2026-01-03 | **Level**: 9.5/10 (Figma/AutoCAD/Blender)

### Architecture Flow

```
design-tokens.json → build-design-tokens.js → variables.css → CANVAS_THEME → Components
     (Source)              (Generator)          (Runtime)       (Bridge)      (Usage)
```

### CSS Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `--canvas-background-dxf` | `#000000` | Main DXF canvas (AutoCAD black) |
| `--canvas-background-layer` | `transparent` | Layer overlay canvas |
| `--canvas-background-overlay` | `transparent` | UI overlays |
| `--canvas-themes-autocad-classic` | `#000000` | Theme: AutoCAD Classic |
| `--canvas-themes-autocad-dark` | `#1a1a1a` | Theme: AutoCAD Dark |
| `--canvas-themes-solidworks` | `#2d3748` | Theme: SolidWorks |
| `--canvas-themes-blender` | `#232323` | Theme: Blender |
| `--canvas-themes-light` | `#ffffff` | Theme: Light (print) |

### Implementation

```typescript
// ✅ WORLD-CLASS: Use CANVAS_THEME (CSS Variable backed)
import { CANVAS_THEME } from '../../config/color-config';
backgroundColor: CANVAS_THEME.DXF_CANVAS
// Result: backgroundColor: 'var(--canvas-background-dxf)'

// ✅ RUNTIME THEME SWITCHING (No rebuild needed!)
document.documentElement.style.setProperty(
  '--canvas-background-dxf',
  '#232323' // Blender theme
);

// ❌ PROHIBITED: Hardcoded values
backgroundColor: '#000000'
```

### Capabilities
- ✅ **Runtime Theme Switching** - No rebuild needed
- ✅ **DevTools Live Editing** - Instant preview
- ✅ **User Preferences** - Save/load custom themes
- ✅ **Accessibility** - High contrast mode
- ✅ **Print Mode** - Light theme for printing

---

## 📋 **ADR-042: UI Fonts Centralization**

**Status**: ✅ APPROVED | **Date**: 2027-01-27

### Problem
20+ hardcoded font strings across the codebase:
```typescript
// ❌ SCATTERED
ctx.font = '12px Arial';
ctx.font = 'bold 14px sans-serif';
```

### Decision

| Rule | Description |
|------|-------------|
| **SOURCE** | `UI_FONTS` from `text-rendering-config.ts` |
| **PROHIBITION** | ❌ Hardcoded `ctx.font = '...'` strings |

### Implementation

```typescript
import { UI_FONTS } from '@/subapps/dxf-viewer/config/text-rendering-config';

// ✅ ENTERPRISE: Use centralized fonts
ctx.font = UI_FONTS.CANVAS_LABEL;
ctx.font = UI_FONTS.MEASUREMENT_VALUE;
ctx.font = UI_FONTS.AXIS_LABEL;

// ❌ PROHIBITED
ctx.font = '12px Arial';
```

---

## 📋 **ADR-UI-001: Visual Primitive Ownership**

**Status**: ✅ APPROVED | **Date**: 2026-01-04

### Decision

| Rule | Description |
|------|-------------|
| **SEMANTIC TOKENS** | `quick.*` are official Semantic Design Tokens, NOT convenience helpers |
| **OWNERSHIP** | `useBorderTokens.ts` owns all visual primitives (borders, radius, shadows) |
| **API** | Components use `quick.*` or hooks (`useBorderTokens`, `useSemanticColors`) |
| **PROHIBITION** | ❌ Direct `border-*`, `rounded-*`, `shadow-*` classes |

### Component Pattern

```tsx
// ✅ ENTERPRISE: Use semantic tokens
<div className={`p-4 ${quick.card}`}>

// ✅ ENTERPRISE: Use hooks
const { getStatusBorder } = useBorderTokens();
<div className={`p-4 ${getStatusBorder('success')}`}>

// ❌ PROHIBITED: Direct Tailwind classes
<div className="p-4 border border-gray-200 rounded-lg">
```

---

## 📚 **QUICK REFERENCE**

### Token System Files

| File | Purpose |
|------|---------|
| `design-tokens.json` | Source of truth |
| `scripts/build-design-tokens.js` | CSS variable generator |
| `src/styles/design-system/generated/variables.css` | Runtime CSS |
| `src/styles/design-tokens.ts` | TypeScript bindings |
| `config/color-config.ts` | Canvas theme bridge |
| `config/text-rendering-config.ts` | Font definitions |

### Import Examples

```typescript
// Z-Index
className="[z-index:var(--z-index-modal)]"

// Canvas Theme
import { CANVAS_THEME } from '../../config/color-config';

// UI Fonts
import { UI_FONTS } from '@/subapps/dxf-viewer/config/text-rendering-config';

// Border Tokens
import { useBorderTokens } from '@/hooks';
const { quick, radius, getStatusBorder } = useBorderTokens();

// Semantic Colors
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
const colors = useSemanticColors();
```

---

> **📍 Full Reference**: [centralized_systems.md](../../../src/subapps/dxf-viewer/docs/centralized_systems.md)
>
> **🔄 Last Updated**: 2026-01-31
