/**
 * ADR-529 — Detector: «δοκάρι σε μη-αναπτυσσόμενη παρειά γωνιακής κολόνας μίας κατεύθυνσης» (Ι → Γ).
 *
 * **Στατικό σκεπτικό (EC8 §5.4.2.1.2 / §5.4.2.4):** δοκάρι που πλαισιώνεται στη **στενή (μη-αναπτυσσόμενη)
 * παρειά** μιας γωνιακής κολόνας μίας κατεύθυνσης (π.χ. 400×250 — αναπτύσσεται μόνο Β-Ν) σχηματίζει
 * **ανεπαρκή κόμβο** (joint shear / αγκύρωση / εκκεντρότητα). Σωστό = η κολόνα να αναπτύσσεται **και στις
 * δύο διευθύνσεις** (boundary element) → ΠΡΟΑΓΩΓΗ σε Γ/L με σκέλος προς το δοκάρι. Είναι το **αντίστροφο
 * του ADR-525** (εκεί η L-κολόνα γεμίζει τη γωνία δύο δοκαριών· εδώ το δοκάρι προάγει την κολόνα).
 *
 * **Pure detection (μηδέν mutation):** ο caller (`useColumnBeamPromote`) εκτελεί `UpdateColumnParamsCommand`
 * (μετά από confirm) + emit `bim:column-params-updated` (→ reframe cascade). **FULL SSoT reuse:**
 *   · framing: `findColumnsFramedByBeamForGraph` (ADR-494 `beamFramesColumn`, kind-agnostic footprint-based)
 *   · γεωμετρία προαγωγής: `promoteColumnToBoundaryL` (ADR-529, στο column-beam-align — closed-form L)
 *
 * **Gating (decisions Giorgio 2026-06-25):**
 *   1. kind ∈ {rectangular, shear-wall} (όχι ήδη-L/T/circular/…) — shear-wall ΣΥΜΠΕΡΙΛΑΜΒΑΝΕΤΑΙ (decision #4)
 *   2. **μίας κατεύθυνσης**: `longDim/shortDim ≥ DIRECTIONAL_RATIO_MIN` (ασύμμετρη διατομή)
 *   3. **μη-αναπτυσσόμενη παρειά**: ο άξονας δοκαριού ∥ στενός άξονας (`|u·shortAxis| ≥ ALIGN_DOT_MIN`)
 *   4. **γωνιακή**: το σημείο πλαισίωσης κοντά σε **άκρο** του μεγάλου άξονα (`|sLong| ≥ longDim·CORNER_FRACTION`)
 *
 * @see ./column-beam-align.ts — promoteColumnToBoundaryL (γεωμετρία) + ο align δίδυμος (ADR-496)
 * @see ./column-structural-attach-coordinator.ts — findColumnsFramedByBeamForGraph / beamFramesColumn (SSoT)
 * @see ../framing/beam-span-snap.ts — ADR-528/529 Φ1 (το δοκάρι γεφυρώνει στην κολόνα)
 * @see docs/centralized-systems/reference/adrs/ADR-529-beam-promotes-corner-column-to-boundary-element.md
 */

import type { Entity } from '../../types/entities';
import { isBeamEntity, isColumnEntity } from '../../types/entities';
import type { BeamEntity } from '../types/beam-types';
import type { ColumnParams } from '../types/column-types';
import { findColumnsFramedByBeamForGraph } from './column-structural-attach-coordinator';
import { promoteColumnToBoundaryL } from './column-beam-align';

/** Ελάχιστος λόγος μεγάλης/στενής διάστασης για να θεωρηθεί «μίας κατεύθυνσης» (tunable). */
const DIRECTIONAL_RATIO_MIN = 1.2;
/** |u·shortAxis| ≥ αυτό ⇒ ο άξονας δοκαριού είναι ∥ στενός άξονας (~30° ανοχή· cos30°≈0.866). */
const ALIGN_DOT_MIN = 0.866;
/** Το σημείο πλαισίωσης πρέπει να απέχει ≥ longDim·αυτό από το κέντρο κατά τον μεγάλο άξονα ⇒ «γωνία». */
const CORNER_FRACTION = 0.15;

/** Μια προτεινόμενη προαγωγή κολόνας Ι → Γ (params πριν/μετά για το undoable command). */
export interface ColumnPromotion {
  readonly columnId: string;
  readonly nextParams: ColumnParams;
  readonly previousParams: ColumnParams;
}

/**
 * Βρες τις γωνιακές κολόνες μίας κατεύθυνσης που το `beam` πλαισιώνει σε **μη-αναπτυσσόμενη** παρειά →
 * προτεινόμενη προαγωγή σε Γ/L. Pure. `bearingMm` (μήκος νέου σκέλους, EC8) = `clamp(beam.depth, [shortDim,
 * 2·shortDim])` (decision #2). Άδειο όταν το νέο entity δεν είναι δοκάρι ή καμία κολόνα δεν πληροί τα gates.
 */
export function detectColumnPromotionsForBeam(
  beam: Entity,
  entities: readonly Entity[],
): ColumnPromotion[] {
  if (!isBeamEntity(beam)) return [];
  const framed = new Set(findColumnsFramedByBeamForGraph(beam, entities));
  if (framed.size === 0) return [];

  const b = beam as BeamEntity;
  const s = b.params.startPoint;
  const e = b.params.endPoint;
  const blen = Math.hypot(e.x - s.x, e.y - s.y);
  if (blen < 1e-6) return [];
  const ub = { x: (e.x - s.x) / blen, y: (e.y - s.y) / blen };

  const out: ColumnPromotion[] = [];
  for (const ent of entities) {
    if (!isColumnEntity(ent) || !framed.has(ent.id)) continue;
    const col = ent;
    // (1) μόνο rectangular / shear-wall (όχι ήδη-2-directional / circular / σύνθετες).
    if (col.params.kind !== 'rectangular' && col.params.kind !== 'shear-wall') continue;

    const W0 = col.params.width;
    const D0 = col.params.depth;
    const shortDim = Math.min(W0, D0);
    const longDim = Math.max(W0, D0);
    // (2) μίας κατεύθυνσης (ασύμμετρη διατομή).
    if (shortDim <= 0 || longDim / shortDim < DIRECTIONAL_RATIO_MIN) continue;

    // Άξονες κολόνας από το rotation (στενός = η μη-αναπτυσσόμενη διεύθυνση).
    const rad = ((col.params.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const shortAxis = W0 <= D0 ? { x: cos, y: sin } : { x: -sin, y: cos };
    const longAxis = W0 <= D0 ? { x: -sin, y: cos } : { x: cos, y: sin };

    // (3) δοκάρι ∥ στενός άξονας ⇒ πλαισιώνεται στη μη-αναπτυσσόμενη παρειά.
    if (Math.abs(ub.x * shortAxis.x + ub.y * shortAxis.y) < ALIGN_DOT_MIN) continue;

    // (4) γωνία: το πλησιέστερο άκρο δοκαριού (σημείο πλαισίωσης) κοντά σε άκρο του μεγάλου άξονα.
    const cx = col.params.position.x;
    const cy = col.params.position.y;
    const near = Math.hypot(s.x - cx, s.y - cy) <= Math.hypot(e.x - cx, e.y - cy) ? s : e;
    const sLong = (near.x - cx) * longAxis.x + (near.y - cy) * longAxis.y;
    if (Math.abs(sLong) < longDim * CORNER_FRACTION) continue;

    // bearing (EC8): clamp(beam depth, [shortDim, 2·shortDim]).
    const bearingMm = Math.min(Math.max(b.params.depth, shortDim), 2 * shortDim);
    const nextParams = promoteColumnToBoundaryL(col, b, bearingMm);
    if (!nextParams) continue;
    out.push({ columnId: col.id, nextParams, previousParams: col.params });
  }
  return out;
}

/**
 * ADR-529 Φ5 — **associative re-sync** του foot μιας ΗΔΗ-προαχθείσας Γ-κολόνας στο **τρέχον** πλάτος του
 * δοκαριού. Όταν ο οργανισμός ξανα-διαστασιολογεί το δοκάρι (`bim:beam-params-updated` μέσω auto-sizer),
 * το `lshape.armLength` (= πάχος ποδιού = πλάτος δοκαριού· EC2/EC8: έδραση ≥ δοκάρι) δεν πρέπει να μένει
 * **stale snapshot** της στιγμής της προαγωγής → αλλιώς foot στενότερο από το (μεγαλωμένο) δοκάρι = παραβίαση.
 *
 * Pure· **ασφαλής εντοπισμός** (ΜΟΝΟ κολόνες με `lshape.promotedFromBeamId === beam.id` — user-drawn L δεν
 * φέρει το πεδίο → δεν αγγίζεται). **Convergence guard:** επιστρέφει ΜΟΝΟ όσες χρειάζονται αλλαγή
 * (`armLength !== beam.width`) → idempotent· όταν συγχρονιστούν, επόμενο event = no-op (μηδέν κύκλος).
 * Το `armLength` (πάχος ποδιού) είναι ανεξάρτητο από `width`/`position` (= bearing/μήκος ποδιού) → καθαρή
 * αλλαγή ενός πεδίου, μηδέν μετατόπιση θέσης. `bim:column-params-updated` (από τον caller) ξανα-σχεδιάζει.
 */
export function resyncPromotedBoundaryArmsForBeam(
  beam: Entity,
  entities: readonly Entity[],
): ColumnPromotion[] {
  if (!isBeamEntity(beam)) return [];
  const beamWidth = (beam as BeamEntity).params.width;
  if (!(beamWidth > 0)) return [];
  const out: ColumnPromotion[] = [];
  for (const ent of entities) {
    if (!isColumnEntity(ent)) continue;
    const ls = ent.params.lshape;
    if (ent.params.kind !== 'L-shape' || !ls || ls.promotedFromBeamId !== beam.id) continue;
    if ((ls.armLength ?? 0) === beamWidth) continue; // ήδη συγχρονισμένο → skip (convergence guard)
    out.push({
      columnId: ent.id,
      nextParams: { ...ent.params, lshape: { ...ls, armLength: beamWidth } },
      previousParams: ent.params,
    });
  }
  return out;
}
