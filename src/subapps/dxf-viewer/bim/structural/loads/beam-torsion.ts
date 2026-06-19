/**
 * beam-torsion — SSoT στρεπτικού φορτίου δοκού από **μονόπλευρη πρόβολο-πλάκα** (ADR-499
 * §C v1). Όταν μια πλάκα-πρόβολος (ADR-498, 1 φέρουσα δοκός) κρέμεται από τη μία πλευρά της
 * δοκού, το hogging της στη ρίζα δρα ως **κατανεμημένη στρεπτική ροπή** `t_Ed` (kNm ανά
 * μέτρο μήκους δοκού) που στρίβει τη δοκό κατά τον διαμήκη άξονά της.
 *
 * **ΕΝΑ SSoT, μηδέν νέα load μηχανική:** το hogging της προβόλου-πλάκας **ανά μέτρο** είναι
 * ΑΚΡΙΒΩΣ το `slabDesignMomentNmmPerM` (q·L²/2) που ήδη υπολογίζει ο οπλισμός+sizing της
 * πλάκας (Slice A/B1). Άρα `t_Ed = slabDesignMomentNmmPerM(slabCtx)` — το μοιραζόμαστε.
 *
 * **Συνολικό `T_Ed` στη στήριξη:** ο κατανεμημένος φόρτος `t_Ed` δρα στο διαμήκες καλυμμένο
 * μήκος `L_cov` της δοκού· για δοκό στρεπτικά πακτωμένη στα δύο άκρα (τυπικά μεταξύ κολωνών)
 * η στρεπτική αντίδραση στη στήριξη = `t_Ed·L_cov/2` (mirror της διατμητικής αντίδρασης w·L/2).
 *
 * **Reuse (N.0.2):** `computeSlabSupportConditions` (ADR-498 — ποια δοκός φέρει + `coverageLengthM`),
 * `buildSlabFoundationSectionContext`, `slabDesignMomentNmmPerM`. Pure — zero React/DOM/Firestore.
 *
 * **Scope v1:** μόνο αναρτημένη (`suspended`) πλάκα-πρόβολος. Έξοδος: `Map<beamId → T_Ed (kNm)>`
 * (max όταν πολλές πρόβολοι στην ίδια δοκό = αθροιστικά). Καταναλωτής v1 = diagnostic
 * (`runBeamTorsionChecks`)· section-grow + στρεπτικός οπλισμός = DEFER (πλήρες §6.3).
 *
 * @see ./slab-beam-support.ts — computeSlabSupportConditions (η τοπολογία προβόλου)
 * @see ../codes/suggest-slab-reinforcement.ts — slabDesignMomentNmmPerM (το κοινό hogging)
 * @see docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
 */

import type { Entity } from '../../../types/entities';
import { isSlabEntity } from '../../../types/entities';
import { computeSlabSupportConditions } from './slab-beam-support';
import { buildSlabFoundationSectionContext } from '../section-context';
import { slabDesignMomentNmmPerM } from '../codes/suggest-slab-reinforcement';

const NMM_TO_KNM = 1e6;

/**
 * Στρεπτική ροπή σχεδιασμού `T_Ed` (kNm) ανά δοκό από τις μονόπλευρες πρόβολους-πλάκες που
 * τη φορτίζουν. Κενό όταν δεν υπάρχει πρόβολος-πλάκα. Αθροιστικό όταν >1 πρόβολος στην ίδια
 * δοκό. Αναρτημένες (`suspended`) μόνο — εδαφόπλακες δεν στρίβουν δοκό ως πρόβολος.
 */
export function computeBeamDesignTorsion(entities: readonly Entity[]): Map<string, number> {
  const out = new Map<string, number>();
  const conditions = computeSlabSupportConditions(entities);
  if (conditions.size === 0) return out;

  for (const e of entities) {
    if (!isSlabEntity(e)) continue;
    const cond = conditions.get(e.id);
    if (!cond || cond.supportType !== 'cantilever' || !cond.bearingBeamId) continue;

    const ctx = buildSlabFoundationSectionContext(e, cond);
    if (ctx.kind !== 'suspended') continue; // εδαφόπλακες/raft δεν λειτουργούν ως πρόβολος

    const tEdPerMKnm = slabDesignMomentNmmPerM(ctx) / NMM_TO_KNM; // hogging ανά μέτρο = t_Ed
    const coverageM = cond.coverageLengthM ?? 0;
    if (tEdPerMKnm <= 0 || coverageM <= 0) continue;

    const tEdKnm = (tEdPerMKnm * coverageM) / 2; // αντίδραση στρεπτικά-πακτωμένης δοκού
    out.set(cond.bearingBeamId, (out.get(cond.bearingBeamId) ?? 0) + tEdKnm);
  }
  return out;
}
