# ADR-139: Label Box Dimensions Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `TEXT_LABEL_OFFSETS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `TEXT_LABEL_OFFSETS` extension in `config/text-rendering-config.ts`
- **Decision**: Centralize all label box padding, height, and offset constants
- **Status**: ✅ IMPLEMENTED
- **Problem**: Hardcoded values scattered across files with inconsistencies:
  - `overlay-drawing.ts`: `padding = 6`, `h = 18` (region labels)
  - `ghost-entity-renderer.ts`: `4, 8, 8, 16` (entity count), `14, 16` (coordinate readout)
  - Inconsistent padding: 4px vs 6px across different contexts
  - Inconsistent heights: 16px vs 18px
- **Solution**: Extended `TEXT_LABEL_OFFSETS` with semantic constants:
  ```typescript
  // 🏢 ADR-139: LABEL BOX DIMENSIONS
  LABEL_BOX_PADDING: 4,        // Standard label box padding (ghost readouts, entity count)
  OVERLAY_LABEL_PADDING: 6,    // Region name labels (larger for readability)
  LABEL_BOX_HEIGHT: 16,        // Standard label box height (ghost readouts)
  OVERLAY_LABEL_HEIGHT: 18,    // Region name label height (larger)
  ENTITY_COUNT_OFFSET_Y: 8,    // Y offset for entity count label background
  READOUT_OFFSET_Y: 14,        // Y offset for coordinate readout background
  ```
- **Files Migrated**:
  - `utils/overlay-drawing.ts` - padding (6 → OVERLAY_LABEL_PADDING), h (18 → OVERLAY_LABEL_HEIGHT)
  - `rendering/utils/ghost-entity-renderer.ts` - entity count & readout dimensions
- **Benefits**:
  - Eliminates 6 hardcoded magic numbers
  - Semantic naming (OVERLAY vs LABEL_BOX for different contexts)
  - Single source of truth for label dimensions
  - Preserves intentional differences (overlay=6/18, ghost=4/16)
- **Companion**: ADR-091 (Text Label Offsets), ADR-107 (UI Size Defaults)
