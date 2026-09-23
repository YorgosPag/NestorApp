/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ ΦΙΛΟΞΕΝΟΥΜΕΝΟΥ** — ο σύνδεσμος που του στείλαμε εμείς.
 * @related ADR-844 Β5 · services/contact/first-contact-guest.service.ts
 * @module app/(auth)/contact/[token]/page
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΕΞΑΡΓΥΡΩΣΗ ΓΙΝΕΤΑΙ **ΕΔΩ, ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ** — ΟΧΙ ΜΕ ΚΛΗΣΗ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο προφανής δρόμος θα ήταν: σελίδα που βάφεται, `useEffect` που καλεί
 * `/api/first-contacts/guest/confirm`. **Είναι λάθος**, και ο λόγος είναι ότι ο
 * άνθρωπος έρχεται από **email**:
 *
 * - Ο μίνι-φυλλομετρητής του Gmail/Outlook, οι επεκτάσεις που κόβουν σενάρια, και το
 *   κλείσιμο της καρτέλας στο πρώτο δευτερόλεπτο είναι **η κανονικότητα** εδώ.
 * - Με πελατική κλήση, η υπόσχεση *«πάτησε τον σύνδεσμο και φεύγει το μήνυμά σου»*
 *   θα εξαρτιόταν από JavaScript **που μπορεί να μη φορτώσει ποτέ**.
 *
 * ⇒ Η πράξη γεννιέται **πριν βαφτεί οτιδήποτε**. Ό,τι κάνει ο πελάτης μετά *(σύνδεση)*
 * είναι **άνεση**, και η αποτυχία της δεν ακυρώνει τίποτα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΣΤΟ `(auth)` — Η ΙΔΙΑ ΑΠΑΝΤΗΣΗ ΜΕ ΤΟ `mandate/[token]`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `.shell-boundary.json` δηλώνει για το `(auth)`: *«Ο χρήστης φτάνει εδώ **ΧΩΡΙΣ
 * ταυτότητα**»* — κατά λέξη αυτή η σελίδα. **Δεν χρειάστηκε νέο route group**, και
 * **δεν** άλλαξε καμία δήλωση κελύφους (CHECK 3.52/3.63).
 *
 * ⚠️ **`force-dynamic`**: διαβάζει βάση ανά διακριτικό και **γράφει**. Χωρίς αυτό το
 * `next build` θα προσπαθούσε προ-απόδοση διαδρομής που **δεν έχει σταθερή απάντηση**
 * (CHECK 3.55).
 *
 * ⚠️ **`noindex`**: ο σύνδεσμος **είναι** διαπιστευτήριο. Ένα ευρετήριο μηχανής
 * αναζήτησης πάνω του θα ήταν διαρροή **χωρίς καμία επίθεση**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ **ΔΕΝ** ΤΑΞΙΔΕΥΕΙ ΣΤΟΝ ΠΕΛΑΤΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η υπηρεσία επιστρέφει ολόκληρο το `FirstContactForSeeker` — **όνομα, email,
 * τηλέφωνο, στόχο, ημερομηνίες**. Η οθόνη χρειάζεται **ένα** πράγμα: *«γεννήθηκε τώρα
 * ή υπήρχε ήδη;»*. Ό,τι περάσει σε client component **γράφεται μέσα στο HTML** και
 * ζει σε κάθε ενδιάμεσο cache. ⇒ Το {@link viewOf} κρατά **μόνο** ό,τι ζωγραφίζεται.
 */

import 'server-only';

import type { Metadata } from 'next';

import { decodeRouteParam } from '@/lib/routes/route-param';
import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';
import { cookies } from 'next/headers';

import { GuestContactContent } from '@/components/contact/GuestContactContent';
import type { GuestContactLinkView } from '@/components/contact/guest-contact-view';
import { SESSION_COOKIE_CONFIG } from '@/lib/auth/security-policy';
import { sessionHolderUid } from '@/lib/auth/token-credentials';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  redeemGuestContactByLink,
  type GuestContactOutcome,
} from '@/services/contact/first-contact-guest.service';

export const dynamic = 'force-dynamic';

// ADR-876 — noindex · no-referrer από το ΕΝΑ SSoT (άγκυρα `credential-link-page.test.ts`).
export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

/**
 * **Η στένωση** — από την πλήρη έκβαση στο ελάχιστο που ζωγραφίζεται.
 *
 * ⚠️ Εξαντλητικό `switch` **χωρίς `default`**: έβδομη έκβαση της υπηρεσίας **δεν
 * μεταγλωττίζεται** μέχρι κάποιος να πει τι βλέπει ο άνθρωπος. Ίδιο ιδίωμα με το
 * `respond()` της αδελφής πόρτας.
 *
 * ⚠️ **Ο λόγος του `identity-refused` ΠΕΦΤΕΙ ΕΔΩ, όπως και στο δίκτυο**: μιλά για
 * **εμάς** *(απενεργοποιημένος λογαριασμός, μυστικό που λείπει)*, και σε δημόσια
 * σελίδα θα επιβεβαίωνε σε τρίτον ότι η διεύθυνση **υπάρχει**.
 *
 * 🔴 **Ο ΣΤΟΧΟΣ ΠΕΡΝΑΕΙ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΑΝΤΙΘΕΤΟ ΤΟΥ ΛΟΓΟΥ ΤΑΥΤΟΤΗΤΑΣ.** Εκείνος
 * πέφτει επειδή μιλά για **εμάς**· αυτός περνά επειδή μιλά για **τον άνθρωπο** — και
 * είναι η **μόνη** πληροφορία που τον βγάζει από τη σελίδα. Χωρίς αυτόν, ο άνθρωπος
 * που άργησε οκτώ μέρες διαβάζει *«πατήστε ξανά «Πλησιάστε»»* και στέκεται σε λευκή
 * σελίδα **χωρίς κουμπί, χωρίς δρόμο πίσω, χωρίς να θυμάται ποια αγγελία ήταν**.
 *
 * ⚠️ **Δεν είναι αποκάλυψη**: ο στόχος είναι δημόσια σελίδα που ο ίδιος **μόλις
 * κοίταζε** — του τη θυμίζουμε, δεν του τη μαθαίνουμε.
 */
function viewOf(outcome: GuestContactOutcome): GuestContactLinkView {
  switch (outcome.kind) {
    case 'contacted':
      return { kind: 'done', created: outcome.created, customToken: outcome.customToken };
    case 'link-refused':
      return { kind: 'link-refused', reason: outcome.reason, target: outcome.target };
    case 'contact-refused':
      return { kind: 'contact-refused', reason: outcome.reason, target: outcome.target };
    case 'invalid':
      return { kind: 'invalid', violations: outcome.violations, target: outcome.target };
    case 'identity-refused':
      return { kind: 'identity-refused', target: outcome.target };
    case 'unavailable':
      return { kind: 'unavailable', target: outcome.target };
  }
}

export default async function GuestContactPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.ReactElement> {
  const { token: raw } = await params;
  // ⚠️ Αποκωδικοποίηση: το Next δίνει το τμήμα **κωδικοποιημένο**, και η υπογραφή δεν στέκει
  //    πάνω σε `%2F`. Μέσω του SSoT (ADR-876): ωμό `decodeURIComponent` ΠΕΤΑ σε κακό `%` ⇒ 500.
  const token = decodeRouteParam(raw);

  // 🔴 **ΜΙΑ ΚΛΗΣΗ, ΚΑΙ ΓΡΑΦΕΙ.** Δεν είναι ανάγνωση: εξαργυρώνει την πρόσκληση,
  //    γεννά ταυτότητα και γράφει την πράξη — όλα μέσα από τον **ΕΝΑΝ** γραφέα.
  //    ⚠️ Γι' αυτό η σελίδα είναι `force-dynamic` **και** `noindex`: ένας crawler που
  //    την άνοιγε θα **εξαργύρωνε** τον σύνδεσμο του ανθρώπου πριν από εκείνον.
  //
  //    🔑 **Ποιος κρατά συνεδρία σε ΑΥΤΟΝ τον φυλλομετρητή** (ADR-844 §13): ένας
  //    σύνδεσμος από email είναι πλοήγηση ανώτατου επιπέδου, άρα το `SameSite=Lax`
  //    cookie **φτάνει**. Ρωτιέται μόνο αν βρεθεί ανεπιβεβαίωτος λογαριασμός.
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_CONFIG.NAME)?.value ?? null;
  const outcome = await redeemGuestContactByLink(
    getAdminFirestore(), token, () => sessionHolderUid(sessionCookie),
  );

  return <GuestContactContent view={viewOf(outcome)} />;
}
