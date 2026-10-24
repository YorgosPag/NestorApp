import 'server-only';

/**
 * @fileoverview **ΟΙ ΠΡΟΚΑΤΟΧΟΙ ΜΙΑΣ ΔΗΜΟΣΙΕΥΣΗΣ → ΑΡΧΕΙΟ** (ADR-845 Ο-27 · ADR-862 Φ0 Β10 · ADR-909 Β1 · ADR-920 Β4.3).
 * @related services/iso19650/container-transitions (ο ΕΝΑΣ γραφέας) · ./publish-listing-material
 * @module server/listing-material/material-supersession
 *
 * 🔴 **ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ**: το `route.ts` ήταν στις **296/300** *(N.7.1: `/api/*route.ts` → 300)*
 * όταν απέκτησε την επαναπροβολή της αγγελίας *(ADR-845 Ο-35)*. ⇒ **EXTRACT, ποτέ trim** — ίδια
 * τομή με το `material-source-lookup`: η **πόρτα** κρίνει κηδεμονία και σχήμα· εδώ ζει η **ιστορία**
 * της διαδοχής. Το σώμα μετακόμισε **αυτούσιο** — δίπλα στον κοινό κορμό *(ADR-909 Β1)*, και ξανά εδώ όταν ο
 * κορμός έγινε κινητήρας **δύο** κηδεμονιών *(ADR-920 Β4.3)*.
 *
 * 🔑 **Ο ΔΡΑΣΤΗΣ ΕΡΧΕΤΑΙ ΕΤΟΙΜΟΣ** *(ADR-920 Β4.3)*: `containerActorOf(ctx)` για το γραφείο,
 * `personalContainerActorOf(uid)` για τον ιδιοκτήτη. Ο `transitionContainer` διαλέγει **από τον ίδιο** δράστη τη
 * συλλογή (`FILE_COLLECTION[kind]`) και τον κριτή (ρόλος ή κάτοχος) ⇒ εδώ δεν υπάρχει δεύτερη απόφαση κηδεμονίας.
 */

import {
  transitionContainer,
  type ContainerActor,
} from '@/services/iso19650/container-transitions';
import { isSupersessionDone } from '@/services/iso19650/container-transition-vocabulary';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('ListingMaterialSupersession');

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
  actor: ContainerActor,
  supersedes: readonly string[],
  fileId: string,
): Promise<readonly string[]> {
  const archived: string[] = [];
  for (const previousFileId of supersedes) {
    try {
      const outcome = await transitionContainer({
        fileId: previousFileId,
        act: 'supersede',
        actor,
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
