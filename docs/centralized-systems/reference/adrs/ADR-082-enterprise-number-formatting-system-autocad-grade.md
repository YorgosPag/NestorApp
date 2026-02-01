# ADR-082: Enterprise Number Formatting System (AutoCAD-Grade)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `FormatterRegistry` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `FormatterRegistry` from `formatting/FormatterRegistry.ts`
- **Hook**: `useFormatter()` from `formatting/useFormatter.ts`
- **Config**: `number-format-config.ts`
- **Impact**: 258 scattered `.toFixed()` patterns → 1 centralized, locale-aware system
- **Problem**: No locale awareness in number formatting (Greek uses comma, English uses period)
- **Solution**: Full AutoCAD-grade FormatterRegistry with:
  - Unit types (Scientific, Decimal, Engineering, Architectural, Fractional)
  - Locale-aware formatting (el-GR: `1.234,56` vs en-US: `1,234.56`)
  - Per-category precision configuration
  - Format templates (prefix/suffix like DIMPOST)
  - Hierarchical overrides (Global → Context → Per-element)
  - Zero suppression options (like DIMZIN)
- **AutoCAD System Variable Mapping**:
  | AutoCAD | This Config |
  |---------|-------------|
  | LUNITS | linearUnits |
  | LUPREC | precision.linear |
  | AUNITS | angularUnits |
  | AUPREC | precision.angular |
  | DIMZIN | zeroSuppression |
  | DIMDSEP | decimalSeparator |
  | DIMPOST | templates.* |
- **API**:
  ```typescript
  // Registry usage (non-React)
  const fmt = FormatterRegistry.getInstance();
  fmt.formatDistance(1234.567);  // "1.234,57" (el-GR) or "1,234.57" (en-US)
  fmt.formatAngle(45.5);         // "45,5°" (el-GR) or "45.5°" (en-US)
  fmt.formatDiameter(50);        // "Ø50,00" (el-GR) or "Ø50.00" (en-US)
  fmt.formatPercent(0.75);       // "75%"

  // React hook usage
  const { formatDistance, formatAngle } = useFormatter();
  ```
- **New Functions in distance-label-utils.ts**:
  - `formatDistanceLocale()` - Locale-aware distance formatting
  - `formatAngleLocale()` - Locale-aware angle formatting
  - `formatCoordinateLocale()` - Locale-aware coordinate formatting
- **File Structure**:
  ```
  src/subapps/dxf-viewer/
  ├── config/number-format-config.ts (150 lines)
  ├── formatting/
  │   ├── FormatterRegistry.ts (500 lines)
  │   ├── useFormatter.ts (150 lines)
  │   └── index.ts (exports)
  └── rendering/entities/shared/
      └── distance-label-utils.ts (MODIFIED)
  ```
- **Pattern**: Singleton + Factory + Strategy
- **Benefits**:
  - Zero inline `.toFixed()` patterns (incremental migration)
  - Locale-aware decimal separators
  - AutoCAD-compatible unit types
  - Cached Intl.NumberFormat instances
  - Full TypeScript (ZERO any)
- **Migration Strategy**: On-touch migration (replace `.toFixed()` when editing files)
- **Companion**: ADR-069 (formatDistance/formatAngle), ADR-081 (formatPercent), ADR-041 (Distance Labels)
