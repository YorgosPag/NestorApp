/**
 * Construction materials — SSoT for the «material browser» built-ins (ADR-416/417).
 *
 * THE ONE ordered list of built-in construction materials selectable as a DNA
 * build-up layer material (slab / roof) OR a monolithic element material. Every
 * material picker — `SlabDnaEditor` (per-layer) and `EditRoofTypeDialog` (monolithic
 * roof material) — renders THIS list, instead of each hardcoding its own copy
 * (which previously drifted: the roof dialog had a separate `rc`/`tile`/`wood`
 * vocabulary that did NOT map to the 3D material catalog).
 *
 * Each id is a `MATERIAL_DEFS` key, so it drives BOTH the colour/3D appearance
 * (`getMaterial3D` → texture slug) AND the 2D swatch (`MaterialSwatch`). The
 * friendly display name (Revit material-browser label) lives in i18n under
 * `constructionMaterials.<id>` (dxf-viewer-shell namespace) — one place, EL+EN.
 *
 * Types/data file (size-exempt): no runtime logic beyond a pure lookup.
 *
 * @see ./material-catalog-defs.ts — the colour/3D defs behind each id
 * @see ./bim-texture-registry.ts — id → PBR texture slug
 * @see ../../ui/ribbon/components/SlabDnaEditor.tsx — per-layer consumer
 * @see ../../ui/ribbon/components/EditRoofTypeDialog.tsx — monolithic consumer
 */

/**
 * Ordered built-in construction materials (Revit material-browser built-ins). The
 * order is the dropdown order; roofing-relevant covers (tile / roof-tile) sit near
 * the structural/finish materials. Each value is a `MATERIAL_DEFS` key.
 */
export const CONSTRUCTION_MATERIAL_IDS = [
  'mat-concrete',
  'mat-screed',
  'mat-insulation',
  'mat-tile',
  'mat-roof-tile',
  'mat-plaster',
  'mat-membrane',
  'mat-gravel',
  'mat-finish',
  'mat-wood',
  'mat-metal',
] as const;

export type ConstructionMaterialId = (typeof CONSTRUCTION_MATERIAL_IDS)[number];

/** Is this id one of the built-in construction materials (vs a custom/library id)? */
export function isConstructionMaterialId(materialId: string): boolean {
  return (CONSTRUCTION_MATERIAL_IDS as readonly string[]).includes(materialId);
}

/**
 * The i18n key (dxf-viewer-shell namespace) for a material's friendly display name.
 * `constructionMaterials.mat-roof-tile` → «Κεραμίδι στέγης» / «Roof Tile».
 */
export function constructionMaterialLabelKey(materialId: string): string {
  return `constructionMaterials.${materialId}`;
}
