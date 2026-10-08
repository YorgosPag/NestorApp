import 'server-only';

/**
 * @fileoverview **ΟΙ ΠΡΟΚΑΤΟΧΟΙ ΜΙΑΣ ΔΗΜΟΣΙΕΥΣΗΣ → ΑΡΧΕΙΟ** (ADR-845 Ο-27 · ADR-862 Φ0 Β10 · ADR-909 Β1).
 * @related services/iso19650/container-transitions (ο ΕΝΑΣ γραφέας) · ./publish-property-material
 * @module app/api/properties/[id]/_shared/material-supersession
 *
 * 🔴 **ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ**: το `route.ts` ήταν στις **296/300** *(N.7.1: `/api/*route.ts` → 300)*
 * όταν απέκτησε την επαναπροβολή της αγγελίας *(ADR-845 Ο-35)*. ⇒ **EXTRACT, ποτέ trim** — ίδια
 * τομή με το `material-source-lookup`: η **πόρτα** κρίνει κηδεμονία και σχήμα· εδώ ζει η **ιστορία**
 * της διαδοχής. Το σώμα μετακόμισε **αυτούσιο** — και ξανά, δίπλα στον κοινό κορμό *(ADR-909 Β1)*, όταν
 * η παραγόμενη κάτοψη χρειάστηκε την **ίδια** διαδοχή.
 */

import type { AuthContext } from '@/lib/auth';
import { containerActorOf, transitionContainer } from '@/services/iso19650/container-transitions';
import { isSupersessionDone } from '@/services/iso19650/container-transition-vocabulary';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PropertyMaterialSupersession');

/**
 * **Οι προκάτοχοι → ΑΡΧΕΙΟ**, μέσω του ΕΝΟΣ γραφέα (ADR-862 Φ0 Β10).
 *
 * ⚠️ **Σειριακά, όχι `Promise.all`**: κάθε πράξη είναι συναλλαγή πάνω στον **ίδιο** διάδοχο· σε
 * παράλληλη εκτέλεση θα ξαναεκτελούνταν η μία την άλλη χωρίς κέρδος. Στην πράξη είναι ένας.
 *
 * 🔑 Μια **βλάβη** (ρίψη) στον έναν δεν κρύβει την επιτυχία του άλλου και **δεν** ρίχνει τη
 * δημοσίευση — το υλικό ανέβηκε ήδη. Καταγράφεται με όνομα.
 */
export async function archiveSuperseded(
  ctx: AuthContext,
  supersedes: readonly string[],
  fileId: string,
): Promise<readonly string[]> {
  const archived: string[] = [];
  for (const previousFileId of supersedes) {
    try {
      const outcome = await transitionContainer({
        fileId: previousFileId,
        act: 'supersede',
        actor: containerActorOf(ctx),
        supersededByFileId: fileId,
      });
      if (isSupersessionDone(outcome)) archived.push(previousFileId);
      if (outcome.kind === 'refused') {
        logger.warn('Ο προκάτοχος δεν αρχειοθετήθηκε', { previousFileId, fileId, why: outcome.why });
      }
    } catch (error) {
      logger.error('Η αρχειοθέτηση προκατόχου απέτυχε', { previousFileId, fileId, error: getErrorMessage(error) });
    }
  }
  return archived;
}
