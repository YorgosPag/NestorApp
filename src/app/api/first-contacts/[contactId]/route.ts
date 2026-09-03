import 'server-only';

/**
 * @fileoverview **Η ΑΠΟΣΥΡΣΗ — «ΔΕΝ ΜΕ ΕΝΔΙΑΦΕΡΕΙ ΠΙΑ»** (ADR-843 ΠΕ5 + ΠΕ6).
 * @related services/contact/first-contact.service.ts · types/first-contact.ts
 * @module app/api/first-contacts/[contactId]/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΜΙΑ ΠΡΑΞΗ ΓΙΑ ΔΥΟ ΣΚΟΠΟΥΣ — ΚΑΙ ΓΙ' ΑΥΤΟ ΜΙΑ ΔΙΕΥΘΥΝΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το *«κλείνω για να ελευθερώσω θέση»* (ΠΕ5) και το *«αποσύρω τα στοιχεία μου»* (ΠΕ6)
 * είναι **η ίδια πράξη**: *«δεν με ενδιαφέρει πια»* **είναι** ο λόγος που ελευθερώνει
 * τη θέση **και** ο λόγος που κλείνει τη σχέση. Δύο ρήματα εδώ θα σήμαιναν δύο
 * καταστάσεις για τον ίδιο άξονα — **δεύτερη αλήθεια** (ADR-749), και θα ξαναγεννούσαν
 * ακριβώς το φάντασμα που το ΠΕ5 εξαφάνισε: πράξη που **δείχνει** κλειστή και
 * **συμπεριφέρεται** ανοιχτή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΛΕΕΙ Η ΟΘΟΝΗ ΠΟΥ ΚΑΛΕΙ ΑΥΤΗ ΤΗ ΔΙΕΥΘΥΝΣΗ (Κ10)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **ΠΟΤΕ** *«διαγράφονται τα στοιχεία σου»*. Δεν υπάρχει κουμπί που κάνει άνθρωπο να
 * ξεχάσει: ο προσφέρων μπορεί να έχει το τηλέφωνο σε χαρτί ή στις επαφές του. Λέει
 * **«σταματά η πρόσβαση από εδώ — ό,τι είδε, το είδε»**, και το `seenAt` της πράξης
 * είναι ο **μόνος** τρόπος να ξέρουμε αν είδε **κάτι**.
 *
 * *Μια υπόσχεση που δεν μπορούμε να κρατήσουμε είναι **χειρότερη** από καμία*: ο
 * άνθρωπος που πίστεψε ότι σβήστηκε παίρνει **λάθος απόφαση με σιγουριά**.
 *
 * ⛔ **ΤΟ ΣΥΝΟΛΟ ΚΑΤΑΝΑΛΩΤΩΝ ΕΙΝΑΙ ΚΛΕΙΣΤΟ** (ADR-817 §5) — δηλωμένη **με λόγο** στο
 * `lib/auth/__tests__/personal-scope-consumers.test.ts`.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import {
  withPersonalOrOrgAuth,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { withdrawFirstContact } from '@/services/contact/first-contact.service';
import type { FirstContactForSeeker } from '@/types/first-contact';
import { firstContactWithdrawalSchema } from '../first-contact-body';
import { firstContactRequestContext } from '../first-contact-request-context';
import { firstContactWriteFailure } from '../first-contact-write-failure';

type RouteContext = { params: Promise<{ contactId: string }> };

type WithdrawalResponse =
  /** 🔑 Και το `withdrawn: false` επιστρέφει την πράξη: η δεύτερη απόσυρση **πέτυχε**. */
  | { readonly contact: FirstContactForSeeker; readonly withdrawn: boolean }
  | { readonly error: 'CONTACT_ABSENT' }
  | { readonly error: 'MALFORMED_BODY' }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με «δεν υπάρχει» (N.12). */
  | { readonly error: 'CONTACT_UNVERIFIED' }
  | { readonly error: 'WRITE_FAILED' };

async function withdrawHandler(
  request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse<WithdrawalResponse>> {
  const params = await routeContext?.params;
  const contactId = params?.contactId?.trim() ?? '';
  if (contactId === '') {
    return NextResponse.json({ error: 'MALFORMED_BODY' } as const, { status: 400 });
  }

  const parsed = await readJsonBody(request, firstContactWithdrawalSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const { db, seeker, at } = firstContactRequestContext(actor);
  const result = await withdrawFirstContact(db, seeker, contactId, at);

  // ⚠️ Κλειστό σύνολο, **χωρίς `default`**: έκτη κατάσταση **δεν μεταγλωττίζεται**.
  switch (result.kind) {
    case 'withdrawn':
      return NextResponse.json({ contact: result.contact, withdrawn: true });
    case 'unchanged':
      // 🔑 **200.** Η δεύτερη απόσυρση δεν μετακινεί τη σφραγίδα χρόνου — το ΠΕ6 κρατά
      //    **πότε**, και το «πότε» είναι η **πρώτη** φορά.
      return NextResponse.json({ contact: result.contact, withdrawn: false });
    case 'absent':
      // **404, ποτέ 403.** Ένα 403 θα **επιβεβαίωνε την ύπαρξη** ξένης πράξης σε
      //    όποιον μαντεύει ταυτότητες — απαρίθμηση ένα ερώτημα τη φορά.
      return NextResponse.json({ error: 'CONTACT_ABSENT' } as const, { status: 404 });
    case 'unavailable':
    case 'failed':
      // Ο γραφέας των δύο κοινών αστοχιών είναι **ένας** (ADR-843).
      return firstContactWriteFailure(result.kind);
  }
}

export const PATCH = withStandardRateLimit(
  withPersonalOrOrgAuth<WithdrawalResponse, RouteContext>(withdrawHandler),
);
