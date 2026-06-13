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

/** Μία συνεισφορά μετατόπισης ενός στοιχείου σε έναν άξονα. */
interface AxisContribution {
  readonly guideId: string;
  /** −1 / +1 (μηδενικές παραλείπονται — center = δεν συνεισφέρει). */
  readonly sign: number;
  readonly kind: GridStructuralKind;
}

/** Ασυνέπεια σε έναν άξονα: συνυπάρχουν αντίθετες μετατοπίσεις από διαφορετικά στοιχεία. */
export interface JustificationConflict {
  readonly guideId: string;
  /** Οι τύποι στοιχείων που εμπλέκονται (≥2 διακριτοί). */
  readonly kinds: readonly GridStructuralKind[];
}

/** Perpendicular offset μιας **κολώνας** στους άξονές της (center-x/center-y → anchor). */
function columnContributions(bindings: readonly GuideBinding[], anchor: keyof typeof ANCHOR_OFFSETS): AxisContribution[] {
  const { dx, dy } = ANCHOR_OFFSETS[anchor];
  const out: AxisContribution[] = [];
  const cx = bindings.find((b) => b.slot === 'center-x');
  const cy = bindings.find((b) => b.slot === 'center-y');
  // body shift = position − dx·width → πρόσημο μετατόπισης σώματος = −sign(dx).
  if (cx && dx !== 0) out.push({ guideId: cx.guideId, sign: -Math.sign(dx), kind: 'column' });
  if (cy && dy !== 0) out.push({ guideId: cy.guideId, sign: -Math.sign(dy), kind: 'column' });
  return out;
}

/** Perpendicular offset ενός **γραμμικού** (τοίχος/δοκάρι): το shared-axis ζεύγος + extend. */
function linearContribution(bindings: readonly GuideBinding[], kind: GridStructuralKind): AxisContribution[] {
  const find = (slot: GuideBinding['slot']) => bindings.find((b) => b.slot === slot);
  const sx = find('start-x'), ex = find('end-x'), sy = find('start-y'), ey = find('end-y');
  // Perpendicular = ο άξονας που μοιράζονται και τα δύο endpoints (σταθερή συντεταγμένη).
  if (sx && ex && sx.guideId === ex.guideId) {
    const sign = Math.sign(sx.extend ?? 0);
    return sign !== 0 ? [{ guideId: sx.guideId, sign, kind }] : [];
  }
  if (sy && ey && sy.guideId === ey.guideId) {
    const sign = Math.sign(sy.extend ?? 0);
    return sign !== 0 ? [{ guideId: sy.guideId, sign, kind }] : [];
  }
  return [];
}

/** Όλες οι συνεισφορές μετατόπισης ενός grid-managed στοιχείου (column/wall/beam). */
function entityContributions(entity: Entity): AxisContribution[] {
  if (isColumnEntity(entity)) {
    return hasGuideBindings(entity)
      ? columnContributions(entity.guideBindings, entity.params.anchor ?? 'center')
      : [];
  }
  if (isWallEntity(entity)) {
    return hasGuideBindings(entity) ? linearContribution(entity.guideBindings, 'wall') : [];
  }
  if (isBeamEntity(entity)) {
    return hasGuideBindings(entity) ? linearContribution(entity.guideBindings, 'beam') : [];
  }
  return [];
}

/**
 * Εντόπισε άξονες με ΑΝΤΙΘΕΤΗ έδραση δομικών στοιχείων (μη-ευθυγραμμισμένες παρειές).
 * Pure. Επιστρέφει έναν conflict ανά άξονα όπου συνυπάρχουν `+1` ΚΑΙ `−1` μετατόπιση.
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
    const hasPos = list.some((c) => c.sign > 0);
    const hasNeg = list.some((c) => c.sign < 0);
    if (hasPos && hasNeg) {
      const kinds = Array.from(new Set(list.map((c) => c.kind)));
      conflicts.push({ guideId, kinds });
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
