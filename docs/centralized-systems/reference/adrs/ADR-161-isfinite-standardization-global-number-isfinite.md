# ADR-161: isFinite() Standardization (global → Number.isFinite)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Mixed usage of global `isFinite()` and `Number.isFinite()` across 4 files (13 occurrences)
- **Risk**: Global `isFinite()` does type coercion (`isFinite("123")` = true) which can cause subtle bugs in a TypeScript codebase
- **Decision**: Standardize to `Number.isFinite()` for strict type checking (no coercion)
- **Pattern**: Use `Number.isFinite()` for all finite number checks in TypeScript code
- **Industry Standard**: ESLint rule `no-restricted-globals` recommends `Number.isFinite` over global
- **Files Updated** (4 files, 13 replacements):
  - `systems/zoom/utils/bounds.ts` - 6 replacements (circle/arc radius, bounds validation, polyline bounds)
  - `systems/zoom/utils/calculations.ts` - 2 replacements (viewport validation, padding validation)
  - `services/FitToViewService.ts` - 2 replacements (scale validation)
  - `rendering/entities/shared/entity-validation-utils.ts` - 2 replacements (isValidPointStrict function)
- **Before/After**:
  ```typescript
  // ❌ BEFORE: Global isFinite (type coercion)
  return isFinite(p.x) && isFinite(p.y);

  // ✅ AFTER: Number.isFinite (strict, no coercion)
  // 🏢 ADR-161: Use Number.isFinite() for strict type checking
  return Number.isFinite(p.x) && Number.isFinite(p.y);
  ```
- **Benefits**:
  - Type-safe: No implicit coercion (strings, objects won't pass)
  - Consistent: Same behavior across all validation checks
  - Modern JavaScript: `Number.isFinite()` is the recommended approach (ES6+)
- **Companion**: ADR-034 (Geometry), ADR-065 (Distance)
