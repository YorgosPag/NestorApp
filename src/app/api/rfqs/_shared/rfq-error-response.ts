/**
 * Το σύνορο αποκάλυψης της **παλιάς** οικογένειας `api/rfqs/[id]/**`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΥΤΕΡΟ ΣΥΝΟΡΟ ΚΑΙ ΟΧΙ ΤΟ `procurement-error-outcome`
 * ─────────────────────────────────────────────────────────────────────────────
 * Δεν είναι διχοτόμηση της πολιτικής — η **απόφαση** είναι η ίδια
 * (`concealCrossTenant`, ADR-742 §3.3). Διαφέρει το **σχήμα του σύρματος**:
 *
 * | Οικογένεια | Επιτυχία | Σφάλμα |
 * |---|---|---|
 * | `api/procurement/**` (ADR-603) | `ok()` / `created()` | `httpError(status, message)` |
 * | `api/rfqs/[id]/**` (χειρόγραφο `withAuth`) | `{ success: true, data }` | `{ success: false, error }` |
 *
 * Η μεταμφίεση **πρέπει να ακολουθεί το σχήμα της διαδρομής**: αν το ψεύτικο
 * 404 έβγαινε στο σχήμα της άλλης οικογένειας, **το σχήμα και μόνο** θα
 * πρόδιδε τη διαφορά — ακριβώς ο λόγος που το `DELETE` της Φάσης Β κράτησε το
 * δικό του `{ deleted: false }` (ADR-742 §7.1).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ ΑΛΛΑΖΕΙ ΕΔΩ — ΔΗΛΩΜΕΝΟ, ΟΧΙ ΣΙΩΠΗΛΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Πριν, οι τρεις μεταβολές (`PATCH`, `DELETE`, `cancel`, `reopen`) έπιαναν
 * **κάθε** σφάλμα με γενικό `catch` και απαντούσαν **`400` + το μήνυμα της
 * υπηρεσίας**. Δηλαδή:
 *
 * - «δεν υπάρχει» → `400 RFQ x not found` (λάθος κωδικός· έπρεπε 404)
 * - «ανήκει αλλού» → `400 Forbidden` — **ρητή αποκάλυψη με λάθος κωδικό**:
 *   ο καλών μάθαινε ότι το id υπάρχει, απλώς με 400 αντί για 403
 *
 * Πλέον: «δεν υπάρχει» και «ανήκει αλλού» δίνουν **ταυτόσημο** `404` για τους
 * μη-bypass καλούντες· ο bypass ρόλος παίρνει ειλικρινές `403`. Οι υπόλοιποι
 * κλάδοι (επικύρωση, μεταβάσεις κατάστασης, `PO_EXISTS`) μένουν **ακριβώς**
 * όπως ήταν.
 *
 * @module app/api/rfqs/_shared/rfq-error-response
 * @see ADR-742 §3.3, §3.4, §7.1 · §7ter.5 (η διπλή σημασιολογία του `getRfq`)
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { concealCrossTenant } from '@/lib/auth/tenant-ownership';
import {
  ProcurementCrossTenantError,
  ProcurementNotFoundError,
  procurementNotFound,
} from '@/subapps/procurement/services/procurement-ownership';
import { getErrorMessage } from '@/lib/error-utils';

/** Το σώμα σφάλματος αυτής της οικογένειας — μία γραφή, όχι έξι. */
function errorBody(message: string, code: string | null): NextResponse {
  return NextResponse.json(
    code === null ? { success: false, error: message } : { success: false, error: message, code },
    { status: 400 },
  );
}

export interface RfqErrorOptions {
  /** Ο **καθολικός** ρόλος του καλούντος. Υποχρεωτικός: χωρίς αυτόν δεν υπάρχει απόφαση. */
  readonly callerGlobalRole: string;
  /** Το `code` που εκθέτει η διαδρομή (μόνο το `reopen` το κάνει· αλλού `undefined`). */
  readonly exposeCode?: boolean;
}

/**
 * Χαρτογραφεί ένα σφάλμα υπηρεσίας στην απόκριση **αυτής** της οικογένειας.
 *
 * 🔴 Ο κλάδος `conceal` **δεν γράφει** μήνυμα «δεν βρέθηκε»: καλεί το ίδιο
 * εργοστάσιο ({@link procurementNotFound}) με τα ορίσματα που ταξιδεύουν μέσα
 * στο σφάλμα ιδιοκτησίας — άρα το γνήσιο και το μεταμφιεσμένο δεν μπορούν να
 * αποκλίνουν χωρίς να αλλάξει **αυτή** η γραμμή (ADR-742 §7.1).
 */
export function rfqErrorResponse(error: unknown, options: RfqErrorOptions): NextResponse {
  const code = options.exposeCode ? ((error as { code?: string }).code ?? null) : null;

  if (error instanceof ProcurementCrossTenantError) {
    return concealCrossTenant<NextResponse>(options.callerGlobalRole, {
      // Ο bypass ρόλος έχει ήδη cross-tenant ορατότητα: η ειλικρινής άρνηση
      // δεν του αποκαλύπτει τίποτα νέο και του σώζει τη διάγνωση (§3.3).
      reveal: () =>
        NextResponse.json({ success: false, error: error.message }, { status: 403 }),
      conceal: () => rfqNotFoundResponse(procurementNotFound(error.procurementSubject).message),
    });
  }

  if (error instanceof ProcurementNotFoundError) {
    return rfqNotFoundResponse(error.message);
  }

  // ⚠️ Το `PO_EXISTS` του `reopen` μαρτυρά ότι ο πόρος **υπάρχει και σου
  // ανήκει** — πληροφορία που ο χρήστης δικαιούται. Δεν μεταμφιέζεται
  // (ίδιος διαχωρισμός με το «locked» της Φάσης Β, ADR-742 §7.3).
  if (code === 'PO_EXISTS') {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error), code },
      { status: 409 },
    );
  }

  return errorBody(getErrorMessage(error), options.exposeCode ? code : null);
}

/**
 * Το **γνήσιο** «δεν βρέθηκε» αυτής της οικογένειας — και, στο σύνορο, το
 * μεταμφιεσμένο. Μία γραφή, δύο κλάδοι.
 */
export function rfqNotFoundResponse(message = 'Not found'): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 404 });
}
