/**
 * ADR-570 Φ1 — ribbon options for the «Στυλ Γραμμής ▾» (ByStyle) chooser.
 *
 * Maps the live `LineStyleRegistry` snapshot to `RibbonComboboxOption[]`. Built-in
 * styles carry an i18n KEY in `name` (⇒ run through `t()`, N.11); custom styles carry
 * a literal user-entered name. That rule is NOT decided here — it is the shared
 * `resolveStyleNameLabel` (ADR-739 §52.2): the same rule was re-decided inside the
 * table-style bridge and got it backwards, printing raw keys on screen.
 * Dynamic (function, not const): consumers wrap it in `useMemo` keyed on the
 * registry snapshot — mirror of `buildLinetypeRibbonOptions`.
 *
 * ADR-570 Φ1b — each option carries a `line-style` thumbnail descriptor (dash μοτίβο
 * + πάχος + χρώμα πένας) so the dropdown shows a Revit/Figma-grade preview, not just
 * text. The descriptor is pure data; `RibbonComboboxThumbnail` renders it (SSoT dash
 * via `buildLineStyleThumbnail` → `buildLinetypeThumbnail`).
 *
 * @see systems/line-styles/line-style-registry — `getLineStyleSnapshot`
 * @see systems/line-styles/line-style-thumbnail — preview γεωμετρία (ίδιο SSoT dash)
 */

import type { RibbonComboboxOption } from '../types/ribbon-types';
import type { LineStyle } from '../../../systems/line-styles/line-style-types';
import { resolveStyleNameLabel } from '../../../systems/style-naming/style-name-label';

/** Registry styles → chooser options (value = style id, each with a preview swatch). */
export function buildLineStyleRibbonOptions(
  styles: readonly LineStyle[],
): readonly RibbonComboboxOption[] {
  return styles.map((style) => ({
    value: style.id,
    ...resolveStyleNameLabel(style),
    thumbnail: {
      kind: 'line-style' as const,
      pattern: style.pattern,
      lineweight: style.lineweight,
      penColor: style.penColor,
    },
  }));
}
