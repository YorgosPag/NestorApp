/**
 * @fileoverview **ΟΤΑΝ ΧΑΝΕΤΑΙ Η ΑΔΕΙΑ, ΦΕΥΓΟΥΝ ΚΑΙ ΟΙ ΗΔΗ ΔΗΜΟΣΙΕΥΜΕΝΕΣ.**
 * @related ADR-824 §8 Κ6 · types/owner-property-mandate.ts · services/owner-property/owner-property-publication.service.ts
 * @module services/mandate/agency-listings-sweep.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΝΑ ΚΛΕΙΣΕΙ Η ΠΟΡΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο τύπος {@link BrokerageAuthority} κάνει **αδύνατη** τη γέννηση **νέας** brokered
 * αγγελίας χωρίς ενεργή άδεια. Από μόνος του όμως φυλάει **μόνο το μέλλον**: ένα
 * γραφείο που έχασε την άδειά του θα κρατούσε στον δημόσιο χάρτη **όσες πρόλαβε**.
 *
 * 🔑 **Η θεραπεία ΔΕΝ είναι δεύτερος κριτής.** Το γεγονός γράφεται **στην οντότητα**
 * (`mandate.agencyRevokedAt`) και ο **ΕΝΑΣ** υπάρχων κριτής
 * ({@link mandateAllowsPublication}) το διαβάζει. Άρα το ίδιο κριτήριο απαντά ίδια σε
 * **τρία** σημεία που δεν συνεννοούνται: τον γραφέα της προβολής, την επανασύνθεση,
 * και την **κάρτα του κατόχου** — που τρέχει στον φυλλομετρητή και **δεν μπορεί** να
 * διαβάσει το `companies/{id}` του γραφείου.
 *
 * ⚠️ **ΑΝΤΙΣΤΡΕΨΙΜΟ, ΚΑΙ ΓΙ' ΑΥΤΟ ΕΙΝΑΙ ΣΤΙΓΜΗ**: η επανέγκριση περνά `null` και οι
 * αγγελίες επανέρχονται. Μια διαγραφή της εντολής θα ήταν μη αναστρέψιμη τιμωρία για
 * τον **ιδιοκτήτη**, που δεν έφταιξε σε τίποτα.
 *
 * ⚠️ **Η συμφωνημένη διάρκεια (`expiresAt`) ΔΕΝ πειράζεται ΠΟΤΕ.** Ήταν ο εύκολος
 * δρόμος —«βάλε λήξη το τώρα και όλα δουλεύουν»— και θα ήταν **απώλεια δεδομένου**
 * για να εκφραστεί γεγονός που έχει **δικό του** πεδίο.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { mandatesOf } from '@/types/owner-property-mandate';
import { createModuleLogger } from '@/lib/telemetry';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import type { OwnerProperty } from '@/types/owner-property';
import type { PublishOutcome } from '@/services/listings/publish-public-listing';

const logger = createModuleLogger('agency-listings-sweep');

export interface AgencySweepReport {
  /** Πόσες brokered αγγελίες του γραφείου αγγίχθηκαν. */
  readonly swept: number;
  /** Πού κατέληξε η προβολή καθεμιάς — **κλειστή λογιστική**. */
  readonly outcomes: Record<PublishOutcome, number>;
}

/**
 * **Γράφει τη στιγμή της ανάκλησης σε κάθε εντολή του γραφείου και ξαναδημοσιεύει.**
 *
 * @param revokedAt ISO στην **ανάκληση**, `null` στην **επανέγκριση**.
 *
 * 🔑 **Η ίδια συνάρτηση και για τις δύο κατευθύνσεις**, γιατί είναι η ίδια πράξη:
 * *«γράψε το γεγονός, μετά ρώτα ξανά τον κριτή»*. Δύο συναρτήσεις θα ήταν δύο
 * αντίγραφα που θα απέκλιναν την πρώτη φορά που θα άλλαζε το ένα σκέλος.
 *
 * ⚠️ **Δεν πετά ποτέ.** Μια αστοχία σε μία αγγελία **δεν** ακυρώνει τη ρυθμιστική
 * απόφαση: η κατάσταση της ικανότητας έχει ήδη γραφτεί από τον καλούντα, και η
 * επανασύνθεση (`/api/admin/rebuild-public-listings`) διορθώνει ό,τι έμεινε.
 *
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ: πρώτα η αλήθεια, μετά το παράγωγο** — ίδιο ιδίωμα με
 * την πύλη γραφής της αγγελίας. Αν η προβολή γραφόταν πρώτη, μια αστοχία στο έγγραφο
 * θα άφηνε δημόσια αγγελία που **καμία** οντότητα δεν στηρίζει.
 */
export async function applyAgencyRevocation(
  adminDb: AdminFirestore,
  companyId: string,
  revokedAt: string | null,
): Promise<AgencySweepReport> {
  const outcomes: Record<PublishOutcome, number> = { published: 0, withdrawn: 0, failed: 0 };

  // tenant-scope-exempt: ερώτημα **κατά οργανισμό** πάνω στο `authorCompanyId`, που
  // είναι το πεδίο μισθωτή αυτής της οικογένειας (`owner_properties` δηλώνεται
  // `mode:'userId'` για τον **ιδιώτη**· η brokered αγγελία ανήκει στο **γραφείο**,
  // ADR-777 §8.39). Ο καλών είναι super_admin σε **ρυθμιστική** πράξη, και η εμβέλεια
  // είναι **ακριβώς** ο οργανισμός που κρίθηκε — ποτέ ευρύτερη.
  const snapshot = await adminDb
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .where('authorCompanyId', '==', companyId)
    .get();

  let swept = 0;

  for (const doc of snapshot.docs) {
    const property = { ...(doc.data() as OwnerProperty), id: doc.id };

    // ⚠️ Ο ιδιώτης **δεν αγγίζεται ποτέ**: χωρίς εντολή δεν υπάρχει ρυθμιζόμενη
    //    πράξη (ADR-824 §7). Κενός πίνακας ⇒ προσπερνάμε.
    if (mandatesOf(property).length === 0) continue;

    // 🔴 **ΜΟΝΟ ΟΙ ΕΝΤΟΛΕΣ ΑΥΤΟΥ ΤΟΥ ΓΡΑΦΕΙΟΥ** (ADR-832). Η ανάκληση αφορά **έναν**
    //    οργανισμό· από τη στιγμή που η ίδια αγγελία μπορεί να κρατά εντολές δύο
    //    γραφείων, ένα σκέτο «σημάδεψε την εντολή» θα τιμωρούσε **αθώο τρίτο** —
    //    γραφείο με απολύτως ενεργή άδεια θα έχανε τη δημόσια προβολή του επειδή
    //    ένας ανταγωνιστής του τιμωρήθηκε.
    const marked = mandatesOf(property).map((mandate) =>
      mandate.agencyCompanyId === companyId
        ? { ...mandate, agencyRevokedAt: revokedAt }
        : mandate,
    );
    if (marked.every((mandate, index) => mandate === mandatesOf(property)[index])) continue;

    const updated: OwnerProperty = { ...property, mandates: marked };

    try {
      await adminDb
        .collection(COLLECTIONS.OWNER_PROPERTIES)
        .doc(doc.id)
        .update({ 'mandate.agencyRevokedAt': revokedAt });
    } catch (error) {
      outcomes.failed += 1;
      logger.error('Η εντολή δεν ενημερώθηκε — η αγγελία μένει ΩΣ ΕΧΕΙ', {
        data: { companyId, ownerPropertyId: doc.id },
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    swept += 1;
    outcomes[(await republishOwnerProperty(adminDb, updated)).publish] += 1;
  }

  logger.info('Σάρωση αγγελιών γραφείου μετά από ρυθμιστική απόφαση', {
    data: { companyId, revokedAt, swept, ...outcomes },
  });

  return { swept, outcomes };
}
