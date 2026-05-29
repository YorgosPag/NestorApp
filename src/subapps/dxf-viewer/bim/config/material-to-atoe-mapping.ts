/**
 * BIM Material → ΑΤΟΕ Mapping SSoT (ADR-363 Phase 6.2)
 *
 * Single Source of Truth για το mapping wall-material-catalog → ΑΤΟΕ
 * category code + BOQ unit + quantity-derivation kind ('area' vs 'volume').
 *
 * Καταναλώνεται από `boq-multi-layer-builder.ts` για per-layer BOQ entries
 * όταν `WallDna.layers.length > 1` (multi-layer composite walls).
 *
 * Industry alignment: 6/6 σύγκλιση (Revit/ArchiCAD/Bentley/Tekla/Vectorworks/
 * Allplan — βλ. SPEC-3D-004D §12 Q4 RESOLVED). ΟΛΟΙ οι major BIM tools
 * παράγουν per-layer quantities (Material Takeoff Schedule pattern).
 *
 * Phase 6.2 MVP = read-only seed. Phase 6.2+ θα προσθέσει Firestore
 * collection `bim_atoe_overrides/{projectId}` για user-editable overrides.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6.2
 * @see docs/centralized-systems/reference/adrs/SPEC-3D-004D-genarc-geometry-helpers-port-catalog.md §12 Q4
 * @see src/subapps/dxf-viewer/bim/walls/wall-material-catalog.ts (mat IDs)
 */

import type { BOQMeasurementUnit } from '@/types/boq';

// ============================================================================
// TYPES
// ============================================================================

/**
 * How a layer's BOQ quantity derives από wall geometry:
 * - `'area'`   → `quantity = wallNetArea (m²)` — επιχρίσματα, μονώσεις, επενδύσεις
 * - `'volume'` → `quantity = wallNetArea × layer.thickness_m (m³)` — σκυρόδεμα, λιθοδομή
 */
export type LayerQuantityKind = 'area' | 'volume';

export interface MaterialAtoeMapping {
  /** Material library ID (πχ 'mat-plaster-ext'). Stable persisted slug. */
  readonly materialId: string;
  /** Latin OIK-x.xx code — must match boq_categories. */
  readonly categoryCode: string;
  readonly unit: BOQMeasurementUnit;
  /** Determines per-layer quantity calculation strategy. */
  readonly quantityKind: LayerQuantityKind;
  /** Greek title stored σε αυto-generated BOQ child row. */
  readonly titleEL: string;
}

// ============================================================================
// SEED MAPPING TABLE
// ============================================================================

/**
 * Seed table aligned με wall-material-catalog presets (18 IDs).
 * ΟΙΚ codes per Ελληνικό Τιμολόγιο ΑΤΟΕ:
 *   - ΟΙΚ-2 Σκυροδέματα (m³)
 *   - ΟΙΚ-3 Τοιχοποιίες (m² ή m³ — ανά τύπο)
 *   - ΟΙΚ-4 Επιχρίσματα (m² per side)
 *   - ΟΙΚ-7 Επενδύσεις/Επιστρώσεις (m²)
 *   - ΟΙΚ-10 Μονώσεις/Στεγανώσεις (m²)
 *   - ΟΙΚ-12 Μεταλλικά/Ειδικές κατασκευές (m²)
 */
const MATERIAL_MAPPING: Readonly<Record<string, MaterialAtoeMapping>> = {
  // ΟΙΚ-2 Σκυροδέματα (volume)
  'mat-concrete-c20': { materialId: 'mat-concrete-c20', categoryCode: 'OIK-2.03', unit: 'm3', quantityKind: 'volume', titleEL: 'Σκυρόδεμα C20/25 (BIM layer)' },
  'mat-concrete-c25': { materialId: 'mat-concrete-c25', categoryCode: 'OIK-2.03', unit: 'm3', quantityKind: 'volume', titleEL: 'Σκυρόδεμα C25/30 (BIM layer)' },
  'mat-concrete-c30': { materialId: 'mat-concrete-c30', categoryCode: 'OIK-2.03', unit: 'm3', quantityKind: 'volume', titleEL: 'Σκυρόδεμα C30/37 (BIM layer)' },

  // ΟΙΚ-3 Τοιχοποιίες
  'mat-brick-masonry':  { materialId: 'mat-brick-masonry',  categoryCode: 'OIK-3.01', unit: 'm2', quantityKind: 'area',   titleEL: 'Οπτοπλινθοδομή μπατική (BIM layer)' },
  'mat-stone-masonry':  { materialId: 'mat-stone-masonry',  categoryCode: 'OIK-3.05', unit: 'm3', quantityKind: 'volume', titleEL: 'Λιθοδομή (BIM layer)' },
  'mat-concrete-block': { materialId: 'mat-concrete-block', categoryCode: 'OIK-3.02', unit: 'm2', quantityKind: 'area',   titleEL: 'Τοιχοποιία τσιμεντόλιθων (BIM layer)' },

  // ΟΙΚ-4 Επιχρίσματα (area, one side per layer)
  'mat-plaster-int':     { materialId: 'mat-plaster-int',     categoryCode: 'OIK-4.01', unit: 'm2', quantityKind: 'area', titleEL: 'Επίχρισμα εσωτερικό (BIM layer)' },
  'mat-plaster-ext':     { materialId: 'mat-plaster-ext',     categoryCode: 'OIK-4.03', unit: 'm2', quantityKind: 'area', titleEL: 'Επίχρισμα εξωτερικό (BIM layer)' },
  'mat-plaster-thermal': { materialId: 'mat-plaster-thermal', categoryCode: 'OIK-4.10', unit: 'm2', quantityKind: 'area', titleEL: 'Θερμοεπίχρισμα (BIM layer)' },

  // ΟΙΚ-7 Επενδύσεις/Επιστρώσεις (area)
  'mat-gypsum-board': { materialId: 'mat-gypsum-board', categoryCode: 'OIK-7.05', unit: 'm2', quantityKind: 'area', titleEL: 'Γυψοσανίδα (BIM layer)' },
  'mat-osb':          { materialId: 'mat-osb',          categoryCode: 'OIK-7.10', unit: 'm2', quantityKind: 'area', titleEL: 'Πλάκα OSB (BIM layer)' },
  'mat-tile':         { materialId: 'mat-tile',         categoryCode: 'OIK-7.20', unit: 'm2', quantityKind: 'area', titleEL: 'Πλακάκι κεραμικό (BIM layer)' },
  'mat-marble':       { materialId: 'mat-marble',       categoryCode: 'OIK-7.30', unit: 'm2', quantityKind: 'area', titleEL: 'Μάρμαρο (BIM layer)' },

  // ΟΙΚ-10 Μονώσεις/Στεγανώσεις (area)
  'mat-eps':           { materialId: 'mat-eps',           categoryCode: 'OIK-10.05', unit: 'm2', quantityKind: 'area', titleEL: 'Θερμομόνωση EPS (BIM layer)' },
  // ADR-396 P1 — Γραφιτούχα EPS (Neopor) ETICS κέλυφος· ίδιο ΑΤΟΕ άρθρο με γενικό EPS (OQ-2 RESOLVED 2026-05-29)
  'mat-eps-graphite':  { materialId: 'mat-eps-graphite',  categoryCode: 'OIK-10.05', unit: 'm2', quantityKind: 'area', titleEL: 'Θερμομόνωση γραφιτούχας EPS / Neopor (BIM layer)' },
  'mat-xps':           { materialId: 'mat-xps',           categoryCode: 'OIK-10.05', unit: 'm2', quantityKind: 'area', titleEL: 'Θερμομόνωση XPS (BIM layer)' },
  'mat-mineral-wool':  { materialId: 'mat-mineral-wool',  categoryCode: 'OIK-10.06', unit: 'm2', quantityKind: 'area', titleEL: 'Θερμομόνωση πετροβάμβακα (BIM layer)' },
  'mat-vapor-barrier': { materialId: 'mat-vapor-barrier', categoryCode: 'OIK-10.10', unit: 'm2', quantityKind: 'area', titleEL: 'Φράγμα υδρατμών (BIM layer)' },

  // ΟΙΚ-12 Ειδικές κατασκευές (area)
  'mat-aluminum-cladding': { materialId: 'mat-aluminum-cladding', categoryCode: 'OIK-12.10', unit: 'm2', quantityKind: 'area', titleEL: 'Επένδυση αλουμινίου (BIM layer)' },
};

/** Lookup map exposed για test coverage assertions. */
export const MATERIAL_TO_ATOE_MAPPING = MATERIAL_MAPPING;

// ============================================================================
// RESOLVER
// ============================================================================

/**
 * Resolve the ΑΤΟΕ mapping για ένα materialId.
 *
 * @param materialId  WallDnaLayer.materialId (πχ 'mat-plaster-ext'). Custom
 *                    user-typed strings που δεν είναι presets → null.
 * @returns MaterialAtoeMapping or null όταν materialId unknown/empty.
 */
export function resolveMaterialAtoeMapping(materialId: string | undefined): MaterialAtoeMapping | null {
  if (!materialId) return null;
  return MATERIAL_MAPPING[materialId] ?? null;
}
