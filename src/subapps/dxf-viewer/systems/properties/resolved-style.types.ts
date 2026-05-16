/**
 * ResolvedStyle — ADR-358 §G7 ByLayer/ByBlock pipeline output.
 *
 * Concrete, fully-resolved visual style for a single entity at render time.
 * Output of `resolveEntityStyle()` — no sentinels (-3/-2/-1), no 'ByLayer'/'ByBlock'
 * strings, no missing fields. Renderers consume this directly.
 *
 * Color SSoT priority: TrueColor → ACI palette → legacy hex.
 * Lineweight SSoT: mm (display-independent). Convert at stroke time via
 * `lineweightToPx(mm, dpi)` from `config/lineweight-iso-catalog.ts`.
 * Linetype SSoT: `LinetypeDef` resolved through `LinetypeRegistry.resolveLinetype`.
 */

import type { LinetypeDef } from '../../config/linetype-iso-catalog';
import type { LineweightMm } from '../../types/entities';
import type { ConcreteLineweightMm } from '../../config/lineweight-iso-catalog';

/**
 * Source of a resolved style — for diagnostics + override priority decisions.
 * Quick Style overrides (ADR-357 Q19) take effect at a layer above this resolver
 * and rewrite individual fields without changing the source classification.
 */
export type StyleResolutionSource = 'entity' | 'block' | 'layer' | 'default';

/**
 * Per-field provenance breakdown — useful for the property panel + DXF round-trip
 * validation. Always populated; absence of a field source means it was not
 * cascaded (e.g. entity carried a concrete value).
 */
export interface ResolvedStyleProvenance {
  readonly color: StyleResolutionSource;
  readonly linetype: StyleResolutionSource;
  readonly lineweight: StyleResolutionSource;
  readonly transparency: StyleResolutionSource;
}

/**
 * Fully-resolved style — output of `resolveEntityStyle()`.
 * Every field is concrete. Renderers must not see ByLayer/ByBlock/Default sentinels.
 */
export interface ResolvedStyle {
  /** Concrete CSS color (`#rrggbb`). Always populated. */
  readonly color: string;
  /** ACI index that produced `color`, when the cascade hit ACI. Null for TrueColor + legacy hex. */
  readonly colorAci: number | null;
  /** TrueColor 0xRRGGBB integer that produced `color`, when set. Null otherwise. */
  readonly colorTrueColor: number | null;
  /** Resolved linetype definition (ISO baseline or runtime-registered). Never null. */
  readonly linetype: LinetypeDef;
  /** Concrete mm lineweight. Never a sentinel. */
  readonly lineweight: ConcreteLineweightMm;
  /** 0-90, where 0 = opaque, 90 = nearly transparent. AutoCAD convention. */
  readonly transparency: number;
  /** Per-field provenance for diagnostics. */
  readonly provenance: ResolvedStyleProvenance;
}

/**
 * Per-entity style declaration (subset extracted from the Entity object).
 * Missing fields imply ByLayer (entity inherits from layer).
 *
 * Explicit literal `colorMode: 'ByBlock'` / `lineweightMm: -1` opts into ByBlock
 * resolution — required for entities inside a block insert.
 */
export interface EntityStyleInput {
  /** Resolution mode for color — `'Concrete'` if `colorHex`/`colorAci`/`colorTrueColor` is set, else ByLayer/ByBlock. */
  readonly colorMode?: 'ByLayer' | 'ByBlock' | 'Concrete';
  /** Concrete legacy hex (`#rrggbb`). Used when `colorAci` and `colorTrueColor` are absent. */
  readonly colorHex?: string;
  /** Concrete ACI 1-255. Takes priority over `colorHex`. */
  readonly colorAci?: number;
  /** Concrete TrueColor 0xRRGGBB. Takes priority over ACI + hex. */
  readonly colorTrueColor?: number | null;
  /** Linetype name (case-sensitive). Missing = ByLayer. Literal `'ByBlock'` opts into block resolution. */
  readonly linetypeName?: string | 'ByLayer' | 'ByBlock';
  /** Lineweight mm — concrete value or sentinel (-3 DEFAULT / -2 ByLayer / -1 ByBlock). Missing = ByLayer. */
  readonly lineweightMm?: LineweightMm;
  /** Transparency 0-90. Missing = ByLayer. */
  readonly transparency?: number;
}

/**
 * Block-context style (when entity sits inside an INSERT).
 * Concrete fields only — blocks themselves resolve against their host layer
 * before being passed in here.
 */
export interface BlockStyleInput {
  readonly colorHex?: string;
  readonly colorAci?: number;
  readonly colorTrueColor?: number | null;
  readonly linetypeName?: string;
  readonly lineweightMm?: LineweightMm;
  readonly transparency?: number;
}

/**
 * System default cascade input — used to resolve `-3 DEFAULT` lineweight.
 * Mirrors `default-lineweight-resolver.DefaultLineweightInput`.
 */
export interface DefaultStyleInput {
  /** Per-project Firestore override. */
  readonly projectLineweight?: LineweightMm | null;
  /** User preference (localStorage). */
  readonly userLineweight?: LineweightMm | null;
}
