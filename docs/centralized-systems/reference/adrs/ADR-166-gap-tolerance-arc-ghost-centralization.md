# ADR-166: GAP_TOLERANCE, ARC_TESSELLATION & Ghost Colors Centralization

## Status
**IMPLEMENTED** - 2026-02-01

## Context

During code review, scattered hardcoded constants were identified in two files:

### 1. GeometryUtils.ts (line 24-29)
```typescript
export const GEOMETRY_CONSTANTS = {
  EPS: GEOMETRY_PRECISION.ENTITY_GAP, // Already centralized
  GAP_TOLERANCE: 0.5,       // HARDCODED
  DEFAULT_ARC_SEGMENTS: 24  // HARDCODED
};
```

### 2. ghost-entity-renderer.ts (line 58-83)
```typescript
export const GHOST_RENDER_CONFIG = {
  GHOST_FILL: 'rgba(0, 120, 255, 0.15)',     // HARDCODED
  GHOST_STROKE: 'rgba(0, 120, 255, 0.6)',    // HARDCODED
  DELTA_LINE_COLOR: 'rgba(255, 165, 0, 0.8)', // HARDCODED
  READOUT_COLOR: 'rgba(0, 0, 0, 0.8)',        // HARDCODED
  READOUT_BG: 'rgba(255, 255, 255, 0.9)',     // HARDCODED
  SIMPLIFIED_BOX_COLOR: 'rgba(0, 120, 255, 0.3)', // HARDCODED
  // ...rest already centralized
};
```

## Decision

Centralize all hardcoded constants:

### 1. Tolerance Config (`config/tolerance-config.ts`)

Added `GAP_TOLERANCE` to existing `ENTITY_LIMITS`:
```typescript
export const ENTITY_LIMITS = {
  MIN_SIZE: 0.001,
  CONSTRAINT_TOLERANCE: 0.001,
  GAP_TOLERANCE: 0.5, // NEW - ADR-166
} as const;
```

Created new `ARC_TESSELLATION` section:
```typescript
export const ARC_TESSELLATION = {
  DEFAULT_SEGMENTS: 24, // 15 degrees per segment
} as const;
```

### 2. Color Config (`config/color-config.ts`)

Added `GHOST_COLORS` section:
```typescript
export const GHOST_COLORS = {
  BASE: '#0078FF',
  FILL: 'rgba(0, 120, 255, 0.15)',
  STROKE: 'rgba(0, 120, 255, 0.6)',
  DELTA_LINE: 'rgba(255, 165, 0, 0.8)',
  READOUT_TEXT: 'rgba(0, 0, 0, 0.8)',
  READOUT_BG: 'rgba(255, 255, 255, 0.9)',
  SIMPLIFIED_BOX: 'rgba(0, 120, 255, 0.3)',
} as const;
```

## Files Changed

| File | Action |
|------|--------|
| `config/tolerance-config.ts` | +2 constants (GAP_TOLERANCE, ARC_TESSELLATION) |
| `config/color-config.ts` | +7 constants (GHOST_COLORS section) |
| `utils/geometry/GeometryUtils.ts` | Updated to use centralized constants |
| `rendering/utils/ghost-entity-renderer.ts` | Updated to use GHOST_COLORS |

## Consequences

### Positive
- **Single source of truth** for ghost rendering colors
- **Single source of truth** for arc tessellation segments
- **Single source of truth** for entity gap tolerance
- **Zero behavior change** - same values as before
- **Easier maintenance** - change in one place affects all usages
- **Better documentation** - JSDoc comments explain each constant

### Negative
- None - pure refactoring with no functional changes

## Related ADRs

- **ADR-079**: Geometric Epsilon/Precision Centralization (GEOMETRY_PRECISION)
- **ADR-044**: Canvas Line Widths Centralization (RENDER_LINE_WIDTHS)
- **ADR-083**: Line Dash Patterns Centralization (LINE_DASH_PATTERNS)
- **ADR-142**: Icon Click Sequence Colors Centralization (color patterns)

## Usage

### GAP_TOLERANCE
```typescript
import { ENTITY_LIMITS } from '../config/tolerance-config';

// Entity chain matching
if (distance <= ENTITY_LIMITS.GAP_TOLERANCE) {
  // Entities are connected
}
```

### ARC_TESSELLATION
```typescript
import { ARC_TESSELLATION } from '../config/tolerance-config';

// Arc to polyline conversion
const segments = ARC_TESSELLATION.DEFAULT_SEGMENTS; // 24
```

### GHOST_COLORS
```typescript
import { GHOST_COLORS } from '../config/color-config';

ctx.fillStyle = GHOST_COLORS.FILL;
ctx.strokeStyle = GHOST_COLORS.STROKE;
```
