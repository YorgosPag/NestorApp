/**
 * ADR-396 v2 Φάση 6b — Per-region `envelopeFunction` override (PURE SSoT + batch
 * command builder).
 *
 * Χαρτογραφεί τα **ανιχνευμένα όρια** ενός ορόφου (έξοδος
 * `classifyFootprintRegions`, §3.1.2) σε **καταχωρητέους στόχους**: για κάθε ring
 * τα distinct `edges[].sourceEntityId` = τα δομικά στοιχεία (τοίχοι/κολώνες/δοκάρια)
 * που σχηματίζουν εκείνο το όριο. Το per-region panel του `ThermalEnvelopeDialog`
 * (Φ6b) εμφανίζει αυτούς τους στόχους και, όταν ο χρήστης αλλάζει το dropdown
 * override ανά region, γράφει το `envelopeFunction` σε **ΟΛΑ** τα στοιχεία του ορίου.
 *
 * **Write path (Revit parity — απόφαση Giorgio):** ένα `CompoundCommand` από
 * `UpdateWall/Column/BeamParamsCommand` ανά στοιχείο → **ΕΝΑ undo entry** ανά
 * εφαρμογή region override, undoable + atomic geometry/validation recompute δωρεάν.
 * Όλα γράφουν στο ΙΔΙΟ πεδίο `envelopeFunction` (όπως το per-element ribbon Φ6a) →
 * **«last write wins»** όταν ένα στοιχείο ανήκει σε 2 όρια (απλό, προβλέψιμο, ζωντανό
 * + undo). Ο `computeEnvelopeShell` καταναλώνει ήδη το override (`collectEnvelopeOverrides`,
 * Φ5B) — η Φ6b δεν αγγίζει τη γεωμετρία του κελύφους.
 *
 * Pure ως προς το mapping (`buildRegionOverrideTargets`)· το command builder
 * δουλεύει πάνω σε `ISceneManager` (test-friendly με mock). Μηδέν React/Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1.8
 * @see ../geometry/footprint-region-classifier (region detection)
 * @see ../geometry/envelope-shell (collectEnvelopeOverrides — current state read)
 */

import type { EnvelopeFunction } from '../types/thermal-envelope-types';
import type {
  FootprintClassificationResult,
  RegionEnvelopeRole,
} from '../geometry/footprint-region-classifier';
import type { FootprintRing } from '../geometry/building-footprint';
import type { ICommand, ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateColumnParamsCommand } from '../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateBeamParamsCommand } from '../../core/commands/entity-commands/UpdateBeamParamsCommand';
import type { WallKind, WallParams } from '../types/wall-types';
import type { ColumnParams } from '../types/column-types';
import type { BeamParams } from '../types/beam-types';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * Τρέχουσα τιμή override ενός region: ομοιόμορφη τιμή (auto = `undefined`,
 * `'exterior'`, `'interior'`) ή `'mixed'` όταν τα στοιχεία του ορίου διαφέρουν.
 */
export type RegionOverrideState = EnvelopeFunction | 'mixed' | undefined;

/** Ένα ανιχνευμένο όριο ορόφου ως καταχωρητέος στόχος override. */
export interface RegionOverrideTarget {
  /** Σταθερό κλειδί (role + ordinal) για React + dropdown. */
  readonly regionId: string;
  readonly role: RegionEnvelopeRole;
  /** 1-based αύξων αριθμός μέσα στον ίδιο role (π.χ. «Αίθριο 2»). */
  readonly ordinal: number;
  /** Distinct `sourceEntityId` (≠ null) που σχηματίζουν το όριο — αυτά γράφονται. */
  readonly elementIds: readonly string[];
  /** Τρέχουσα ομοιόμορφη τιμή override, ή `'mixed'`. */
  readonly currentFn: RegionOverrideState;
}

// ============================================================================
// TARGET MAPPING (pure)
// ============================================================================

/** Distinct μη-null `sourceEntityId` των ακμών ενός ring. */
function distinctElementIds(ring: FootprintRing): string[] {
  const seen = new Set<string>();
  for (const edge of ring.edges) {
    if (edge.sourceEntityId) seen.add(edge.sourceEntityId);
  }
  return [...seen];
}

/**
 * Τρέχουσα κατάσταση override ενός ορίου: ομοιόμορφη τιμή αν όλα τα στοιχεία
 * συμφωνούν (συμπερ. «όλα auto» = `undefined`), αλλιώς `'mixed'`.
 */
function resolveCurrentFn(
  ids: readonly string[],
  overrides: ReadonlyMap<string, EnvelopeFunction>,
): RegionOverrideState {
  let first: EnvelopeFunction | undefined;
  let firstSet = false;
  for (const id of ids) {
    const value = overrides.get(id); // EnvelopeFunction | undefined (auto)
    if (!firstSet) {
      first = value;
      firstSet = true;
    } else if (value !== first) {
      return 'mixed';
    }
  }
  return first;
}

/**
 * Χτίζει τους στόχους override ανά ανιχνευμένο όριο. Παραλείπει rings χωρίς κανένα
 * αποδοσμένο στοιχείο (μόνο κορυφές τομής → τίποτα να γράψεις). Ο `ordinal` μετράει
 * ανά role ώστε το UI να δείχνει «Αίθριο 1 / 2», «Δωμάτιο 1» κ.λπ.
 *
 * @param overrides - τρέχοντα per-element overrides (`collectEnvelopeOverrides`).
 */
export function buildRegionOverrideTargets(
  classification: FootprintClassificationResult,
  overrides: ReadonlyMap<string, EnvelopeFunction>,
): RegionOverrideTarget[] {
  const counters = new Map<RegionEnvelopeRole, number>();
  const out: RegionOverrideTarget[] = [];
  for (const classified of classification.rings) {
    const elementIds = distinctElementIds(classified.ring);
    if (elementIds.length === 0) continue;
    const ordinal = (counters.get(classified.role) ?? 0) + 1;
    counters.set(classified.role, ordinal);
    out.push({
      regionId: `${classified.role}-${ordinal}`,
      role: classified.role,
      ordinal,
      elementIds,
      currentFn: resolveCurrentFn(elementIds, overrides),
    });
  }
  return out;
}

// ============================================================================
// WRITE PATH (batch CompoundCommand → single undo step)
// ============================================================================

/**
 * Φτιάχνει το per-element `UpdateXParamsCommand` που γράφει το `envelopeFunction`
 * (ή το καθαρίζει με `fn === undefined`). Μη-υποστηριζόμενος τύπος (slab/opening/…)
 * → `null` (το `envelopeFunction` ζει μόνο σε τοίχο/κολώνα/δοκάρι, Φ4 §3.1.3).
 * Mirror του `bim-bulk-update-builder` per-kind dispatch (SSoT pattern, ΟΧΙ `any`).
 */
function buildElementOverrideCommand(
  entity: SceneEntity,
  fn: EnvelopeFunction | undefined,
  sceneManager: ISceneManager,
): ICommand | null {
  switch (entity.type) {
    case 'wall': {
      const prev = entity.params as WallParams | undefined;
      if (!prev) return null;
      const kind = (entity as unknown as { kind?: WallKind }).kind ?? 'straight';
      const next: WallParams = { ...prev, envelopeFunction: fn };
      return new UpdateWallParamsCommand(entity.id, next, prev, sceneManager, false, kind);
    }
    case 'column': {
      const prev = entity.params as ColumnParams | undefined;
      if (!prev) return null;
      const next: ColumnParams = { ...prev, envelopeFunction: fn };
      return new UpdateColumnParamsCommand(entity.id, next, prev, sceneManager, false);
    }
    case 'beam': {
      const prev = entity.params as BeamParams | undefined;
      if (!prev) return null;
      const next: BeamParams = { ...prev, envelopeFunction: fn };
      return new UpdateBeamParamsCommand(entity.id, next, prev, sceneManager, false);
    }
    default:
      return null;
  }
}

/**
 * Χτίζει `CompoundCommand` που γράφει το `envelopeFunction = fn` (ή clear) σε ΟΛΑ
 * τα `elementIds` ενός ορίου ως **ΕΝΑ undo entry**. Στοιχεία που λείπουν από το
 * scene (race) ή μη-υποστηριζόμενου τύπου → παραλείπονται σιωπηλά. Ο caller καλεί
 * `commandHistory.execute(cmd)` (το command ΔΕΝ εκτελείται εδώ). Κενό → no-op execute.
 */
export function buildRegionOverrideCommand(
  elementIds: readonly string[],
  fn: EnvelopeFunction | undefined,
  sceneManager: ISceneManager,
): CompoundCommand {
  const commands: ICommand[] = [];
  for (const id of elementIds) {
    const entity = sceneManager.getEntity(id);
    if (!entity) continue;
    const cmd = buildElementOverrideCommand(entity, fn, sceneManager);
    if (cmd) commands.push(cmd);
  }
  return new CompoundCommand(`Envelope region override (${commands.length} elements)`, commands);
}
