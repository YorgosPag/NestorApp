/**
 * ADR-441 — Soft-warning ανίχνευση ασυνεπούς έδρασης «από κάναβο» (Revit-style).
 *
 * Όταν δομικά στοιχεία διαφορετικού τύπου (κολόνα/τοίχος/δοκάρι) είναι δεμένα στον ΙΔΙΟ
 * περιμετρικό άξονα αλλά με **αντίθετη** κάθετη έδραση (π.χ. κολόνες `inner` = σώμα προς τα
 * μέσα, τοίχοι `outer` = σώμα προς τα έξω), οι παρειές τους ΔΕΝ ευθυγραμμίζονται → πιθανό
 * αρχιτεκτονικό λάθος. **ΔΕΝ μπλοκάρουμε** (Revit: legit μικτές περιπτώσεις υπάρχουν) — απλώς
 * εκπέμπουμε μη-blocking προειδοποίηση (ίδιο pattern με `bim:foundation-on-upper-storey`).
 *
 * Κριτήριο = ΠΡΑΓΜΑΤΙΚΗ ασυνέπεια, ΟΧΙ απλώς «διαφορετικά modes»: αβλαβείς συνδυασμοί όπως
 * κολόνα `inner` + δοκάρι `center` ΔΕΝ τριγκάρουν (το center = πρόσημο 0, ευθυγραμμίζεται με
 * τον άξονα). Conflict μόνο όταν στον ίδιο άξονα συνυπάρχουν `+1` ΚΑΙ `−1` μετατόπιση.
 *
 * SSoT πρόσημου μετατόπισης:
 *   - **Γραμμικά** (τοίχος/δοκάρι): το `extend` (ADR-441 3-mode) στα perpendicular bindings
 *     (start-x/end-x κατακόρυφου = ίδιος X-guide· start-y/end-y οριζόντιου).
 *   - **Κολόνα**: το `anchor` → `ANCHOR_OFFSETS` (body shift = −sign(dx)/−sign(dy), αφού η
 *     geometry εδράζει το anchor σημείο στο `position`).
 *
 * @see ./grid-segment-justification.ts — πηγή του linear extend
 * @see ./grid-column-justification.ts — πηγή του column anchor
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { SceneModel } from '../../types/scene';
import { isColumnEntity, isWallEntity, isBeamEntity, type Entity } from '../../types/entities';
import { hasGuideBindings, type GuideBinding } from '../hosting/guide-binding-types';
import { ANCHOR_OFFSETS } from '../types/column-types';
import { EventBus } from '../../systems/events/EventBus';

/** Τύπος grid-managed δομικού στοιχείου που συμμετέχει στον έλεγχο όψης. */
type GridStructuralKind = 'column' | 'wall' | 'beam';

/** Tolerance (mm) για ευθυγράμμιση/containment παρειών (floating-point + σχεδιαστική ανοχή). */
const BEARING_TOL_MM = 1;

/**
 * Συνεισφορά ενός στοιχείου σε έναν άξονα = το **εγκάρσιο interval** του [lo, hi] (mm)
 * γύρω από τον άξονα (offset 0 = ο άξονας). Επιτρέπει τον δομικό έλεγχο στήριξης
 * (containment) + ευθυγράμμισης παρειών — όχι μόνο πρόσημο.
 */
interface AxisContribution {
  readonly guideId: string;
  readonly kind: GridStructuralKind;
  readonly isColumn: boolean;
  readonly lo: number;
  readonly hi: number;
}

/** Ασυνέπεια σε έναν άξονα: στοιχείο προεξέχει της κολόνας ή παρειές δεν ευθυγραμμίζονται. */
export interface JustificationConflict {
  readonly guideId: string;
  /** Οι τύποι στοιχείων που εμπλέκονται (≥2 διακριτοί). */
  readonly kinds: readonly GridStructuralKind[];
}

/** Εγκάρσιο interval γύρω από offset `center` με πλάτος `width` (mm). */
function interval(center: number, width: number): { lo: number; hi: number } {
  const h = width / 2;
  return { lo: center - h, hi: center + h };
}

/** Perpendicular intervals μιας **κολώνας** (center-x→width, center-y→depth). */
function columnContributions(
  bindings: readonly GuideBinding[],
  anchor: keyof typeof ANCHOR_OFFSETS,
  width: number,
  depth: number,
): AxisContribution[] {
  const { dx, dy } = ANCHOR_OFFSETS[anchor];
  const out: AxisContribution[] = [];
  const cx = bindings.find((b) => b.slot === 'center-x');
  const cy = bindings.find((b) => b.slot === 'center-y');
  // center offset = position − dx·width (geometry εδράζει το anchor στο position).
  if (cx) out.push({ guideId: cx.guideId, kind: 'column', isColumn: true, ...interval(-dx * width, width) });
  if (cy) out.push({ guideId: cy.guideId, kind: 'column', isColumn: true, ...interval(-dy * depth, depth) });
  return out;
}

/** Perpendicular interval ενός **γραμμικού** (τοίχος/δοκάρι): shared-axis ζεύγος, center=extend. */
function linearContribution(
  bindings: readonly GuideBinding[],
  kind: GridStructuralKind,
  width: number,
): AxisContribution[] {
  const find = (slot: GuideBinding['slot']) => bindings.find((b) => b.slot === slot);
  const sx = find('start-x'), ex = find('end-x'), sy = find('start-y'), ey = find('end-y');
  // Perpendicular = ο άξονας που μοιράζονται και τα δύο endpoints· center = το extend (mm).
  if (sx && ex && sx.guideId === ex.guideId) {
    return [{ guideId: sx.guideId, kind, isColumn: false, ...interval(sx.extend ?? 0, width) }];
  }
  if (sy && ey && sy.guideId === ey.guideId) {
    return [{ guideId: sy.guideId, kind, isColumn: false, ...interval(sy.extend ?? 0, width) }];
  }
  return [];
}

/** Όλες οι συνεισφορές intervals ενός grid-managed στοιχείου (column/wall/beam). */
function entityContributions(entity: Entity): AxisContribution[] {
  if (isColumnEntity(entity)) {
    return hasGuideBindings(entity)
      ? columnContributions(entity.guideBindings, entity.params.anchor ?? 'center', entity.params.width, entity.params.depth)
      : [];
  }
  if (isWallEntity(entity)) {
    return hasGuideBindings(entity) ? linearContribution(entity.guideBindings, 'wall', entity.params.thickness) : [];
  }
  if (isBeamEntity(entity)) {
    return hasGuideBindings(entity) ? linearContribution(entity.guideBindings, 'beam', entity.params.width) : [];
  }
  return [];
}

/** Το interval `l` περιέχεται (full bearing) σε κάποια κολόνα του άξονα; */
function bearsOnColumn(l: AxisContribution, columns: readonly AxisContribution[]): boolean {
  return columns.some((c) => l.lo >= c.lo - BEARING_TOL_MM && l.hi <= c.hi + BEARING_TOL_MM);
}

/**
 * Εντόπισε άξονες με ΛΑΘΟΣ έδραση. Pure. Δύο κριτήρια (Revit/ETABS-grade):
 *   1. **Partial bearing:** γραμμικό (δοκάρι/τοίχος) που ΔΕΝ περιέχεται σε καμία κολόνα του
 *      άξονα → προεξέχει (το σενάριο «κολόνα inner 40 + δοκάρι center 25»).
 *   2. **Face misalignment (χωρίς κολόνα):** δύο γραμμικά με intervals σε αντίθετες πλευρές
 *      του άξονα → οι παρειές δεν ευθυγραμμίζονται.
 */
export function detectGridJustificationConflicts(
  entities: readonly Entity[],
): JustificationConflict[] {
  const byAxis = new Map<string, AxisContribution[]>();
  for (const e of entities) {
    for (const c of entityContributions(e)) {
      const list = byAxis.get(c.guideId) ?? [];
      list.push(c);
      byAxis.set(c.guideId, list);
    }
  }
  const conflicts: JustificationConflict[] = [];
  for (const [guideId, list] of byAxis) {
    const columns = list.filter((c) => c.isColumn);
    const linears = list.filter((c) => !c.isColumn);
    let bad = false;
    if (columns.length > 0) {
      // (1) partial bearing: γραμμικό εκτός κάθε κολόνας.
      bad = linears.some((l) => !bearsOnColumn(l, columns));
    } else if (linears.length > 1) {
      // (2) face misalignment μεταξύ γραμμικών (αντίθετες πλευρές, εκτός tolerance).
      const center = (c: AxisContribution) => (c.lo + c.hi) / 2;
      const hasPos = linears.some((l) => center(l) > BEARING_TOL_MM);
      const hasNeg = linears.some((l) => center(l) < -BEARING_TOL_MM);
      bad = hasPos && hasNeg;
    }
    if (bad) {
      conflicts.push({ guideId, kinds: Array.from(new Set(list.map((c) => c.kind))) });
    }
  }
  return conflicts;
}

/**
 * Έλεγξε τη σκηνή μετά από «X από κάναβο» και, αν εντοπιστεί ασυνεπής έδραση, εκπέμψε
 * μη-blocking προειδοποίηση (ο toast registrar την εμφανίζει). No-op αν δεν υπάρχει σκηνή
 * ή ασυνέπεια. Καλείται από τα 3 grid bridges (DRY — ΕΝΑ σημείο ανίχνευσης).
 */
export function warnIfGridJustificationConflict(scene: SceneModel | null): void {
  if (!scene) return;
  const conflicts = detectGridJustificationConflicts(scene.entities);
  if (conflicts.length > 0) {
    EventBus.emit('bim:grid-justification-conflict', { axisCount: conflicts.length });
  }
}
