# ADR-093: Text Label Offsets Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `TEXT_LABEL_OFFSETS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `TEXT_LABEL_OFFSETS` from `config/text-rendering-config.ts`
- **Decision**: Centralize hardcoded vertical offsets (10, 30) for multi-line text labels in entity renderers
- **Problem**: Magic numbers `-30`, `-10`, `+10`, `+30` scattered across 5 files:
  - `EllipseRenderer.ts`: 4 lines (Ma, Mi, E, Περ)
  - `ArcRenderer.ts`: 3 lines (R, Angle, L)
  - `RectangleRenderer.ts`: 2 lines (E, Περ)
  - `PolylineRenderer.ts`: 2 lines (E, Περ)
  - `ghost-entity-renderer.ts`: 2 lines (tooltip x/y offset)
- **Solution**: Centralized constants in `text-rendering-config.ts`
- **API**:
  - `TEXT_LABEL_OFFSETS.TWO_LINE`: 10 (2-line label spacing)
  - `TEXT_LABEL_OFFSETS.MULTI_LINE_OUTER`: 30 (3-4 line label outer spacing)
  - `TEXT_LABEL_OFFSETS.TOOLTIP_HORIZONTAL`: 10 (tooltip x offset)
  - `TEXT_LABEL_OFFSETS.TOOLTIP_VERTICAL`: 10 (tooltip y offset)
- **Layout Pattern**:
  ```
  4-line (Ellipse):          3-line (Arc):          2-line (Rect/Poly):
  y - 30  ← "Ma: X.XX"       y - 30  ← "R: X.XX"
  y - 10  ← "Mi: X.XX"       y - 10  ← "Angle"      y - 10  ← "Ε: X.XX"
  y + 10  ← "Ε: X.XX"        y + 10  ← "L: X.XX"    y + 10  ← "Περ: X.XX"
  y + 30  ← "Περ: X.XX"
  ```
- **Industry Standard**: AutoCAD DIMTAD / ISO 129 Dimension Text Positioning
- **Files Migrated**:
  - `rendering/entities/EllipseRenderer.ts` - 4 replacements
  - `rendering/entities/ArcRenderer.ts` - 3 replacements
  - `rendering/entities/RectangleRenderer.ts` - 2 replacements
  - `rendering/entities/PolylineRenderer.ts` - 2 replacements
  - `rendering/utils/ghost-entity-renderer.ts` - 2 replacements
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero magic numbers for text label positioning
  - Single point of change for spacing adjustments
  - Consistent label layout across all entity types
  - Semantic constant names (`TWO_LINE` vs `10`)
- **Companion**: ADR-042 (UI Fonts), ADR-044 (Canvas Line Widths), ADR-048 (RENDER_GEOMETRY)
