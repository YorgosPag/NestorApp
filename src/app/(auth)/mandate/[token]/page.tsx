/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — ο σύνδεσμος που του έστειλε το γραφείο.
 * @related ADR-777 §8.33 · services/mandate/mandate-consent.service.ts
 * @module app/(auth)/mandate/[token]/page
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΣΤΟ `(auth)` ΚΑΙ ΟΧΙ ΣΤΟ `(app)` — **ΜΕΤΡΗΜΕΝΟ ΛΑΘΟΣ ΠΟΥ ΔΕΝ ΕΠΑΝΑΛΑΜΒΑΝΕΤΑΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η αδελφή της σελίδα — η πύλη προμηθευτή (`/vendor/quote/[token]`, ADR-327) — δηλώνει
 * στην πρώτη της γραμμή *«Public vendor portal page… **NO Firebase auth**»* και ζει
 * μέσα στο `(app)`, δηλαδή **φοράει ολόκληρο το κέλυφος** της εφαρμογής: sidebar
 * έργων, header, οι βαρείς providers. Σε άνθρωπο **χωρίς λογαριασμό**. Είναι ακριβώς
 * η κλάση σφάλματος που γέννησε το CHECK 3.52 (*«φοράει κέλυφος επειδή κανείς δεν
 * ρώτησε»*), και η πύλη δεν το πιάνει επειδή το `(app)` είναι **δηλωμένο**
 * `wearsShell: true` και η σελίδα δεν καταναλώνει δημόσιο hook.
 *
 * 🔑 **Το `(auth)` δεν είναι συμβιβασμός — είναι η δήλωσή του, κατά λέξη**: *«Οθόνες
 * σύνδεσης/**συγκατάθεσης**. Ο χρήστης φτάνει εδώ **ΧΩΡΙΣ ταυτότητα**»*
 * (`.shell-boundary.json`). Δεν χρειάστηκε νέο route group.
 *
 * ⚠️ **`force-dynamic`**: η σελίδα διαβάζει βάση ανά διακριτικό. Χωρίς αυτό το
 * `next build` θα προσπαθούσε προ-απόδοση διαδρομής που **δεν έχει σταθερή απάντηση**
 * (CHECK 3.55).
 *
 * ⚠️ **`noindex`**: ο σύνδεσμος περιέχει, στην ουσία, διαπιστευτήριο. Ένα ευρετήριο
 * μηχανής αναζήτησης πάνω του θα ήταν διαρροή **χωρίς καμία επίθεση**.
 */

import 'server-only';

import type { Metadata } from 'next';

import { MandateConsentContent } from '@/components/mandate/MandateConsentContent';
import { MandateConsentRefusal } from '@/components/mandate/MandateConsentRefusal';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { readCompanyPublicName } from '@/services/company/company-public-name.reader';
import {
  markMandateViewed,
  readMandateConsentRequest,
} from '@/services/mandate/mandate-consent.service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function MandateConsentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.ReactElement> {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);

  const adminDb = getAdminFirestore();
  const lookup = await readMandateConsentRequest(adminDb, token);

  // 🔴 **Η ΑΡΝΗΣΗ ΕΧΕΙ ΔΙΚΗ ΤΗΣ ΟΘΟΝΗ, ΜΕ ΟΝΟΜΑ ΛΟΓΟΥ.** Ένα σκέτο 404 θα έλεγε στον
  // Κώστα «δεν υπάρχει» και για τον ληγμένο σύνδεσμο και για τον αντικαταστημένο — δύο
  // καταστάσεις όπου **οφείλει να κάνει κάτι**, και μία όπου δεν οφείλει τίποτα.
  if (!lookup.ok) return <MandateConsentRefusal reason={lookup.reason} />;

  // 🔑 **Η ΣΦΡΑΓΙΔΑ «ΤΟ ΕΙΔΕ» ΜΠΑΙΝΕΙ ΕΔΩ, ΚΑΙ ΜΟΝΟ ΕΔΩ** (ADR-777 §8.34). Είναι το
  // σημείο —το μοναδικό σε όλο το σύστημα— όπου γνωρίζουμε ότι **άνθρωπος** άνοιξε τη
  // σελίδα της εντολής του. Μπαίνει **μετά** την άρνηση: ένας ληγμένος ή
  // αντικαταστημένος σύνδεσμος δεν είναι «το είδε», είναι «χτύπησε σε τοίχο».
  //
  // ⚠️ Δεν αναμένεται με `await` πριν την απόδοση για λόγο ταχύτητας; **Όχι** — η
  // αναμονή είναι σκόπιμη: fire-and-forget σε serverless σημαίνει ότι η εγγραφή
  // μπορεί να **μην ολοκληρωθεί ποτέ** όταν η συνάρτηση παγώσει μετά την απάντηση.
  // Το κόστος είναι μία ανάγνωση που κάνει το `null` έλεγχο και σταματά.
  await markMandateViewed(
    adminDb,
    lookup.request.ownerPropertyId,
    lookup.request.nonce,
  );

  const agencyName = await readCompanyPublicName(adminDb, lookup.request.authorCompanyId);

  return (
    <MandateConsentContent
      view={{
        token,
        listingTitle: lookup.request.listingTitle,
        agencyName,
        mandateExpiresAt: lookup.request.mandateExpiresAt,
        currentDecision: lookup.request.currentDecision,
      }}
    />
  );
}
