/**
 * ADR-559 §3e — Canonical line-settings SCHEMA (Single Source of Truth for the SHAPE).
 *
 * Before this, the line-settings object shape was re-declared as **4 independent interfaces**
 * (`settings-core/types/domain.ts LineSettings`, `ui/.../shared/LinePreview.tsx LineSettings`,
 * `ui/.../shared/CurrentSettingsDisplay.tsx LineSettings`, plus the unrelated tiny CSS-preview
 * input in `ui/.../hooks/useSettingsPreview.ts`). Adding ONE field meant editing every copy by
 * hand — fragile, easy to miss one. This is the exact sibling of the grip-settings duplication
 * that ADR-559 §3b centralized in `types/grip-settings-schema.ts`.
 *
 * This file defines the shape ONCE; every other stored/view-model line-settings type is a
 * PROJECTION (`type X = Pick<LineSettingsBase, ...> & { ... }`) of this base — never a
 * re-declaration. So a new line field is added in exactly ONE place (`LineSettingsBase`) and
 * propagates everywhere.
 *
 * NOTE: this centralizes the TYPE shape only. The DEFAULT VALUES stay per-context (stored /
 * runtime / preview legitimately differ — mirror the grip §3b note), so those default objects
 * are intentionally NOT merged here.
 *
 * The tiny `{ color, width, style }` CSS-preview input in `useSettingsPreview.ts` is NOT a
 * projection of this base (different field names/types) — it was de-collision-renamed to
 * `LineCssPreviewInput`, exactly as the grip preview input became `GripCssPreviewInput`.
 */

// The primitive line-style unions live here (canonical home) and are re-exported from
// `settings-core/types/domain.ts` so existing barrel importers stay unchanged. Defining them
// alongside the base keeps this file a dependency-leaf (domain imports the schema, not vice
// versa — no circular import).
export type LineType = 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'dash-dot-dot';
export type LineCapStyle = 'butt' | 'round' | 'square';
export type LineJoinStyle = 'miter' | 'round' | 'bevel';

/**
 * The full line-settings shape as it lives in STORED user settings (domain) — and that every
 * view-model projection picks from. This is the one place a new line field is added.
 */
export interface LineSettingsBase {
  enabled: boolean;
  lineType: LineType;
  lineWidth: number;        // 0.25 - 2.0mm (ISO 128)
  color: string;            // Hex color (used when colorMode !== 'ByLayer')
  /**
   * ADR-358 §G7 Phase 6.5 — color resolution mode for entities created by
   * drawing tools. 'ByLayer' (default) → entity emits sentinel and inherits
   * from layer cascade at render time. 'Concrete' → entity flattens to the
   * `color` hex above. Absent treated as 'ByLayer' for forward-compat.
   */
  colorMode?: 'ByLayer' | 'Concrete';
  /**
   * ADR-358 §G7 Phase 6.5 — lineweight resolution mode mirroring colorMode.
   * 'ByLayer' (default) → entity emits `lineweightMm: -2` sentinel and
   * inherits from layer. 'Concrete' → uses `lineWidth` above.
   */
  lineweightMode?: 'ByLayer' | 'Concrete';
  opacity: number;          // 0.0 - 1.0
  dashScale: number;        // 0.5 - 3.0
  dashOffset: number;       // 0 - 100
  lineCap: LineCapStyle;
  lineJoin: LineJoinStyle;
  breakAtCenter: boolean;

  // Hover state
  hoverColor: string;
  hoverType: LineType;
  hoverWidth: number;
  hoverOpacity: number;

  // Final state
  finalColor: string;
  finalType: LineType;
  finalWidth: number;
  finalOpacity: number;

  activeTemplate: string | null;
}
