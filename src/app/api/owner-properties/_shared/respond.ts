/**
 * @fileoverview **ΑΠΟΤΕΛΕΣΜΑ ΠΥΛΗΣ → ΑΠΑΝΤΗΣΗ HTTP** — μία μετάφραση, δύο διαδρομές.
 * @related ADR-777 §7 (Α14) · services/owner-property/owner-property-write.service.ts
 * @module app/api/owner-properties/_shared/respond
 *
 * 🔴 **Εξήχθη επειδή οι δύο διαδρομές (δημιουργία · επεξεργασία/απόσυρση) κάνουν την
 * ΙΔΙΑ μετάφραση.** Γραμμένη δύο φορές, θα ήταν κλώνος που μπλοκάρει το **CHECK
 * 3.28**, και —χειρότερα— θα απέκλινε: η μία διαδρομή θα μάθαινε μια νέα κατάσταση
 * του {@link OwnerPropertyWriteResult} και η άλλη θα την έστελνε ως **500**.
 *
 * ⚠️ **Κάθε κατάσταση απαντάται ρητά, χωρίς `default`** — άρα πέμπτη κατάσταση στην
 * πύλη **δεν μεταγλωττίζεται** μέχρι κάποιος να αποφασίσει τι σημαίνει για το δίκτυο.
 * Είναι το ίδιο ιδίωμα «κλειστό σύνολο, ποτέ σιωπηλό `default`» που φρουρεί τις πύλες
 * του έργου.
 */

import { NextResponse } from 'next/server';

import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write.service';
import type { PublishOutcome } from '@/services/listings/publish-public-listing';
import type { OwnerProperty } from '@/types/owner-property';
import type { OwnerPropertyInvariant } from '@/types/owner-property-invariants';
import type { MandateInvariant } from '@/types/owner-property-mandate';

/**
 * Ό,τι φεύγει προς τον πελάτη σε **επιτυχία**.
 *
 * 🔑 **Το `publish` ταξιδεύει, και είναι υποχρέωση προς τον ιδιοκτήτη.** Ο γραφέας
 * της προβολής **δεν πετά ποτέ** — επιστρέφει `'failed'` ονομαστικά — οπότε χωρίς
 * αυτό το πεδίο ο άνθρωπος θα έβλεπε «αποθηκεύτηκε» και **δεν θα μάθαινε ποτέ** ότι
 * η αγγελία του δεν έφτασε στον χάρτη. Η **Α22** δεσμεύτηκε στο αντίθετο: *«δεν
 * δημοσιεύεται, **αλλά το λέμε καθαρά** στον ιδιοκτήτη»*.
 */
export interface OwnerPropertyWriteResponse {
  readonly property: OwnerProperty;
  readonly publish: PublishOutcome;
}

/** Ό,τι φεύγει σε **αποτυχία που ο άνθρωπος μπορεί να διορθώσει**. */
export interface OwnerPropertyErrorResponse {
  readonly error: string;
  /** Οι κωδικοί γίνονται **κλειδιά i18n** στην οθόνη (N.11) — ποτέ ωμό κείμενο εδώ. */
  readonly violations?: readonly OwnerPropertyInvariant[] | readonly MandateInvariant[];
  /** Μονοπάτια πεδίων που δεν διαβάστηκαν καν ως σχήμα. */
  readonly malformed?: readonly string[];
}

export type OwnerPropertyResponse =
  | OwnerPropertyWriteResponse
  | OwnerPropertyErrorResponse;

/**
 * **Αποτέλεσμα πύλης → HTTP.**
 *
 * | Κατάσταση | Κωδικός | Γιατί |
 * |---|---|---|
 * | `saved` | **200** | ...ακόμη κι όταν `publish: 'failed'` — **η δουλειά του κατόχου έγινε**· η προβολή είναι παράγωγο και το λέμε στο σώμα |
 * | `invalid` | **422** | Το αίτημα ήταν **κατανοητό** και η οντότητα άκυρη — 400 θα σήμαινε «δεν σε κατάλαβα», που είναι ψέμα και στέλνει τον πελάτη να ψάξει το JSON του |
 * | `absent` | **404** | *«Δεν υπάρχει **για σένα**»* — και το 403 απαγορεύεται: θα **επιβεβαίωνε** την ύπαρξη ξένου εγγράφου |
 * | `invalid-mandate` | **422** | Ίδιος κωδικός, **άλλο σφάλμα**: το πρόβλημα είναι στην **εντολή** (πελάτης · λήξη · βεβαίωση), όχι στο ακίνητο. Η οθόνη το χρειάζεται ξεχωριστά για να δείξει το σωστό μέρος της φόρμας |
 * | `failed` | **500** | Δεν φτάσαμε στη βάση· ο άνθρωπος δεν έχει τι να διορθώσει |
 */
export function respondToWrite(
  result: OwnerPropertyWriteResult,
): NextResponse<OwnerPropertyResponse> {
  switch (result.kind) {
    case 'saved':
      return NextResponse.json({ property: result.property, publish: result.publish });
    case 'invalid':
      return NextResponse.json(
        { error: 'INVALID_LISTING', violations: result.violations },
        { status: 422 },
      );
    case 'invalid-mandate':
      return NextResponse.json(
        { error: 'INVALID_MANDATE', violations: result.violations },
        { status: 422 },
      );
    case 'absent':
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    case 'failed':
      return NextResponse.json({ error: 'WRITE_FAILED' }, { status: 500 });
  }
}

/** Το σώμα δεν διαβάστηκε ως σχήμα — **400**, γιατί εδώ όντως «δεν σε κατάλαβα». */
export function respondToMalformed(
  malformed: readonly string[],
): NextResponse<OwnerPropertyResponse> {
  return NextResponse.json({ error: 'MALFORMED_BODY', malformed }, { status: 400 });
}
