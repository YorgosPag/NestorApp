/**
 * ADR-684 Φ4-A — per-shape **radial** reshape grips για μη-box παραμετρικά στερεά.
 *
 * Αδελφός του `bim/columns/column-circular-adapter.ts`: plan-visible λαβές στην περιφέρεια που
 * κάνουν **symmetric radius resize περί κέντρου** (Revit/ArchiCAD plan drag-handle). Η ίδια δομή —
 * emission που γυρίζει τις λαβές του σχήματος + `apply*` που γυρίζει `null` όταν το `gripKind` δεν
 * είναι radial (ο caller κάνει fall back στον centred-box adapter για move/rotation/corner).
 *
 * ## Ποιες λαβές ανά σχήμα
 *
 * | σχήμα | λαβές |
 * |---|---|
 * | sphere / cylinder / disc / cone / prism | **1** — `generic-solid-radius` (πεδίο ακτίνας) |
 * | torus | **2** — `generic-solid-major` (ακτίνα δακτυλίου) + `generic-solid-tube` (πάχος σωλήνα) |
 * | box / pyramid | **0** — ορθογώνιο ίχνος → centred-box corners (Φ2/Φ3), ΟΧΙ εδώ |
 *
 * ## Γιατί ΟΧΙ λαβή ύψους/πάχους σε κάτοψη
 *
 * Το ύψος (και το πάχος δίσκου, οι πλευρές πρίσματος, η άνω ακτίνα κώνου) **δεν αλλάζουν το ίχνος** —
 * μια plan λαβή γι' αυτά δεν έχει καμία οπτική ανάδραση (μη-Revit-grade). Επεξεργάζονται από το
 * per-selection editor tab (Φ4-B, Properties-palette parity). Εδώ ζουν **μόνο** οι plan-visible
 * ακτινικές διαστάσεις.
 *
 * ## Ενιαία μαθηματικά (μηδέν clone)
 *
 * Κάθε radial λαβή κάθεται στον world `+X` άξονα σε απόσταση `distMm · scale` από το κέντρο (ο κύκλος/
 * δακτύλιος είναι rotationally symmetric → ο άξονας +X αρκεί, όπως το `column-circular-adapter`). Το
 * drag είναι uniform για **όλες**: `newField = clamp(oldField + delta.x / scale, MIN)` — γιατί κάθε
 * λαβή κάθεται στην κορυφή της διάστασής της, άρα Δαπόσταση = Δπεδίο. Το write-back γίνεται μέσω του
 * SSoT `updateGenericSolidShapeDimension` (immutable per-field patch).
 *
 * Μηδέν εξαρτήσεις React / DOM / Firestore / canvas.
 *
 * @see ../../columns/column-circular-adapter — το πρότυπο (circular column radius grip)
 * @see ./generic-solid-shape-defaults — updateGenericSolidShapeDimension (write-back SSoT)
 * @see ./generic-solid-grips — ο consumer (box path + fall-through)
 */

import type { GripInfo } from '../../../hooks/grip-types';
import type { GenericSolidGripKind } from '../../../hooks/grip-kinds-placeable';
import { mmScaleFor } from '../../../utils/scene-units';
import type { GenericSolidEntity, GenericSolidParams, GenericSolidShape } from './generic-solid-types';
import { MIN_GENERIC_SOLID_DIMENSION_MM } from './generic-solid-types';
import { updateGenericSolidShapeDimension } from './generic-solid-shape-defaults';

// ─── Radial-grip descriptor ανά σχήμα (SSoT) ──────────────────────────────────

/** Ο grip-kind των radial λαβών (υποσύνολο του `GenericSolidGripKind`). */
type RadialGripKind = 'generic-solid-radius' | 'generic-solid-major' | 'generic-solid-tube';

/** Μία radial λαβή: το πεδίο που επεξεργάζεται + η ακτινική απόσταση (mm) που κάθεται. */
interface RadialGripDescriptor {
  readonly kind: RadialGripKind;
  /** Το πεδίο ακτίνας του σχήματος που γράφει το drag (π.χ. `radiusMm`, `majorRadiusMm`). */
  readonly field: string;
  /** mm — η ακτινική απόσταση από το κέντρο όπου κάθεται η λαβή στην κάτοψη. */
  readonly distMm: number;
  /** Σταθερός δείκτης λαβής (πέρα από move=0/rotation=1/corners 2-5 του centred-box). */
  readonly gripIndex: number;
}

/**
 * Οι radial λαβές που εκπέμπει κάθε σχήμα. Το `distMm` της `tube` είναι `major + tube` (η εξωτερική
 * περιφέρεια του δακτυλίου) ώστε οι δύο λαβές του torus να μην συμπίπτουν· το drag όμως γράφει μόνο το
 * `tubeRadiusMm` (η `major` μένει σταθερή στο ίδιο drag → Δαπόσταση = Δtube). Box/pyramid → κενό.
 */
function radialGripsOf(shape: GenericSolidShape): readonly RadialGripDescriptor[] {
  switch (shape.kind) {
    case 'sphere':
    case 'cylinder':
    case 'disc':
    case 'prism':
      return [{ kind: 'generic-solid-radius', field: 'radiusMm', distMm: shape.radiusMm, gripIndex: 10 }];
    case 'cone':
      return [{ kind: 'generic-solid-radius', field: 'radiusBottomMm', distMm: shape.radiusBottomMm, gripIndex: 10 }];
    case 'torus':
      return [
        { kind: 'generic-solid-major', field: 'majorRadiusMm', distMm: shape.majorRadiusMm, gripIndex: 10 },
        { kind: 'generic-solid-tube', field: 'tubeRadiusMm', distMm: shape.majorRadiusMm + shape.tubeRadiusMm, gripIndex: 11 },
      ];
    case 'box':
    case 'pyramid':
      return [];
  }
}

/** Το πεδίο ακτίνας που επεξεργάζεται ένα radial `gripKind` για το δοσμένο σχήμα (ή `null`). */
function fieldForRadialKind(kind: GenericSolidGripKind, shape: GenericSolidShape): string | null {
  return radialGripsOf(shape).find((g) => g.kind === kind)?.field ?? null;
}

// ─── Emission ─────────────────────────────────────────────────────────────────

/**
 * Οι radial reshape λαβές ενός στερεού (κενό για box/pyramid). Κάθε λαβή κάθεται στον world `+X` σε
 * απόσταση `distMm · scale` από το `position` (ο κύκλος/δακτύλιος είναι συμμετρικός → ο άξονας +X
 * αρκεί, mirror `column-circular-adapter`).
 */
export function getGenericSolidShapeReshapeGrips(entity: Readonly<GenericSolidEntity>): GripInfo[] {
  const { params } = entity;
  const scale = mmScaleFor(params);
  return radialGripsOf(params.shape).map((g) => ({
    entityId: entity.id,
    gripIndex: g.gripIndex,
    type: 'vertex',
    position: { x: params.position.x + g.distMm * scale, y: params.position.y },
    movesEntity: false,
    gripKind: { on: 'generic-solid', kind: g.kind },
  }));
}

// ─── Drag transform ─────────────────────────────────────────────────────────

/**
 * Symmetric radius resize: `newField = clamp(oldField + delta.x / scale, MIN)`. Επιστρέφει `null`
 * όταν το `kind` δεν είναι radial (ή δεν αφορά το τρέχον σχήμα) → ο caller κάνει fall back στον
 * centred-box adapter (move/rotation/corner). `delta` σε scene units, πεδίο σε mm → `÷ scale`.
 */
export function applyGenericSolidShapeReshape(
  kind: GenericSolidGripKind,
  params: GenericSolidParams,
  delta: { readonly x: number; readonly y: number },
): GenericSolidParams | null {
  const field = fieldForRadialKind(kind, params.shape);
  if (!field) return null;
  const scale = mmScaleFor(params);
  const currentMm = (params.shape as unknown as Record<string, number>)[field];
  const nextMm = Math.max(MIN_GENERIC_SOLID_DIMENSION_MM, currentMm + delta.x / scale);
  const shape = updateGenericSolidShapeDimension(params.shape, field, nextMm);
  if (shape === params.shape) return null; // no-op (foreign field guard)
  return { ...params, shape };
}
