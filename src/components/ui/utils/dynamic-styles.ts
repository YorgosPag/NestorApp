/**
 * 🎨 DYNAMIC STYLING UTILITIES - CLAUDE.md COMPLIANCE
 *
 * Enterprise solution για dynamic styling χωρίς inline styles.
 * Αντικαθιστά style={{ backgroundColor: color }} με centralized CSS-in-JS patterns.
 *
 * ✅ BENEFITS:
 * - Zero inline styles (CLAUDE.md compliant)
 * - Type-safe dynamic styling
 * - Performance optimized (memoized via hooks module)
 * - Consistent color validation
 * - Enterprise-grade error handling
 *
 * 📍 MIGRATION:
 * - style={{ backgroundColor: color }} → className={getDynamicBackgroundClass(color)}
 * - style={{ color: textColor }}        → className={getDynamicTextClass(textColor)}
 * - style={{ borderColor: border }}     → className={getDynamicBorderClass(border)}
 *
 * 🧩 STRUCTURE (ADR-314 Phase C.5.6 SRP split — barrel only, zero cycle):
 * - `dynamic-styles-internals.ts`  — validators, class-key generators, DOM injection
 * - `dynamic-styles-generators.ts` — pure class generators + composite + cleanup
 * - `dynamic-styles-hooks.ts`      — React memoized hooks
 * - `dynamic-styles.ts` (this file) — barrel: re-export public API
 */

export {
  getDynamicBackgroundClass,
  getDynamicBorderClass,
  getDynamicHeightClass,
  getDynamicTextClass,
  getDynamicTransformClass,
  getDynamicWidthClass,
} from './dynamic-styles-generators';

export {
  useDynamicBackgroundClass,
  useDynamicBorderClass,
} from './dynamic-styles-hooks';
