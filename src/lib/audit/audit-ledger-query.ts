/**
 * 🔎 **ΠΟΙΟ ΦΙΛΤΡΟ ΔΙΚΑΙΟΥΤΑΙ ΕΝΑ ΑΙΤΗΜΑ ΑΝΑΓΝΩΣΗΣ ΙΣΤΟΡΙΚΟΥ** — ADR-864 Φ1β
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ ΒΙΒΛΙΟ ΕΙΝΑΙ ΑΙΤΗΜΑ ΚΑΙ ΟΧΙ ΣΥΜΠΕΡΑΣΜΑ ΑΠΟ ΤΟΝ ΔΡΩΝΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πρώτη ιδέα ήταν *«πολίτης ⇒ προσωπικό βιβλίο, μέλος εταιρείας ⇒ εταιρικό»*. **Μετρήθηκε
 * λάθος**: το `buildApiIdentity` δίνει `scope: 'organization'` σε **κάθε** άνθρωπο με claim
 * εταιρείας — **και όταν ενεργεί στον ιδιωτικό του χώρο**. Ένας μεσίτης που πουλά και το δικό
 * του διαμέρισμα ως ιδιώτης δεν θα έβλεπε **ποτέ** το ιστορικό της δικής του αγγελίας.
 *
 * 🔑 Άρα ο αναγνώστης **ζητά** βιβλίο (το παράγει από τη θεματοφυλακή της οντότητας που
 * δείχνει), και ο διακομιστής αποφασίζει **με ποια τιμή** φιλτράρει:
 *
 *   | ζητά      | φίλτρο                     | ποιος το δικαιούται                    |
 *   |-----------|----------------------------|----------------------------------------|
 *   | `company` | `companyId == ctx.companyId` | **μόνο** δρων με οργανισμό           |
 *   | `personal`| `userId == ctx.uid`        | **κάθε** πιστοποιημένος — για τον εαυτό του |
 *
 * ⚠️ **Η τιμή του φίλτρου ΔΕΝ έρχεται ΠΟΤΕ από το αίτημα.** Το χειρότερο που μπορεί να ζητήσει
 * κάποιος είναι το **δικό του** βιβλίο.
 *
 * **Layering**: καθαρή συνάρτηση — δοκιμάζεται χωρίς Next, χωρίς Firestore.
 *
 * @module lib/audit/audit-ledger-query
 */

import type { ApiActor } from '@/lib/auth/personal-scope-middleware';
import type { AuditLedgerKind } from '@/lib/audit/audit-ledger';
import { FIELDS } from '@/config/firestore-field-constants';

/** Το φίλτρο εμβέλειας που εφαρμόζεται στο ερώτημα — πεδίο **και** τιμή, από τον διακομιστή. */
export type AuditLedgerFilter =
  | { readonly field: typeof FIELDS.COMPANY_ID; readonly value: string }
  | { readonly field: typeof FIELDS.USER_ID; readonly value: string };

/**
 * **Το φίλτρο που δικαιούται ο δρων για το βιβλίο που ζήτησε.**
 *
 * @returns `null` ⇒ **άρνηση**: εταιρικό βιβλίο από δρώντα **χωρίς** οργανισμό.
 */
export function auditLedgerFilter(actor: ApiActor, kind: AuditLedgerKind): AuditLedgerFilter | null {
  if (kind === 'personal') {
    return { field: FIELDS.USER_ID, value: actor.ctx.uid };
  }
  return actor.scope === 'organization'
    ? { field: FIELDS.COMPANY_ID, value: actor.ctx.companyId }
    : null;
}
