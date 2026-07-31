/**
 * Το **σύνορο αποκάλυψης** των προμηθειών — τι από την αλήθεια φεύγει στο σύρμα
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΔΟΜΙΚΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΝΕΙ (μετρημένο 2026-07-31)
 * ─────────────────────────────────────────────────────────────────────────────
 * Κάθε route προμηθειών υπολόγιζε τον **κωδικό** και το **μήνυμα** σε δύο
 * ανεξάρτητες γραμμές:
 *
 * ```ts
 * const message = getErrorMessage(error, 'Failed to update material');
 * const status  = resolveProcurementErrorStatus(error, { …, mode: 'mutation' });
 * ```
 *
 * Δύο ανεξάρτητοι υπολογισμοί πάνω στο **ίδιο** σφάλμα δεν μπορούν να
 * μεταμφιεστούν μαζί: μια μεταμφίεση που αλλάζει το `403` σε `404` αλλά αφήνει
 * το `'Forbidden'` στο σώμα **δεν κρύβει τίποτα** — και τίποτα στον κώδικα δεν
 * τα κρατούσε συγχρονισμένα. Γι' αυτό εδώ επιστρέφονται **μαζί**, από ένα
 * σημείο απόφασης: το ζεύγος `(status, message)` είναι **μία** τιμή.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Η ΤΑΥΤΟΤΗΤΑ ΓΝΗΣΙΟΥ ΚΑΙ ΜΕΤΑΜΦΙΕΣΜΕΝΟΥ (ADR-742 §7.1)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο κλάδος `conceal` **δεν γράφει** μήνυμα «δεν βρέθηκε». Καλεί το ίδιο
 * εργοστάσιο ({@link procurementNotFound}) με τα ίδια ορίσματα που θα έδινε η
 * υπηρεσία αν το έγγραφο έλειπε πραγματικά — και τα ορίσματα ταξιδεύουν μέσα
 * στο σφάλμα ιδιοκτησίας. Χειρόγραφο `'Not found'` εδώ θα ήταν ακριβώς η
 * μετάλλαξη που το ADR-742 §3.4 απαγορεύει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ LOG ΚΡΑΤΑ ΤΗΝ ΑΛΗΘΕΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η μεταμφίεση αφορά **μόνο** το σύρμα. Το `logMessage` παραμένει η πλήρης
 * αλήθεια (ποιος πόρος, ποιος tenant τον ζήτησε, ποιος τον έχει) — αλλιώς η
 * μεταμφίεση θα τύφλωνε και τη διάγνωση, που είναι το αντίθετο του ζητούμενου
 * (ADR-742 §3.4: «εσωτερικοί καλούντες και logs κρατούν πλήρη εικόνα»).
 *
 * @module app/api/procurement/_shared/procurement-error-outcome
 * @see ADR-742 §3.3 (κανόνας αποκάλυψης), §3.4, §7.1 · ADR-603 (route factory)
 */

import { concealCrossTenant } from '@/lib/auth/tenant-ownership';
import {
  ProcurementCrossTenantError,
  ProcurementNotFoundError,
  procurementNotFound,
} from '@/subapps/procurement/services/procurement-ownership';
import { getErrorMessage } from '@/lib/error-utils';
import { resolveProcurementErrorStatus, type ProcurementErrorStatusOptions } from './error-status';

/**
 * Τι φεύγει στο σύρμα και τι μένει στο log — **ένα** ζεύγος, όχι δύο τιμές που
 * υπολογίζονται χωριστά.
 */
export interface ProcurementErrorOutcome {
  /** Ο κωδικός HTTP που φεύγει. */
  readonly status: number;
  /** Το σώμα που φεύγει. **Μεταμφιεσμένο** όταν το επιβάλλει ο κανόνας αποκάλυψης. */
  readonly message: string;
  /** Η **αλήθεια**, για το log. Ποτέ μεταμφιεσμένη. */
  readonly logMessage: string;
}

export interface ProcurementErrorOutcomeOptions extends ProcurementErrorStatusOptions {
  /**
   * Ο **καθολικός** ρόλος του καλούντος. Υποχρεωτικός επίτηδες: χωρίς αυτόν η
   * απόφαση αποκάλυψης δεν μπορεί να ληφθεί, και μια προαιρετική παράμετρος
   * ασφαλείας είναι αυτή που ξεχνιέται στο επόμενο route (ADR-742 §7.2).
   */
  readonly callerGlobalRole: string;
  /** Το μήνυμα όταν το σφάλμα δεν φέρει δικό του. */
  readonly fallbackError: string;
}

/**
 * Η **αλήθεια** για το log, όταν ο πόρος ανήκει σε άλλον πελάτη.
 *
 * Δομημένη και όχι «το μήνυμα του σφάλματος»: το μήνυμα είναι σκέτο
 * `'Forbidden'` και δεν λέει *ποιος* ζήτησε *τι* — που είναι ακριβώς αυτό που
 * χρειάζεται όποιος ερευνά την απόπειρα.
 */
function crossTenantLogMessage(error: ProcurementCrossTenantError): string {
  const { resource, resourceId } = error.procurementSubject;
  return (
    `Cross-tenant access blocked: ${resource} ${resourceId} ` +
    `(caller=${error.expectedCompanyId}, owner=${error.actualCompanyId || '<none>'})`
  );
}

/**
 * Η απόφαση, μία φορά για κάθε route προμηθειών.
 *
 * Σειρά: **πρώτα οι τυποποιημένοι** φύλακες (ιδιοκτησία, ύπαρξη), μετά τα
 * ονομασμένα σφάλματα του πεδίου ορισμού, τέλος η κληρονομημένη ευρετική.
 *
 * ⚠️ Οι δύο τυποποιημένοι έλεγχοι προηγούνται **και** στο `mode: 'create'`, όπου
 * η παλιά ευρετική δεν κοίταζε καν μήνυμα. Δεν είναι αλλαγή συμπεριφοράς: καμία
 * διαδρομή δημιουργίας δεν ελέγχει ιδιοκτησία (δεν υπάρχει έγγραφο ακόμη), άρα
 * οι κλάδοι είναι αδρανείς εκεί. Μπαίνουν πρώτοι ώστε ένα **μελλοντικό**
 * `create` που θα ελέγξει ιδιοκτησία να μη βγάλει σιωπηλά `500` αντί για
 * μεταμφιεσμένο `404`.
 */
export function resolveProcurementErrorOutcome(
  error: unknown,
  options: ProcurementErrorOutcomeOptions,
): ProcurementErrorOutcome {
  const { callerGlobalRole, fallbackError, ...statusOptions } = options;

  if (error instanceof ProcurementCrossTenantError) {
    const logMessage = crossTenantLogMessage(error);
    return concealCrossTenant<ProcurementErrorOutcome>(callerGlobalRole, {
      // Ο bypass ρόλος έχει ήδη cross-tenant ορατότητα: η ειλικρινής άρνηση δεν
      // του αποκαλύπτει τίποτα νέο και του σώζει τη διάγνωση (ADR-742 §3.3).
      reveal: () => ({ status: 403, message: error.message, logMessage }),
      // Για όλους τους άλλους: **ίδιο εργοστάσιο** με το γνήσιο «δεν βρέθηκε».
      conceal: () => ({
        status: 404,
        message: procurementNotFound(error.procurementSubject).message,
        logMessage,
      }),
    });
  }

  if (error instanceof ProcurementNotFoundError) {
    return { status: 404, message: error.message, logMessage: error.message };
  }

  const message = getErrorMessage(error, fallbackError);
  return {
    status: resolveProcurementErrorStatus(error, statusOptions),
    message,
    logMessage: message,
  };
}
