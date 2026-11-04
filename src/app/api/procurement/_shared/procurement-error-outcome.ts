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
import { ApiError } from '@/lib/api/api-error-types';
import { ProcurementRuleError, PurchaseOrderNotFoundError } from '@/subapps/procurement/services/procurement-rule-error';
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
  /**
   * Σταθερός κωδικός για τη φόρμα, όταν τον δηλώνει το ίδιο το σφάλμα. Μόνο στον τελικό κλάδο: τα
   * σφάλματα ιδιοκτησίας/ύπαρξης δεν έχουν κωδικό, ώστε η μεταμφίεση να μη διακρίνεται από το γνήσιο 404.
   */
  readonly errorCode?: string;
}

/** Ο κωδικός που δηλώνει το σφάλμα (`errorCode`), αν έχει. */
function declaredErrorCode(error: unknown): string | undefined {
  const code = (error as { errorCode?: unknown } | null | undefined)?.errorCode;
  return typeof code === 'string' ? code : undefined;
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

  const raw = getErrorMessage(error, fallbackError);
  const errorCode = declaredErrorCode(error);
  return {
    status: resolveProcurementErrorStatus(error, statusOptions),
    // ADR-603 §Ασπίδα (ΥΨ-1): μόνο σφάλμα που ο κώδικας ΤΥΠΟΠΟΙΗΣΕ για τον πελάτη κρατά το μήνυμά του·
    // ένα ωμό `Error` (Firestore/SDK/κώδικας) παίρνει το `fallbackError` — η αλήθεια μένει στο log.
    message: isClientFacing(error, statusOptions, errorCode) ? raw : fallbackError,
    logMessage: raw,
    ...(errorCode && { errorCode }),
  };
}

/**
 * Είναι το μήνυμα **γραμμένο για τον πελάτη**; Ναι μόνο για `ProcurementRuleError`, για ονομασμένο σφάλμα πεδίου
 * (`conflictName` / `validationName`), για σφάλμα που δηλώνει σταθερό `errorCode`, και για το κληρονομημένο «not found».
 */
function isClientFacing(error: unknown, options: ProcurementErrorStatusOptions, errorCode: string | undefined): boolean {
  if (errorCode || error instanceof ProcurementRuleError) return true;
  if (!(error instanceof Error)) return false;
  if (error.name === options.conflictName || error.name === options.validationName) return true;
  return options.mode === 'mutation' && error.message.includes('not found');
}

/**
 * Τα routes με **ενιαίο 400** (`procurement` POST · `[poId]` PATCH/DELETE · `sourcing-events` POST — ADR-603 Φ1):
 * το **αναμενόμενο** σφάλμα φεύγει 400 με το μήνυμά του (κανόνας πεδίου, κληρονομημένο «not found»), η ιδιοκτησία
 * περνά από τον ίδιο κανόνα αποκάλυψης με τα υπόλοιπα routes (μεταμφιεσμένο 404), και **το απρόβλεπτο ξαναρίχνεται**:
 * το `defineRoute` απαντά γενικό 500 + `requestId`, με το μήνυμα μόνο στο log (ADR-603 §Ασπίδα, ΥΨ-1).
 */
export function rethrowProcurementFailure(error: unknown, callerGlobalRole: string, fallbackError: string): never {
  if (error instanceof ProcurementCrossTenantError || error instanceof ProcurementNotFoundError) {
    const outcome = resolveProcurementErrorOutcome(error, { callerGlobalRole, fallbackError, mode: 'mutation' });
    throw new ApiError(outcome.status, outcome.message);
  }
  if (error instanceof ProcurementRuleError) throw new ApiError(400, error.message);
  if (error instanceof PurchaseOrderNotFoundError) throw new ApiError(404, error.message);
  if (error instanceof Error && error.message.includes('not found')) throw new ApiError(400, error.message);
  throw error;
}
