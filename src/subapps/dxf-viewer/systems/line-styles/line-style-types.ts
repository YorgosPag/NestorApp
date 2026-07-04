/**
 * ADR-570 Φ1 — Named line-style ("Στυλ Γραμμής") data model.
 *
 * Mirror of the DIMSTYLE model (ADR-362, `types/dimension.ts` `DimStyle`), kept
 * DELIBERATELY SEPARATE from the structural BIM Object Styles (ADR-375/377):
 * Revit keeps draft-line *Line Styles* apart from *Object Styles*, and so do we
 * (see ADR-570 §7 — rejected alternatives).
 *
 * A `LineStyle` is a reusable, named bundle of pen color + lineweight + linetype
 * pattern + drawing category. Entities point at one via `BaseEntity.lineStyleId`
 * (ByStyle). Effective resolution order: **per-object override → ByStyle → ByLayer**
 * (see `line-style-resolver.ts`).
 */

/**
 * A pattern reuses the linetype-iso-catalog SSoT: it is a catalog linetype NAME
 * (`config/linetype-iso-catalog.ts` — e.g. 'Continuous', 'Hidden', 'Center').
 */
export type LinePatternKey = string;

/** Drawing intent — Revit/ARCHICAD «Line Category» (Σχεδιαστική vs Τομής). */
export type LineStyleCategory = 'drafting' | 'cut';

/** Sentinel pen color meaning "inherit the entity's layer color" (ByLayer). */
export const LINE_STYLE_BYLAYER_PEN = 'ByLayer';

/** Sentinel lineweight (mm) meaning ByLayer — mirrors DIMSTYLE `dimlwd:-2`. */
export const LINE_STYLE_BYLAYER_LWT = -2;

/** Default linetype pattern when a style/override resolves to nothing (AutoCAD). */
export const LINE_STYLE_DEFAULT_PATTERN: LinePatternKey = 'Continuous';

export interface LineStyle {
  /** Deterministic slug for built-ins; `generateLineStyleId()` for customs (N.6). */
  readonly id: string;
  /**
   * Built-in (`isBuiltIn: true`) ⇒ i18n KEY, resolved via `t()` at display time
   * (N.11 — no hardcoded Greek in code). Custom ⇒ literal user-entered name.
   */
  readonly name: string;
  /** ByStyle pen color — hex, or `LINE_STYLE_BYLAYER_PEN` to inherit the layer. */
  readonly penColor: string;
  /** ByStyle lineweight in mm, or `LINE_STYLE_BYLAYER_LWT` (-2) for ByLayer. */
  readonly lineweight: number;
  /** ByStyle linetype — a `linetype-iso-catalog` name (reuse SSoT). */
  readonly pattern: LinePatternKey;
  readonly category: LineStyleCategory;
  readonly isBuiltIn: boolean;
}

export type CreateCustomLineStyleInput = Omit<LineStyle, 'id' | 'isBuiltIn'>;
export type UpdateCustomLineStylePatch = Partial<Omit<LineStyle, 'id' | 'isBuiltIn'>>;

/** Stable snapshot object for `useSyncExternalStore` (mirror `DimStyleSnapshot`). */
export interface LineStyleSnapshot {
  readonly styles: readonly LineStyle[];
  readonly activeStyleId: string;
}
