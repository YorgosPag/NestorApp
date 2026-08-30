/**
 * @fileoverview **Ο ΑΝΑΓΝΩΣΤΗΣ ΤΟΥ ΡΥΘΜΙΣΤΗ** — *«ποιοι οργανισμοί περιμένουν απόφαση;»*.
 * @related ADR-824 §5.3 · §8 Κ12 · §12.13 · services/company/company-capabilities.reader
 * @module services/company/organization-capability.reader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ, ΚΑΙ ΓΙΑΤΙ Η ΑΠΟΥΣΙΑ ΤΟΥ ΗΤΑΝ ΔΟΜΙΚΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ρυθμιστική απόφαση υπήρχε ολόκληρη: `approveBrokerage` · `revokeBrokerage` · πόρτα με
 * φρουρό `BYPASS_ROLES` · κριτής · σάρωση αγγελιών. Και **καμία διαδρομή δεν απαντούσε
 * “ποιους να κρίνω;”** — ο υπερδιαχειριστής μπορούσε να αποφασίσει **μόνο** για οργανισμό του
 * οποίου το `companyId` ήξερε ήδη απ' έξω.
 *
 * ⇒ Ο πίνακας του ρυθμιστή δεν ήταν «αστόλιστος»· ήταν **δομικά αδύνατος**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΣΤΕΝΗ ΠΡΟΒΟΛΗ — ΤΟ ΙΔΙΟ ΔΟΓΜΑ ΜΕ ΤΟΥΣ ΔΥΟ ΑΔΕΛΦΟΥΣ ΑΝΑΓΝΩΣΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `companies/{id}` κουβαλά `createdBy` (uid) · `_lastModifiedByName` (**ονοματεπώνυμο
 * ανθρώπου**) · `settings` · `plan`. Ένα ερώτημα επιστρέφει **πολλά** τέτοια έγγραφα
 * ταυτόχρονα, οπότε ένα `{...doc.data()}` σε απάντηση θα διέρρεε **σε πλήθος**, όχι ένα-ένα.
 *
 * Γι' αυτό εδώ δεν γυρίζει «η εταιρεία»: γυρίζει **ταυτότητα + επωνυμία + αποκάλυψη**, και
 * η αποκάλυψη είναι η **ίδια** {@link CapabilityDisclosure} που βλέπει ο ιδρυτής για τον
 * εαυτό του. Ένα λεξιλόγιο, δύο κοινά.
 *
 * ⚠️ **Το `decidedByUserId` ΔΕΝ γυρίζει ούτε εδώ**, παρότι ο αναγνώστης είναι ο ρυθμιστής:
 * το *«ποιος αποφάσισε»* έχει **ήδη κατοικία** — το ίχνος ελέγχου (`EntityAuditService`), που
 * κρατά **όλες** τις αποφάσεις με σειρά, ενώ το έγγραφο κρατά μόνο την **τελευταία**. Δεύτερη
 * πηγή για την ίδια ερώτηση θα ήταν χειρότερη *και* λιγότερο αληθινή.
 *
 * **Layering**: reader — Admin SDK, **ένα** ερώτημα, φραγμένο.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { companyPublicNameOf } from '@/services/company/company-public-name.reader';
import {
  capabilityDisclosureOf,
  capabilityStatusFieldPath,
  type CapabilityDisclosure,
  type CapabilityStatus,
  type OrganizationCapabilities,
  type OrganizationCapability,
} from '@/types/organization-capability';

const logger = createModuleLogger('organization-capability.reader');

/**
 * **Το ταβάνι του ερωτήματος.**
 *
 * 🔑 **Φράγμα, όχι σελιδοποίηση — και δηλώνεται γιατί.** Οι εκκρεμείς δηλώσεις είναι εξ
 * ορισμού **λίγες**: μία ανά οργανισμό, και **μόνο** όσο δεν έχει αποφασίσει άνθρωπος. Ένας
 * πίνακας που φτάνει τις 200 δεν είναι μεγάλος πίνακας — είναι **ουρά που δεν την κοιτάζει
 * κανείς**, δηλαδή διαφορετικό πρόβλημα από τη σελιδοποίηση.
 *
 * ⚠️ Γι' αυτό ο καλών παίρνει **ρητό `truncated`** αντί για σιωπηλή κοπή: μια οθόνη που
 * δείχνει 200 από 340 χωρίς να το πει είναι **ψέμα με αριθμό**.
 */
const MAX_APPLICANTS = 200;

/** Ταυτότητα + επωνυμία + **η ίδια** αποκάλυψη που βλέπει ο ιδρυτής. */
export interface CapabilityApplicant {
  readonly companyId: string;
  /** `null` όταν λείπει ή είναι κενή — ποτέ κείμενο-μπαλαντέρ σε `.ts` (N.11). */
  readonly companyName: string | null;
  readonly disclosure: CapabilityDisclosure;
}

export interface CapabilityApplicantsPage {
  readonly applicants: readonly CapabilityApplicant[];
  /** `true` ⇒ υπάρχουν κι άλλοι· η οθόνη **οφείλει** να το πει. */
  readonly truncated: boolean;
}

/**
 * Ένα έγγραφο `companies/{id}` → **μία γραμμή του ρυθμιστή**, ή `null`.
 *
 * ⚠️ **Το `null` είναι αδύνατο σήμερα, και φυλάγεται επίτηδες**: το έγγραφο ταίριαξε στο
 * ερώτημα, άρα η εγγραφή ικανότητας **υπάρχει**. Αν κάποτε δεν υπάρχει, η αιτία είναι
 * **απόκλιση διαδρομής πεδίου** — και τότε θέλουμε **σιωπή στη μία γραμμή**, όχι ένα `null!`
 * που ρίχνει ολόκληρο τον πίνακα του ρυθμιστή.
 */
function applicantOf(
  companyId: string,
  data: unknown,
  capability: OrganizationCapability,
): CapabilityApplicant | null {
  const capabilities = (data as { capabilities?: OrganizationCapabilities } | undefined)
    ?.capabilities;
  const disclosure = capabilityDisclosureOf(capabilities, capability);
  if (disclosure === null) return null;

  return { companyId, companyName: companyPublicNameOf(data), disclosure };
}

/**
 * **ΟΙ ΟΡΓΑΝΙΣΜΟΙ ΣΕ ΜΙΑ ΚΑΤΑΣΤΑΣΗ** — για τον ρυθμιστή, ποτέ για μισθωτή.
 *
 * ⛔ **Η ΑΠΟΥΣΙΑ ΔΕΝ ΑΠΑΡΙΘΜΕΙΤΑΙ.** Το `unrequested` **δεν** είναι γραμμένη τιμή: είναι η
 * προεπιλογή για έγγραφο **χωρίς** εγγραφή ικανότητας. Ένα ερώτημα ισότητας πάνω σε πεδίο που
 * δεν υπάρχει επιστρέφει **κενό** — δηλαδή θα απαντούσε *«κανείς»* για το σύνολο που στην
 * πραγματικότητα περιέχει **σχεδόν όλους**. Ο καλών παίρνει `null` και το ονομάζει· δεν
 * παίρνει άδεια λίστα που μοιάζει με απάντηση.
 *
 * @param status Η **γραμμένη** κατάσταση προς απαρίθμηση. `unrequested` ⇒ `null`.
 * @returns `null` **μόνο** για μη απαριθμήσιμη κατάσταση· κενή σελίδα σε αστοχία ανάγνωσης.
 */
export async function readCapabilityApplicants(
  adminDb: AdminFirestore,
  capability: OrganizationCapability,
  status: CapabilityStatus,
): Promise<CapabilityApplicantsPage | null> {
  if (status === 'unrequested') return null;

  try {
    // tenant-scope-exempt: ο ΡΥΘΜΙΣΤΗΣ κρίνει **διασχώρα** εκ σχεδιασμού — η ερώτηση είναι
    // κυριολεκτικά «ποιοι οργανισμοί περιμένουν;», οπότε φίλτρο ανά μισθωτή θα την ακύρωνε.
    // Η εξουσιοδότηση κρίνεται στο **σύνορο** (`withAuth` + `BYPASS_ROLES`, ADR-801), και το
    // Admin SDK δεν περνά από κανόνες Firestore. Ίδιο ιδίωμα με το `useDiagnosticsQuery`.
    const snapshot = await adminDb
      .collection(COLLECTIONS.COMPANIES)
      .where(capabilityStatusFieldPath(capability), '==', status)
      .limit(MAX_APPLICANTS + 1)
      .get();

    return {
      applicants: snapshot.docs
        .slice(0, MAX_APPLICANTS)
        .map((doc) => applicantOf(doc.id, doc.data(), capability))
        .filter((applicant): applicant is CapabilityApplicant => applicant !== null),
      truncated: snapshot.size > MAX_APPLICANTS,
    };
  } catch (error) {
    // 🔴 **Κενή σελίδα, ποτέ εξαίρεση — αλλά ΟΧΙ σιωπηλά.** Ο καταναλωτής είναι οθόνη
    //    διαχειριστή: μια αστοχία που ανεβαίνει ως 500 δεν του λέει τίποτα περισσότερο, ενώ
    //    ένα κενό που **καταγράφηκε** αφήνει ίχνος για να βρεθεί η αιτία.
    logger.error('Οι εκκρεμείς δηλώσεις ικανότητας δεν διαβάστηκαν', {
      data: { capability, status },
      error: error instanceof Error ? error.message : String(error),
    });
    return { applicants: [], truncated: false };
  }
}
