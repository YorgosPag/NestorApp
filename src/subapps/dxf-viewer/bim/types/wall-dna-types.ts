/**
 * BIM Wall DNA — layered cross-section composition (ADR-363 §5.3, Phase 1).
 *
 * Port από `C:/genarc/src/types/wallDna.types.ts` με μετατροπή μονάδων m → mm
 * (Nestor convention, ίδιο με stair ADR-358 §5.0). Κάθε wall συντίθεται από
 * ordered layers (εξωτερικός σοβάς → φέρων → εσωτερικός σοβάς).
 *
 * SSoT: `WallParams.thickness` derived from `WallDna.totalThickness` όταν dna
 * παρέχεται — το πάχος ΔΕΝ διπλο-καταχωρείται.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3
 */

/** Side of the wall this layer belongs to. */
export type WallLayerSide = 'exterior' | 'core' | 'interior';

/** Single layer in the wall cross-section. Thickness in mm. */
export interface WallDnaLayer {
  readonly id: string;
  readonly name: string;
  /** mm */
  readonly thickness: number;
  /** Material library ID (full material catalog lands Phase 6+). */
  readonly materialId: string;
  readonly side: WallLayerSide;
}

/** Complete wall DNA — ordered layers + computed total thickness. */
export interface WallDna {
  readonly layers: readonly WallDnaLayer[];
  /** mm — sum of layer thicknesses (SSoT). */
  readonly totalThickness: number;
}

/** Total thickness from layers (SSoT helper). */
export function computeTotalThickness(layers: readonly WallDnaLayer[]): number {
  return layers.reduce((sum, layer) => sum + layer.thickness, 0);
}

// ─── Default DNA presets (mm) ───────────────────────────────────────────────

/** Exterior wall: plaster 20 + reinforced concrete 210 + plaster 20 = 250 mm. */
export function createDefaultExteriorDna(): WallDna {
  const layers: readonly WallDnaLayer[] = [
    { id: 'ext-plaster-out', name: 'Exterior Plaster', thickness: 20, materialId: 'mat-plaster-ext', side: 'exterior' },
    { id: 'ext-core', name: 'Reinforced Concrete', thickness: 210, materialId: 'mat-concrete-c25', side: 'core' },
    { id: 'ext-plaster-in', name: 'Interior Plaster', thickness: 20, materialId: 'mat-plaster-int', side: 'interior' },
  ];
  return { layers, totalThickness: computeTotalThickness(layers) };
}

/** Interior wall: plaster 15 + brick 70 + plaster 15 = 100 mm. */
export function createDefaultInteriorDna(): WallDna {
  const layers: readonly WallDnaLayer[] = [
    { id: 'int-plaster-a', name: 'Plaster A', thickness: 15, materialId: 'mat-plaster-int', side: 'exterior' },
    { id: 'int-core', name: 'Brick Masonry', thickness: 70, materialId: 'mat-brick-masonry', side: 'core' },
    { id: 'int-plaster-b', name: 'Plaster B', thickness: 15, materialId: 'mat-plaster-int', side: 'interior' },
  ];
  return { layers, totalThickness: computeTotalThickness(layers) };
}

/** Partition wall: plaster 12.5 + brick 75 + plaster 12.5 = 100 mm. */
export function createDefaultPartitionDna(): WallDna {
  const layers: readonly WallDnaLayer[] = [
    { id: 'part-plaster-a', name: 'Plaster A', thickness: 12.5, materialId: 'mat-plaster-int', side: 'exterior' },
    { id: 'part-core', name: 'Brick Masonry', thickness: 75, materialId: 'mat-brick-masonry', side: 'core' },
    { id: 'part-plaster-b', name: 'Plaster B', thickness: 12.5, materialId: 'mat-plaster-int', side: 'interior' },
  ];
  return { layers, totalThickness: computeTotalThickness(layers) };
}

/** Parapet wall: reinforced concrete 150 mm (single layer). */
export function createDefaultParapetDna(): WallDna {
  const layers: readonly WallDnaLayer[] = [
    { id: 'parapet-core', name: 'Reinforced Concrete', thickness: 150, materialId: 'mat-concrete-c25', side: 'core' },
  ];
  return { layers, totalThickness: computeTotalThickness(layers) };
}

/** Fence wall: stone masonry 500 mm (single layer). */
export function createDefaultFenceDna(): WallDna {
  const layers: readonly WallDnaLayer[] = [
    { id: 'fence-core', name: 'Stone Masonry', thickness: 500, materialId: 'mat-stone-masonry', side: 'core' },
  ];
  return { layers, totalThickness: computeTotalThickness(layers) };
}

/** Default DNA preset per category (SSoT lookup). */
export function getDefaultDnaForCategory(category: WallCategory): WallDna {
  switch (category) {
    case 'exterior': return createDefaultExteriorDna();
    case 'interior': return createDefaultInteriorDna();
    case 'partition': return createDefaultPartitionDna();
    case 'parapet': return createDefaultParapetDna();
    case 'fence': return createDefaultFenceDna();
  }
}

// Forward type import — declared in wall-types.ts; re-imported here for the
// `getDefaultDnaForCategory()` signature. Circular-safe via `import type`.
import type { WallCategory } from './wall-types';
