/**
 * Member utilization — pure SSoT (ADR-485, T3-UI / Slice 4c).
 *
 * Βαθμός εκμετάλλευσης οπλισμού ενός φέροντος μέλους = **As,απαιτούμενο / As,διαθέσιμο**
 * (demand/capacity, Robot/SAP2000 «reinforcement ratio»). ΟΧΙ νέος M_Rd engine — reuse
 * των SSoT `asStrength{Beam,Column}Mm2` (η ίδια καμπτική/αξονική απαίτηση αντοχής που
 * διαστασιολογεί τον αυτόματο οπλισμό, ADR-472) για το As,req, και του **ενεργού**
 * οπλισμού (active reinforcement, ADR-456/471) για το As,prov. Έτσι:
 *   · auto μέλος (sized-by-code) → ratio ≤ 1 (ο suggester ικανοποιεί την απαίτηση)·
 *   · manual under-designed μέλος → ratio > 1 (κόκκινο = ανεπαρκές).
 *   · αφόρτιστο μέλος → As,req=0 → ratio 0 (πράσινο).
 *
 * Pure — zero React/DOM/store/Firestore. Ο caller δίνει τον **ενεργό** οπλισμό (resolved
 * μέσω του store-coupled `active-reinforcement` helper) ώστε αυτό το module να μένει
 * provider-agnostic & unit-testable. As,req δεν χρειάζεται provider (μόνο section ctx).
 *
 * @see ../codes/suggest-reinforcement.ts — asStrength{Beam,Column}Mm2 (As,req SSoT)
 * @see ../active-reinforcement.ts — resolveActive…ForEntity (As,prov source)
 * @see ./utilization-color.ts — ratio → χρώμα (πράσινο/πορτοκαλί/κόκκινο)
 * @see docs/centralized-systems/reference/adrs/ADR-485-utilization-overlay.md
 */

import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity, BeamSupportType } from '../../types/beam-types';
import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import { barAreaMm2 } from '../rebar-catalog';
import { buildBeamSectionContext, buildColumnSectionContext } from '../section-context';
import {
  asStrengthBeamMm2,
  asStrengthColumnMm2,
  BEAM_EFFECTIVE_DEPTH_FACTOR,
} from '../codes/suggest-reinforcement';

/** Βαθμός εκμετάλλευσης ενός μέλους (DERIVED — ΠΟΤΕ persisted). */
export interface MemberUtilization {
  readonly entityId: string;
  readonly asRequiredMm2: number;
  readonly asProvidedMm2: number;
  /** As,req / As,prov. 0 όταν δεν υπάρχει απαίτηση (αφόρτιστο). */
  readonly ratio: number;
}

/** ratio από req/prov — 0 χωρίς απαίτηση· `null` όταν δεν υπάρχει οπλισμός (μη-βαφόμενο). */
function toRatio(entityId: string, asRequiredMm2: number, asProvidedMm2: number): MemberUtilization | null {
  if (asProvidedMm2 <= 0) return null;
  const ratio = asRequiredMm2 <= 0 ? 0 : asRequiredMm2 / asProvidedMm2;
  return { entityId, asRequiredMm2, asProvidedMm2, ratio };
}

/**
 * Utilization δοκαριού: As,req = καμπτική απαίτηση κάτω οπλισμού (asStrengthBeam, z=0.9·d)·
 * As,prov = κάτω (εφελκυόμενος) διαμήκης οπλισμός. `reinforcement` = ο ενεργός οπλισμός.
 */
export function beamUtilization(
  beam: Pick<BeamEntity, 'id' | 'params' | 'geometry'>,
  reinforcement: BeamReinforcement | undefined,
  supportType?: BeamSupportType, // ADR-486 — topology-aware As,req (πρόβολος → wL²/2)
): MemberUtilization | null {
  if (!reinforcement) return null;
  const ctx = buildBeamSectionContext(beam, supportType);
  const asRequired = asStrengthBeamMm2(ctx, BEAM_EFFECTIVE_DEPTH_FACTOR * ctx.depthMm);
  const asProvided = reinforcement.bottom.count * barAreaMm2(reinforcement.bottom.diameterMm);
  return toRatio(beam.id, asRequired, asProvided);
}

/**
 * Utilization κολόνας: As,req = αξονική+καμπτική απαίτηση (asStrengthColumn)· As,prov =
 * συνολικός διαμήκης οπλισμός. `reinforcement` = ο ενεργός οπλισμός.
 *
 * ADR-491 — `designMomentOverrideKnm` (FEM end-moment, π.χ. πρόβολος → wL²/2): η As,req
 * γίνεται FEM-aware (max με e₀) ώστε το utilization να αποκαλύπτει την ανεπάρκεια του
 * προβόλου ΠΡΙΝ τον οπλισμό (>1, κόκκινο) και να δείχνει επάρκεια μετά (≤1). Ο caller
 * περνά την ΙΔΙΑ engaged-gated ροπή που τροφοδότησε το As,prov → req & prov συμφωνούν.
 */
export function columnUtilization(
  column: ColumnEntity,
  reinforcement: ColumnReinforcement | undefined,
  designMomentOverrideKnm?: number,
): MemberUtilization | null {
  if (!reinforcement) return null;
  const ctx = buildColumnSectionContext(column, designMomentOverrideKnm);
  const asRequired = asStrengthColumnMm2(ctx);
  const asProvided = reinforcement.longitudinal.count * barAreaMm2(reinforcement.longitudinal.diameterMm);
  return toRatio(column.id, asRequired, asProvided);
}
