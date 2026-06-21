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

import { isInsulationMaterial } from '../walls/wall-material-catalog';

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

/**
 * ADR-447/449 X4 — Εξωτερικός τοίχος (Revit-grade Greek default): **ΜΟΝΟ δομικός
 * πυρήνας** = ΚΟΚΚΙΝΟ διάτρητο τούβλο (μπατικό) 210 mm. Greek RC-frame infill masonry.
 *
 * ADR-449 Slice X4 — ο σοβάς **ΔΕΝ** είναι πια DNA layer: είναι additive finish skin
 * (`WallParams.finish`, mirror κολόνας/δοκαριού) που **προεξέχει** από τον πυρήνα μέσω
 * της ενιαίας structural-finish σιλουέτας (εξωτ. 25 + εσωτ. 15 = το ίδιο 250mm οπτικό
 * σύνολο όπως πριν, αλλά ΕΝΑ representation, χωρίς διπλό σοβά). Το DNA κρατά μόνο
 * δομικό + μόνωση.
 */
export function createDefaultExteriorDna(): WallDna {
  const layers: readonly WallDnaLayer[] = [
    { id: 'ext-core', name: 'Brick Masonry', thickness: 210, materialId: 'mat-brick-masonry', side: 'core' },
  ];
  return { layers, totalThickness: computeTotalThickness(layers) };
}

/**
 * ADR-447/449 X4 — Εξωτερικός ΜΕ ΘΕΡΜΟΠΡΟΣΟΨΗ (ETICS): EPS 100 (μόνωση, εξωτ. παρειά) +
 * τούβλο 210 = 310 mm δομικός+μόνωση. Ο σοβάς (finish skin) πάει ΕΞΩ από το EPS (σωστή
 * ETICS σειρά: τούβλο → EPS → σοβάς). Η μόνωση μένει DNA layer → ο τοίχος εξαιρείται από
 * το auto building-envelope (ADR-396) μέσω {@link wallHasExteriorInsulation}.
 */
export function createExterior25EpsDna(): WallDna {
  const layers: readonly WallDnaLayer[] = [
    { id: 'ext-eps', name: 'EPS Insulation', thickness: 100, materialId: 'mat-eps', side: 'exterior' },
    { id: 'ext-core', name: 'Brick Masonry', thickness: 210, materialId: 'mat-brick-masonry', side: 'core' },
  ];
  return { layers, totalThickness: computeTotalThickness(layers) };
}

/** ADR-447/449 X4 — Εξωτερικός 20cm: ΜΟΝΟ δομικός πυρήνας τούβλο 160 mm (σοβάς = finish skin). */
export function createExterior20Dna(): WallDna {
  const layers: readonly WallDnaLayer[] = [
    { id: 'ext-core', name: 'Brick Masonry', thickness: 160, materialId: 'mat-brick-masonry', side: 'core' },
  ];
  return { layers, totalThickness: computeTotalThickness(layers) };
}

/**
 * ADR-447/449 X4 — Εσωτερικός διαχωριστικός: ΜΟΝΟ δομικός πυρήνας ΚΟΚΚΙΝΟ τούβλο 70 mm.
 * Ο σοβάς (Knauf, 15 ανά παρειά) = finish skin και στις δύο παρειές (εσωτερικές → 15).
 */
export function createDefaultInteriorDna(): WallDna {
  const layers: readonly WallDnaLayer[] = [
    { id: 'int-core', name: 'Brick Masonry', thickness: 70, materialId: 'mat-brick-masonry', side: 'core' },
  ];
  return { layers, totalThickness: computeTotalThickness(layers) };
}

/** ADR-447/449 X4 — Partition: ΜΟΝΟ δομικός πυρήνας τούβλο 75 mm (σοβάς = finish skin). */
export function createDefaultPartitionDna(): WallDna {
  const layers: readonly WallDnaLayer[] = [
    { id: 'part-core', name: 'Brick Masonry', thickness: 75, materialId: 'mat-brick-masonry', side: 'core' },
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

/** Default DNA preset per category (SSoT lookup — returns the PRIMARY seed). */
export function getDefaultDnaForCategory(category: WallCategory): WallDna {
  switch (category) {
    case 'exterior': return createDefaultExteriorDna();
    case 'interior': return createDefaultInteriorDna();
    case 'partition': return createDefaultPartitionDna();
    case 'parapet': return createDefaultParapetDna();
    case 'fence': return createDefaultFenceDna();
  }
}

// ─── ADR-447 — Built-in wall TYPE seed catalog (multiple types/category) ──────

/**
 * One built-in wall type seed. `key` is the stable technical suffix for the
 * deterministic id (`bimftype-builtin-wall-<key>`) + the i18n name
 * (`builtin.wall.<key>`). For the PRIMARY seed of a category `key === category`,
 * so its id is byte-identical to the pre-ADR-447 single-per-category id → existing
 * persisted `typeId`s keep resolving.
 */
export interface WallTypeSeed {
  readonly key: string;
  readonly category: WallCategory;
  readonly dna: WallDna;
}

/**
 * ADR-447 — the factory wall-type catalog (Revit «Basic Wall» types). Multiple
 * types per category (exterior: 25cm / 25cm+θερμοπρόσοψη / 20cm), keyed by a stable
 * technical key. The PRIMARY of each category (key===category) keeps the legacy id.
 * Deterministic (built once at module load, no time/random) — `built-in-types.ts`
 * iterates this; `wall-type-auto-assign.ts` matches a drawn wall's DNA against it.
 */
export const WALL_TYPE_SEEDS: readonly WallTypeSeed[] = [
  { key: 'exterior', category: 'exterior', dna: createDefaultExteriorDna() },
  { key: 'exterior-eps', category: 'exterior', dna: createExterior25EpsDna() },
  { key: 'exterior-20', category: 'exterior', dna: createExterior20Dna() },
  { key: 'interior', category: 'interior', dna: createDefaultInteriorDna() },
  { key: 'partition', category: 'partition', dna: createDefaultPartitionDna() },
  { key: 'parapet', category: 'parapet', dna: createDefaultParapetDna() },
  { key: 'fence', category: 'fence', dna: createDefaultFenceDna() },
];

/**
 * ADR-447 — true when a wall's DNA already carries ETICS-class insulation on its
 * EXTERIOR side (e.g. the «25cm με θερμοπρόσοψη» type). Such a wall is the SSoT of
 * its own insulation, so the ADR-396 building envelope must NOT wrap it again
 * (`envelope-shell.ts` treats it like an `envelopeFunction:'interior'` force-off).
 */
export function wallHasExteriorInsulation(dna?: WallDna | null): boolean {
  if (!dna) return false;
  return dna.layers.some((l) => l.side === 'exterior' && isInsulationMaterial(l.materialId));
}

/**
 * Single-layer «Generic» cross-section for an arbitrary thickness (Revit «Generic
 * Wall» pattern) — SSoT for the auto-type-on-create flow (ADR-412). One `core`
 * layer of the requested `thicknessMm`, inheriting the category default's core
 * material so the generic wall renders with a sensible structural material. The
 * layer `name` is internal storage data (mirrors the literal layer names above —
 * not a user-facing i18n string), so it is left as a stable English label.
 *
 * @param category    Drives the inherited core material (concrete / brick / …).
 * @param thicknessMm Total (and sole layer) thickness in mm.
 * @see ./bim-family-type.ts §BimFamilyTypeOrigin 'auto'
 * @see ../family-types/auto-wall-type.ts §buildAutoWallType
 */
export function buildGenericWallDna(category: WallCategory, thicknessMm: number): WallDna {
  const def = getDefaultDnaForCategory(category);
  const core = def.layers.find((l) => l.side === 'core') ?? def.layers[0];
  const layers: readonly WallDnaLayer[] = [
    { id: 'generic-core', name: 'Structure', thickness: thicknessMm, materialId: core.materialId, side: 'core' },
  ];
  return { layers, totalThickness: thicknessMm };
}

// Forward type import — declared in wall-types.ts; re-imported here for the
// `getDefaultDnaForCategory()` signature. Circular-safe via `import type`.
import type { WallCategory } from './wall-types';
