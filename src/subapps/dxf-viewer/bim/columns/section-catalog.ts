/**
 * ADR-363 Phase 8E — Section catalog presets (SSoT).
 *
 * Shear-wall: Eurocode 2 concrete classes (C20/25 … C40/50) with default
 * thickness per class.
 *
 * I-shape (steel): EN 10365 hot-rolled European sections — IPE (narrow
 * flange) + HEA/HEB/HEM (wide flange, HE series). Nominal dimensions are
 * uncopyrightable facts published in the standard (see ADR-409 §C.1: numeric
 * section dimensions are not protected by copyright or the EU sui generis
 * database right). Values consistent with EN 10365:2017 / Euronorm 53-62.
 *
 * ✅ All 75 sections verified 2026-06-02 against multiple independent EN 10365
 * tables (eurocodeapplied.com, wermac.org, structolution.com, projectmaterials)
 * — 0 discrepancies. NOTE on HEM: sectionDepth h is the REAL depth, not the
 * nominal number (e.g. HEM-100 → h=120mm); some online tables get this wrong.
 *
 * SSoT: the dropdown options in `contextual-column-tab.ts` are GENERATED from
 * these arrays (`ISHAPE_CATALOG` / `SHEAR_WALL_CATALOG`) — never hand-maintain
 * a parallel list. I-shape labels are derived from the data via
 * `formatIShapePresetLabel` (code + dims = not translatable → literal label).
 *
 * Sentinel: 'custom' — shown in the catalog dropdown after a manual override
 * (Revit-style pattern). Means "user has deviated from a standard profile".
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 * @see docs/centralized-systems/reference/adrs/ADR-409-third-party-bim-library-licensing-policy.md §C
 */

/** Shown in catalog dropdown when user manually overrides a catalog dimension. */
export const CATALOG_CUSTOM_SENTINEL = 'custom';

// ─── Shear-wall RC concrete presets (Eurocode 2 / EN 1992-1-1) ───────────────

export interface ShearWallCatalogPreset {
  /** Catalog ID — persisted in `ColumnParams.catalogProfile`. */
  readonly id: string;
  /** i18n label key (namespace: dxf-viewer-shell). Has translatable text ("πάχος"). */
  readonly labelKey: string;
  /** Default wall thickness (mm). Maps to `ColumnParams.depth`. */
  readonly thickness: number;
}

export const SHEAR_WALL_CATALOG: readonly ShearWallCatalogPreset[] = [
  { id: 'C20/25', labelKey: 'ribbon.commands.columnEditor.catalogProfile.shearWall.c2025', thickness: 200 },
  { id: 'C25/30', labelKey: 'ribbon.commands.columnEditor.catalogProfile.shearWall.c2530', thickness: 200 },
  { id: 'C30/37', labelKey: 'ribbon.commands.columnEditor.catalogProfile.shearWall.c3037', thickness: 250 },
  { id: 'C35/45', labelKey: 'ribbon.commands.columnEditor.catalogProfile.shearWall.c3545', thickness: 250 },
  { id: 'C40/50', labelKey: 'ribbon.commands.columnEditor.catalogProfile.shearWall.c4050', thickness: 300 },
] as const;

// ─── I-shape steel section presets (EN 10365 European sections) ───────────────

export interface IShapeCatalogPreset {
  /** Catalog ID — persisted in `ColumnParams.catalogProfile` (e.g. 'HEB-300'). */
  readonly id: string;
  /** Flange width b (mm). Maps to `ColumnParams.width`. */
  readonly flangeWidth: number;
  /** Section depth h (mm). Maps to `ColumnParams.depth`. */
  readonly sectionDepth: number;
  /** Flange thickness tf (mm). Maps to `ColumnIShapeParams.flangeThickness`. */
  readonly flangeThickness: number;
  /** Web thickness tw (mm). Maps to `ColumnIShapeParams.webThickness`. */
  readonly webThickness: number;
}

export const ISHAPE_CATALOG: readonly IShapeCatalogPreset[] = [
  // ── IPE family (narrow flange, EN 10365) — b, h, tf, tw ──────────────────────
  { id: 'IPE-80',  flangeWidth:  46, sectionDepth:  80, flangeThickness:  5.2, webThickness:  3.8 },
  { id: 'IPE-100', flangeWidth:  55, sectionDepth: 100, flangeThickness:  5.7, webThickness:  4.1 },
  { id: 'IPE-120', flangeWidth:  64, sectionDepth: 120, flangeThickness:  6.3, webThickness:  4.4 },
  { id: 'IPE-140', flangeWidth:  73, sectionDepth: 140, flangeThickness:  6.9, webThickness:  4.7 },
  { id: 'IPE-160', flangeWidth:  82, sectionDepth: 160, flangeThickness:  7.4, webThickness:  5.0 },
  { id: 'IPE-180', flangeWidth:  91, sectionDepth: 180, flangeThickness:  8.0, webThickness:  5.3 },
  { id: 'IPE-200', flangeWidth: 100, sectionDepth: 200, flangeThickness:  8.5, webThickness:  5.6 },
  { id: 'IPE-220', flangeWidth: 110, sectionDepth: 220, flangeThickness:  9.2, webThickness:  5.9 },
  { id: 'IPE-240', flangeWidth: 120, sectionDepth: 240, flangeThickness:  9.8, webThickness:  6.2 },
  { id: 'IPE-270', flangeWidth: 135, sectionDepth: 270, flangeThickness: 10.2, webThickness:  6.6 },
  { id: 'IPE-300', flangeWidth: 150, sectionDepth: 300, flangeThickness: 10.7, webThickness:  7.1 },
  { id: 'IPE-330', flangeWidth: 160, sectionDepth: 330, flangeThickness: 11.5, webThickness:  7.5 },
  { id: 'IPE-360', flangeWidth: 170, sectionDepth: 360, flangeThickness: 12.7, webThickness:  8.0 },
  { id: 'IPE-400', flangeWidth: 180, sectionDepth: 400, flangeThickness: 13.5, webThickness:  8.6 },
  { id: 'IPE-450', flangeWidth: 190, sectionDepth: 450, flangeThickness: 14.6, webThickness:  9.4 },
  { id: 'IPE-500', flangeWidth: 200, sectionDepth: 500, flangeThickness: 16.0, webThickness: 10.2 },
  { id: 'IPE-550', flangeWidth: 210, sectionDepth: 550, flangeThickness: 17.2, webThickness: 11.1 },
  { id: 'IPE-600', flangeWidth: 220, sectionDepth: 600, flangeThickness: 19.0, webThickness: 12.0 },
  // ── HEA family (HE-A, wide flange light, EN 10365) — b, h, tf, tw ────────────
  { id: 'HEA-100', flangeWidth: 100, sectionDepth:  96, flangeThickness:  8.0, webThickness:  5.0 },
  { id: 'HEA-120', flangeWidth: 120, sectionDepth: 114, flangeThickness:  8.0, webThickness:  5.0 },
  { id: 'HEA-140', flangeWidth: 140, sectionDepth: 133, flangeThickness:  8.5, webThickness:  5.5 },
  { id: 'HEA-160', flangeWidth: 160, sectionDepth: 152, flangeThickness:  9.0, webThickness:  6.0 },
  { id: 'HEA-180', flangeWidth: 180, sectionDepth: 171, flangeThickness:  9.5, webThickness:  6.0 },
  { id: 'HEA-200', flangeWidth: 200, sectionDepth: 190, flangeThickness: 10.0, webThickness:  6.5 },
  { id: 'HEA-220', flangeWidth: 220, sectionDepth: 210, flangeThickness: 11.0, webThickness:  7.0 },
  { id: 'HEA-240', flangeWidth: 240, sectionDepth: 230, flangeThickness: 12.0, webThickness:  7.5 },
  { id: 'HEA-260', flangeWidth: 260, sectionDepth: 250, flangeThickness: 12.5, webThickness:  7.5 },
  { id: 'HEA-280', flangeWidth: 280, sectionDepth: 270, flangeThickness: 13.0, webThickness:  8.0 },
  { id: 'HEA-300', flangeWidth: 300, sectionDepth: 290, flangeThickness: 14.0, webThickness:  8.5 },
  { id: 'HEA-320', flangeWidth: 300, sectionDepth: 310, flangeThickness: 15.5, webThickness:  9.0 },
  { id: 'HEA-340', flangeWidth: 300, sectionDepth: 330, flangeThickness: 16.5, webThickness:  9.5 },
  { id: 'HEA-360', flangeWidth: 300, sectionDepth: 350, flangeThickness: 17.5, webThickness: 10.0 },
  { id: 'HEA-400', flangeWidth: 300, sectionDepth: 390, flangeThickness: 19.0, webThickness: 11.0 },
  { id: 'HEA-450', flangeWidth: 300, sectionDepth: 440, flangeThickness: 21.0, webThickness: 11.5 },
  { id: 'HEA-500', flangeWidth: 300, sectionDepth: 490, flangeThickness: 23.0, webThickness: 12.0 },
  { id: 'HEA-550', flangeWidth: 300, sectionDepth: 540, flangeThickness: 24.0, webThickness: 12.5 },
  { id: 'HEA-600', flangeWidth: 300, sectionDepth: 590, flangeThickness: 25.0, webThickness: 13.0 },
  // ── HEB family (HE-B, wide flange standard, EN 10365) — b, h, tf, tw ─────────
  { id: 'HEB-100', flangeWidth: 100, sectionDepth: 100, flangeThickness: 10.0, webThickness:  6.0 },
  { id: 'HEB-120', flangeWidth: 120, sectionDepth: 120, flangeThickness: 11.0, webThickness:  6.5 },
  { id: 'HEB-140', flangeWidth: 140, sectionDepth: 140, flangeThickness: 12.0, webThickness:  7.0 },
  { id: 'HEB-160', flangeWidth: 160, sectionDepth: 160, flangeThickness: 13.0, webThickness:  8.0 },
  { id: 'HEB-180', flangeWidth: 180, sectionDepth: 180, flangeThickness: 14.0, webThickness:  8.5 },
  { id: 'HEB-200', flangeWidth: 200, sectionDepth: 200, flangeThickness: 15.0, webThickness:  9.0 },
  { id: 'HEB-220', flangeWidth: 220, sectionDepth: 220, flangeThickness: 16.0, webThickness:  9.5 },
  { id: 'HEB-240', flangeWidth: 240, sectionDepth: 240, flangeThickness: 17.0, webThickness: 10.0 },
  { id: 'HEB-260', flangeWidth: 260, sectionDepth: 260, flangeThickness: 17.5, webThickness: 10.0 },
  { id: 'HEB-280', flangeWidth: 280, sectionDepth: 280, flangeThickness: 18.0, webThickness: 10.5 },
  { id: 'HEB-300', flangeWidth: 300, sectionDepth: 300, flangeThickness: 19.0, webThickness: 11.0 },
  { id: 'HEB-320', flangeWidth: 300, sectionDepth: 320, flangeThickness: 20.5, webThickness: 11.5 },
  { id: 'HEB-340', flangeWidth: 300, sectionDepth: 340, flangeThickness: 21.5, webThickness: 12.0 },
  { id: 'HEB-360', flangeWidth: 300, sectionDepth: 360, flangeThickness: 22.5, webThickness: 12.5 },
  { id: 'HEB-400', flangeWidth: 300, sectionDepth: 400, flangeThickness: 24.0, webThickness: 13.5 },
  { id: 'HEB-450', flangeWidth: 300, sectionDepth: 450, flangeThickness: 26.0, webThickness: 14.0 },
  { id: 'HEB-500', flangeWidth: 300, sectionDepth: 500, flangeThickness: 28.0, webThickness: 14.5 },
  { id: 'HEB-550', flangeWidth: 300, sectionDepth: 550, flangeThickness: 29.0, webThickness: 15.0 },
  { id: 'HEB-600', flangeWidth: 300, sectionDepth: 600, flangeThickness: 30.0, webThickness: 15.5 },
  // ── HEM family (HE-M, wide flange heavy, EN 10365) — b, h, tf, tw ────────────
  { id: 'HEM-100', flangeWidth: 106, sectionDepth: 120, flangeThickness: 20.0, webThickness: 12.0 },
  { id: 'HEM-120', flangeWidth: 126, sectionDepth: 140, flangeThickness: 21.0, webThickness: 12.5 },
  { id: 'HEM-140', flangeWidth: 146, sectionDepth: 160, flangeThickness: 22.0, webThickness: 13.0 },
  { id: 'HEM-160', flangeWidth: 166, sectionDepth: 180, flangeThickness: 23.0, webThickness: 14.0 },
  { id: 'HEM-180', flangeWidth: 186, sectionDepth: 200, flangeThickness: 24.0, webThickness: 14.5 },
  { id: 'HEM-200', flangeWidth: 206, sectionDepth: 220, flangeThickness: 25.0, webThickness: 15.0 },
  { id: 'HEM-220', flangeWidth: 226, sectionDepth: 240, flangeThickness: 26.0, webThickness: 15.5 },
  { id: 'HEM-240', flangeWidth: 248, sectionDepth: 270, flangeThickness: 32.0, webThickness: 18.0 },
  { id: 'HEM-260', flangeWidth: 268, sectionDepth: 290, flangeThickness: 32.5, webThickness: 18.0 },
  { id: 'HEM-280', flangeWidth: 288, sectionDepth: 310, flangeThickness: 33.0, webThickness: 18.5 },
  { id: 'HEM-300', flangeWidth: 310, sectionDepth: 340, flangeThickness: 39.0, webThickness: 21.0 },
  { id: 'HEM-320', flangeWidth: 309, sectionDepth: 359, flangeThickness: 40.0, webThickness: 21.0 },
  { id: 'HEM-340', flangeWidth: 309, sectionDepth: 377, flangeThickness: 40.0, webThickness: 21.0 },
  { id: 'HEM-360', flangeWidth: 308, sectionDepth: 395, flangeThickness: 40.0, webThickness: 21.0 },
  { id: 'HEM-400', flangeWidth: 307, sectionDepth: 432, flangeThickness: 40.0, webThickness: 21.0 },
  { id: 'HEM-450', flangeWidth: 307, sectionDepth: 478, flangeThickness: 40.0, webThickness: 21.0 },
  { id: 'HEM-500', flangeWidth: 306, sectionDepth: 524, flangeThickness: 40.0, webThickness: 21.0 },
  { id: 'HEM-550', flangeWidth: 306, sectionDepth: 572, flangeThickness: 40.0, webThickness: 21.0 },
  { id: 'HEM-600', flangeWidth: 305, sectionDepth: 620, flangeThickness: 40.0, webThickness: 21.0 },
] as const;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function findShearWallPreset(id: string): ShearWallCatalogPreset | null {
  return SHEAR_WALL_CATALOG.find((p) => p.id === id) ?? null;
}

export function findIShapePreset(id: string): IShapeCatalogPreset | null {
  return ISHAPE_CATALOG.find((p) => p.id === id) ?? null;
}

/**
 * Human-readable dropdown label for an I-shape preset, derived from the data.
 * Code + dimensions are not translatable (international section designation +
 * mm), so this is a literal label (no i18n) — the catalog stays the SSoT.
 * Example: 'IPE-300' → "IPE 300 (b=150, h=300mm)".
 */
export function formatIShapePresetLabel(preset: IShapeCatalogPreset): string {
  return `${preset.id.replace('-', ' ')} (b=${preset.flangeWidth}, h=${preset.sectionDepth}mm)`;
}
