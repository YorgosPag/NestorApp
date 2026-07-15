/**
 * placement-overlay-fields — SSoT για το **σύνολο** των overlay-meta πεδίων που προσαρτά το
 * placement ghost (`assemblePlacementGhost`) στο `ExtendedSceneEntity`: μαγνητικό πλέγμα
 * (πολικό/καρτεσιανό), δυναμικές διαστάσεις (listening / dx-dy / R-θ), γραμμή(ές)-οδηγός
 * ευθυγράμμισης, **και τα live HUD meta** (τοίχος/δοκάρι · κολόνα · πέδιλο).
 *
 * Πριν (ADR-544 audit, Giorgio), το ίδιο σύνολο πεδίων διαβαζόταν με **inline structural casts**
 * σε ΔΥΟ σημεία — 2D `drawing-hover-handler` και 3D `placement-overlay-meta` — δηλαδή η γνώση
 * «ποια πεδία φέρει το ghost» ήταν διπλή. Τώρα ζει εδώ, μία φορά· και οι δύο readers κάνουν
 * `entity as PlacementOverlayFields`. Μηδέν διπλότυπη γνώση πεδίων.
 *
 * **ADR-663 §4 part 4 — ολοκλήρωση του ADR-544 (Giorgio).** Το αρχικό audit κάλυψε μόνο τα 4
 * πεδία πλέγματος/διαστάσεων/οδηγού· τα **HUD** πεδία έμειναν εκτός, κι έτσι το ίδιο ακριβώς
 * αντι-μοτίβο επέζησε: κάθε reader τα διάβαζε με **inline cast που ξανα-δήλωνε το σχήμα**
 * (`drawing-hover-overlays` ×4, `WallPlacementGhost`, `wall-joint-miter-preview`), και οι δύο
 * writers (`attachColumnHud` / `attachFoundationPadHud` — δίδυμα) έκαναν
 * `{ ...ghost, xHud } as ExtendedSceneEntity`, cast που το TS απέρριπτε (2× TS2352: «neither type
 * sufficiently overlaps»), γιατί **το `ExtendedSceneEntity` δεν δηλώνει κανένα** ghost-meta πεδίο.
 * Πλέον τα HUD πεδία ζουν κι αυτά **εδώ**: ένας τύπος, readers ΚΑΙ writers, μηδέν type-lie.
 *
 * @see ./placement-grid-meta.ts — buildPlacementGridMeta (παράγει polar/rect grid)
 * @see ./placement-ghost-assembly.ts — assemblePlacementGhost (προσαρτά τα πεδία)
 * @see ../../hooks/drawing/drawing-hover-overlays.ts · ../../bim-3d/placement/placement-overlay-meta.ts — readers
 * @see ../../hooks/drawing/column-preview-helpers.ts · ../../hooks/drawing/foundation-preview-helpers.ts — HUD writers
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from '../../hooks/drawing/drawing-types';
import type { PolarDiskGrid } from '../columns/polar-disk-snap';
import type { RectGrid } from '../columns/rect-cartesian-snap';
import type { GhostFaceDimensionsMeta } from '../framing/ghost-face-dim-references';
import type { PlacementAlignmentGuide } from '../framing/placement-alignment-guide';
import type { ColumnParams } from '../types/column-types';
import type { WallHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';
import type { FootprintHudDescriptor } from '../../canvas-v2/preview-canvas/column-hud-paint';
import type { GhostStatusColor } from '../ghosts/ghost-status-color';
import type { OpeningConflictMeta } from '../../hooks/drawing/wysiwyg-preview-shared';

/**
 * ADR-564 §footprint-hud — τα δεδομένα που χρειάζεται ο `paintColumnHud`: footprint κορυφές +
 * τα ίδια τα `ColumnParams` (kind/width/depth/rotation/height). Ζουν ΗΔΗ στο ghost (`ColumnEntity`)
 * → απλή αναφορά, μηδέν αντιγραφή γεωμετρίας.
 */
export interface ColumnHudMeta {
  readonly footprint: readonly Point2D[];
  readonly params: ColumnParams;
}

/**
 * ADR-564 §foundation-hud — ΙΔΙΟΣ pure painter με την κολόνα (`paintFootprintHud`), αλλά μέσω
 * ελάχιστου entity-agnostic descriptor: το πέδιλο έχει `FoundationParams`, όχι `ColumnParams`.
 * Η ετικέτα βάθους έρχεται **προ-μεταφρασμένη** (ο painter μένει pure — numbers/strings in, N.11).
 */
export interface FootprintHudMeta {
  readonly footprint: readonly Point2D[];
  readonly descriptor: FootprintHudDescriptor;
  readonly heightSpecLabel: string;
}

/** Τα overlay-meta πεδία ενός preview ghost (όλα optional — προσαρτώνται μόνο όταν ισχύουν). */
export interface PlacementOverlayFields {
  /** ADR-398 §3.13 — πολικό μαγνητικό πλέγμα (Polar Magnet, cursor μέσα σε δίσκο). */
  readonly polarDiskGrid?: PolarDiskGrid;
  /** ADR-398 §3.15 — καρτεσιανό μαγνητικό πλέγμα (Cartesian Magnet, cursor μέσα σε ορθογώνιο). */
  readonly rectGrid?: RectGrid;
  /** ADR-508 §dim — δυναμικές διαστάσεις (listening / dx-dy / R-θ) κατά μήκος της παρειάς. */
  readonly faceDimensions?: GhostFaceDimensionsMeta;
  /** ADR-398 §3.20 — γραμμή(ές)-οδηγός ευθυγράμμισης (έως 2 στη γωνία). */
  readonly alignmentGuide?: PlacementAlignmentGuide | readonly PlacementAlignmentGuide[];
  /** ADR-508 §wall-hud — ζωντανή ταυτότητα γραμμικού μέλους (τοίχος/δοκάρι/γραμμικό πέδιλο). */
  readonly wallHud?: WallHudMeta;
  /**
   * ADR-564 §linear-hud — προ-μεταφρασμένη ετικέτα spec ανά μέλος (π.χ. δοκάρι «b·h»). Όταν
   * λείπει, ο reader πέφτει πίσω στην ετικέτα τοίχου (`buildWallHudSpecLabel`).
   */
  readonly hudSpecLabel?: string;
  /** ADR-564 §footprint-hud — κολόνα: live πλάτος/βάθος ανά παρειά + ∠ γωνία + ύψος. */
  readonly columnHud?: ColumnHudMeta;
  /** ADR-564 §foundation-hud — πέδιλο-pad: ΙΔΙΟΣ painter με την κολόνα, entity-agnostic seam. */
  readonly footprintHud?: FootprintHudMeta;
  /**
   * ADR-398 §3.8 — το ghost είναι πλήρης BIM οντότητα (`.params`+`.geometry`) → ο `PreviewCanvas`
   * τη ρεντάρει μέσω των ΠΡΑΓΜΑΤΙΚΩΝ renderers (full fidelity), όχι πράσινο περίγραμμα.
   */
  readonly wysiwygPreview?: boolean;
  /** ADR-398 §3.6 — 🔴 overlap: ο `PreviewRenderer` ζωγραφίζει status schematic αντί WYSIWYG. */
  readonly ghostStatusColor?: GhostStatusColor | null;
  /** ADR-508 §opening-conflict — ζώνη σύγκρουσης (mm) όταν κάθετος τοίχος κόβει άνοιγμα host. */
  readonly openingConflict?: OpeningConflictMeta;
}

/**
 * Ένα preview ghost **μαζί** με τα overlay-meta πεδία του. Οι writers που προσαρτούν meta
 * (π.χ. `attachColumnHud`) επιστρέφουν αυτόν τον τύπο αντί για cast σε σκέτο `ExtendedSceneEntity`
 * — είναι υπο-τύπος του, οπότε περνά αυτούσιος σε κάθε καταναλωτή ghost (ADR-663 §4 part 4).
 */
export type PlacementGhostEntity = ExtendedSceneEntity & PlacementOverlayFields;
