# ADR-076: RGB ↔ HEX Color Conversion Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Canonical Location** | `parseHex()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `parseHex()`, `rgbToHex()`, `normalizeHex()`, `isValidHex()` from `ui/color/utils.ts`
- **Impact**: 13+ inline color conversion implementations → canonical functions
- **Files Migrated**:
  - `aci.ts` - Removed duplicate `hexToRgb()`, uses `parseHex()`
  - `useContrast.ts` - Removed duplicate `hexToRgb()` and `rgbToHex()`, uses imports
  - `LegacyGridAdapter.ts` - Uses `parseHex()` and `rgbToHex()` for color darkening/lightening
  - `domain.ts` - Uses `rgbToHex()` for RGB→HEX conversion
  - `RulerBackgroundSettings.tsx` - Uses `rgbToHex()` for rgba→hex extraction
  - `RulerMajorLinesSettings.tsx` - Uses `rgbToHex()` in `getBaseColor()`
  - `RulerMinorLinesSettings.tsx` - Uses `rgbToHex()` in `getBaseColor()`
  - `RulerUnitsSettings.tsx` - Uses `rgbToHex()` in `getPreviewColor()`
  - `RecentColorsStore.ts` - Uses `normalizeHex()` and `isValidHex()` from utils (2026-02-01)
- **Pattern**: Single Source of Truth (SSOT)
- **API**:
  - `parseHex(hex: string): RGBColor` - Parses #RGB, #RRGGBB, #RRGGBBAA
  - `rgbToHex(rgb: RGBColor, options?: FormatOptions): string` - Converts RGB to hex
  - `normalizeHex(hex: string, options?: FormatOptions): string` - Normalizes hex format
  - `isValidHex(hex: string): boolean` - Validates hex color format
- **Benefits**:
  - Zero duplicate color conversion code
  - Consistent parsing with error handling
  - Support for shorthand (#RGB) and alpha (#RRGGBBAA)
  - Type-safe RGBColor interface
- **Companion**: ADR-004 (Canvas Theme System)
