/**
 * ADR-363 Phase 8E — Section catalog presets (SSoT).
 *
 * Shear-wall: Eurocode 2 concrete classes (C20/25 … C40/50) with default
 * thickness per class.
 *
 * I-shape (steel): EN 10025-2 IPE (narrow-flange) and HEA (wide-flange)
 * families. Dimensions from SCI/Arcelor section tables.
 *
 * Sentinel: 'custom' — shown in the catalog dropdown after a manual override
 * (Revit-style pattern). Means "user has deviated from a standard profile".
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

/** Shown in catalog dropdown when user manually overrides a catalog dimension. */
export const CATALOG_CUSTOM_SENTINEL = 'custom';

// ─── Shear-wall RC concrete presets (Eurocode 2 / EN 1992-1-1) ───────────────

export interface ShearWallCatalogPreset {
  /** Catalog ID — persisted in `ColumnParams.catalogProfile`. */
  readonly id: string;
  /** i18n label key (namespace: dxf-viewer-shell). */
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

// ─── I-shape steel section presets (EN 10025-2) ───────────────────────────────

export interface IShapeCatalogPreset {
  /** Catalog ID — persisted in `ColumnParams.catalogProfile`. */
  readonly id: string;
  /** i18n label key (namespace: dxf-viewer-shell). */
  readonly labelKey: string;
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
  // IPE family (narrow flange, EN 10025-2)
  { id: 'IPE-200', labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe200', flangeWidth: 100, sectionDepth: 200, flangeThickness:  8.5, webThickness:  5.6 },
  { id: 'IPE-240', labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe240', flangeWidth: 120, sectionDepth: 240, flangeThickness:  9.8, webThickness:  6.2 },
  { id: 'IPE-300', labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe300', flangeWidth: 150, sectionDepth: 300, flangeThickness: 10.7, webThickness:  7.1 },
  { id: 'IPE-360', labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe360', flangeWidth: 170, sectionDepth: 360, flangeThickness: 12.7, webThickness:  8.0 },
  { id: 'IPE-400', labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe400', flangeWidth: 180, sectionDepth: 400, flangeThickness: 13.5, webThickness:  8.6 },
  { id: 'IPE-500', labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe500', flangeWidth: 200, sectionDepth: 500, flangeThickness: 16.0, webThickness: 10.2 },
  // HEA family (wide flange, EN 10025-2)
  { id: 'HEA-200', labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.hea200', flangeWidth: 200, sectionDepth: 190, flangeThickness: 10.0, webThickness:  6.5 },
  { id: 'HEA-240', labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.hea240', flangeWidth: 240, sectionDepth: 230, flangeThickness: 12.0, webThickness:  7.5 },
  { id: 'HEA-300', labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.hea300', flangeWidth: 300, sectionDepth: 290, flangeThickness: 14.0, webThickness:  8.5 },
  { id: 'HEA-400', labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.hea400', flangeWidth: 300, sectionDepth: 390, flangeThickness: 19.0, webThickness: 11.0 },
] as const;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function findShearWallPreset(id: string): ShearWallCatalogPreset | null {
  return SHEAR_WALL_CATALOG.find((p) => p.id === id) ?? null;
}

export function findIShapePreset(id: string): IShapeCatalogPreset | null {
  return ISHAPE_CATALOG.find((p) => p.id === id) ?? null;
}
