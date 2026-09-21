/**
 * @jest-environment node
 */

/**
 * =============================================================================
 * ADR-841 §7 **Α18.12** — **Η ΕΝΤΟΛΗ ΕΧΕΙ ΔΙΕΥΘΥΝΣΗ, ΚΑΙ ΟΔΗΓΕΙ ΕΚΕΙ ΠΟΥ ΠΡΕΠΕΙ**
 * =============================================================================
 *
 * Το ερώτημα: *«ο επαγγελματίας που έμαθε ότι ο πελάτης **ενέκρινε την εντολή** —
 * φτάνει στην **εντολή**, ή σε λίστα / σε ξένο κόσμο;»*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΘΕ ΚΡΙΤΗΡΙΟ ΠΟΥ **ΑΝΑΚΑΛΥΠΤΕΙ**, ΜΕΤΡΑΕΙ ΚΑΙ **ΠΟΣΑ** ΑΝΑΚΑΛΥΨΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μάθημα της 2026-09-05 *(ADR-841, μάθημα (δ))*: ένα κριτήριο **γεννήθηκε κενό** —
 * έψαχνε εσοχή που δεν υπήρχε, βρήκε **0** κλήσεις, ο βρόχος δεν έτρεξε ποτέ, και η
 * πύλη ήταν **πράσινη επειδή δεν κοίταξε**. Γι' αυτό κάθε `expect` που διατρέχει
 * ευρήματα συνοδεύεται από **παρονομαστή** στο **ίδιο** κριτήριο.
 *
 * ⚠️ **ΔΙΑΒΑΖΕΙ ΠΗΓΑΙΟ ΚΩΔΙΚΑ όπου το ελάττωμα είναι ΑΠΟΥΣΙΑ**, και **εκτελεί** όπου
 * είναι τιμή. Οι δύο τρόποι δεν εναλλάσσονται από γούστο: μια διεύθυνση που δεν
 * κατασκευάζεται ποτέ δεν έχει συμπεριφορά να δοκιμαστεί.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { firstActionUrl } from '@/lib/notifications/notification-destination';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { announceMandateDecision } from '@/services/mandate/mandate-decision-notifier.service';
import { announceMandateRequestAnswer } from '@/services/mandate/mandate-request-notifier.service';
import { orgWorkspace, personalWorkspace } from '@/types/workspace-membership';
import {
  mandateDetailHref,
  MANDATE_CATALOG_ROUTE,
  MANDATE_INBOX_ROUTE,
  NEW_BROKERED_LISTING_ROUTE,
} from '@/lib/mandate/mandate-routes';
import {
  MANDATE_FOUND,
  MANDATE_MISSING,
  MANDATE_NOT_A_MANDATE,
  MANDATE_NOT_YOURS,
} from '@/lib/mandate/mandate-detail-outcome';

const ROOT = process.cwd();
const read = (relative: string): string =>
  fs.readFileSync(path.join(ROOT, relative), 'utf8');

/**
 * **Ό,τι φτάνει στον αγωγό** — η έξοδος των ειδοποιητών, πριν από κάθε κανάλι. Οι
 * δύο ειδοποιητές καλούνται **αληθινοί**· μόνο ο αγωγός αιχμαλωτίζεται.
 */
const dispatched: Record<string, unknown>[] = [];

jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: jest.fn(async (request: Record<string, unknown>) => {
    dispatched.push(request);
    return { success: true, dedupeKey: 'k', skipped: false };
  }),
}));

beforeEach(() => {
  dispatched.length = 0;
});

const LISTING = 'ownp_abc';
const AGENCY = 'comp_alfa';
/** Ο **υπάλληλος** που καταχώρησε — παραλήπτης της απόφασης. */
const CLERK = 'user_maria';
/** Ο **ιδιώτης** που ζήτησε — παραλήπτης της απάντησης. */
const PRIVATE_OWNER = 'user_kostas';

const DETAIL_ROUTE = 'src/app/api/owner-properties/brokered/[ownerPropertyId]/route.ts';
const DETAIL_PAGE =
  'src/app/(app)/o/[workspace]/listings/mandates/[ownerPropertyId]/page.tsx';

describe('ADR-841 §7 Α18.12 — η εντολή έχει διεύθυνση', () => {
  // ===========================================================================
  // Μ1 — Η ΔΙΕΥΘΥΝΣΗ ΧΤΙΖΕΤΑΙ, ΚΑΙ ΚΩΔΙΚΟΠΟΙΕΙ
  // ===========================================================================

  it('Μ1 — η διεύθυνση κρέμεται από τον κατάλογο και ΚΩΔΙΚΟΠΟΙΕΙ την ταυτότητα', () => {
    expect(mandateDetailHref('ownp_abc')).toBe(`${MANDATE_CATALOG_ROUTE}/ownp_abc`);

    // 🔴 **Ο ΛΟΓΟΣ ΠΟΥ ΕΙΝΑΙ ΣΥΝΑΡΤΗΣΗ ΚΑΙ ΟΧΙ ΠΡΟΤΥΠΟ ΣΥΜΒΟΛΟΣΕΙΡΑΣ.** Χωρίς
    //    `encodeURIComponent`, ένα `?` ή `#` μέσα σε ταυτότητα θα έκοβε τη διαδρομή στη
    //    μέση και ο άνθρωπος θα προσγειωνόταν στον **κατάλογο** — δηλαδή αστοχία
    //    **σιωπηλή** και **σε ένα μόνο έγγραφο**, το χειρότερο είδος.
    expect(mandateDetailHref('a?b#c')).toBe(`${MANDATE_CATALOG_ROUTE}/a%3Fb%23c`);
    expect(mandateDetailHref('a/b')).toBe(`${MANDATE_CATALOG_ROUTE}/a%2Fb`);
  });

  // ===========================================================================
  // Μ2 — ΤΟ ΔΥΝΑΜΙΚΟ ΤΜΗΜΑ ΔΕΝ ΣΚΙΑΖΕΙ ΤΙΣ ΣΤΑΤΙΚΕΣ ΑΔΕΛΦΕΣ ΤΟΥ
  // ===========================================================================

  /**
   * 🔴 **ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΟΣ ΚΙΝΔΥΝΟΣ, ΟΧΙ ΘΕΩΡΗΤΙΚΟΣ.** Το `/listings/mandates/new` και
   * το `/listings/mandates/requests` είναι **στατικά αδέλφια** του `[ownerPropertyId]`.
   * Ο δρομολογητής κρίνει τα στατικά **πρώτα**, άρα εκείνα κρατούν τις διευθύνσεις
   * τους — αλλά μια εντολή με ταυτότητα `new` θα έπαιρνε σύνδεσμο που οδηγεί στη
   * **φόρμα δημιουργίας**, και ο μεσίτης δεν θα καταλάβαινε ποτέ γιατί.
   *
   * ⇒ Το κριτήριο **εκτελεί** τη σύγκρουση αντί να την υποθέτει.
   */
  it('Μ2 🔴 — καμία διεύθυνση εντολής δεν πέφτει πάνω σε στατική αδελφή', () => {
    const siblings = [NEW_BROKERED_LISTING_ROUTE, MANDATE_INBOX_ROUTE];
    // ΠΑΡΟΝΟΜΑΣΤΗΣ: αν κάποιος σβήσει τις σταθερές, το κριτήριο δεν επιτρέπεται να
    // γίνει κενό και πράσινο.
    expect(siblings.length).toBe(2);

    for (const sibling of siblings) {
      const lastSegment = sibling.slice(MANDATE_CATALOG_ROUTE.length + 1);
      expect(lastSegment).not.toBe('');

      // Η σύγκρουση **υπάρχει** αν κάποιος δώσει αυτή την ταυτότητα…
      expect(mandateDetailHref(lastSegment)).toBe(sibling);

      // …και είναι **αδύνατη** επειδή κάθε ταυτότητα ακινήτου φέρει το πρόθεμά της.
      // ⚠️ Το κριτήριο δεν λέει «δεν θα συμβεί»· λέει **γιατί** δεν μπορεί.
      expect(lastSegment.startsWith('ownp_')).toBe(false);
    }
  });

  // ===========================================================================
  // Μ3 — Ο ΕΙΔΟΠΟΙΗΤΗΣ ΑΠΟΦΑΣΗΣ ΣΤΕΛΝΕΙ ΣΤΟ ΓΡΑΦΕΙΟ
  // ===========================================================================

  /**
   * 🔴 **ΕΚΤΕΛΕΙ ΤΟΝ ΕΙΔΟΠΟΙΗΤΗ, ΔΕΝ ΔΙΑΒΑΖΕΙ ΤΗΝ ΠΗΓΗ ΤΟΥ** (2026-09-21). Η πρώτη
   * εκδοχή έψαχνε κειμενικά ένα literal `actions: [ … ]` — και **τυφλώθηκε** όταν το
   * `8da65273` (ADR-849 §6δ Β1) μετέφερε τον προορισμό στον κεντρικό κατασκευαστή
   * `viewDestination(...)`: 0 ευρήματα ⇒ κόκκινο, ενώ η συμπεριφορά ήταν **ίδια**. Ο
   * προορισμός είναι **τιμή**, άρα κρίνεται στην **έξοδο** του αγωγού — ό,τι φτάνει στο
   * `dispatchNotification` — ανεξάρτητα από το πώς γράφτηκε.
   */
  it('Μ3 🔴 — ο ειδοποιητής ΑΠΟΦΑΣΗΣ οδηγεί στην εντολή, ΟΧΙ στον ιδιωτικό χώρο', async () => {
    const sent = await announceMandateDecision(new FakeFirestore() as unknown as AdminFirestore, {
      ownerPropertyId: LISTING,
      listingTitle: 'Οικόπεδο Κώστα',
      clientContactId: 'cont_kostas',
      recipientUserId: CLERK,
      tenantId: AGENCY,
      custody: { kind: 'company', companyId: AGENCY },
      previous: 'pending',
      next: 'confirmed',
      decidedAt: '2026-08-21T10:00:00.000Z',
    });

    // ΠΑΡΟΝΟΜΑΣΤΗΣ: ο αγωγός όντως έστειλε **μία** ειδοποίηση.
    expect(sent).toBe(true);
    expect(dispatched).toHaveLength(1);

    expect(firstActionUrl(dispatched[0]?.actions)).toBe(mandateDetailHref(LISTING));
    // 🔴 Ο παραλήπτης είναι **υπάλληλος γραφείου**: το `(me)/offers/<id>` είναι ο
    //    **ιδιωτικός χώρος του ιδιώτη** και δεν έχει ούτε την κατάσταση της εντολής
    //    ούτε τα κουμπιά της.
    expect(firstActionUrl(dispatched[0]?.actions)).not.toBe(offerDetailHref(LISTING));
    expect(dispatched[0]?.workspace).toEqual(orgWorkspace(AGENCY));
  });

  // ===========================================================================
  // Μ4 — ΚΑΙ Ο ΑΔΕΛΦΟΣ ΤΟΥ ΔΕΝ ΠΑΡΑΣΥΡΘΗΚΕ
  // ===========================================================================

  /**
   * 🔑 **ΤΟ ΜΑΘΗΜΑ «ΜΕΤΡΑ ΚΑΙ ΤΟΝ ΑΔΕΛΦΟ», ΑΝΤΙΣΤΡΟΦΑ.** Οι δύο ειδοποιητές εντολής
   * μοιάζουν· έχουν **αντίθετους παραλήπτες**:
   *
   * | Παραγωγός | Παραλήπτης | Σωστός προορισμός |
   * |---|---|---|
   * | `mandate-decision-notifier` | `property.authorUserId` — ο **υπάλληλος** | το γραφείο |
   * | `mandate-request-notifier` | `requestedByUserId` — ο **ιδιώτης** | το `(me)/offers` |
   *
   * ⇒ Μια «συνεπής» αλλαγή **και στους δύο** θα έστελνε τον ιδιώτη σε οθόνη γραφείου
   * που ο κανόνας Firestore **δεν** του ανοίγει. Το κριτήριο φυλά ότι ο δεύτερος
   * **έμεινε ακέραιος**.
   */
  it('Μ4 🔴 — ο ειδοποιητής ΑΙΤΗΜΑΤΟΣ μένει στον ιδιωτικό χώρο του ιδιώτη', async () => {
    const sent = await announceMandateRequestAnswer(new FakeFirestore() as unknown as AdminFirestore, {
      requestId: 'mreq_1',
      ownerPropertyId: LISTING,
      recipientUserId: PRIVATE_OWNER,
      agencyName: 'Άλφα Ακίνητα',
      decision: 'accepted',
    });

    expect(sent).toBe(true);
    expect(dispatched).toHaveLength(1); // ΠΑΡΟΝΟΜΑΣΤΗΣ

    expect(firstActionUrl(dispatched[0]?.actions)).toBe(offerDetailHref(LISTING));
    expect(firstActionUrl(dispatched[0]?.actions)).not.toBe(mandateDetailHref(LISTING));
    // …και ο χώρος είναι ο **δικός του** — ποτέ του γραφείου που απάντησε.
    expect(dispatched[0]?.workspace).toEqual(personalWorkspace(PRIVATE_OWNER));
  });

  // ===========================================================================
  // Μ5 — ΤΟ ΞΕΝΟ ΕΓΓΡΑΦΟ ΔΕΝ ΔΙΑΡΡΕΕΙ
  // ===========================================================================

  /**
   * 🔴 Η υπηρεσία ξεχωρίζει **τέσσερις** εκβάσεις· το σύρμα μεταφέρει **τρεις**. Αν το
   * `not-yours` έφτανε στον πελάτη, η διαδρομή θα γινόταν **μετρητής ύπαρξης**: ρωτάς
   * 1.000 ταυτότητες και μαθαίνεις ποιες υπάρχουν σε *κάποιο* γραφείο.
   */
  it('Μ5 🔴 — το `not-yours` δεν φεύγει ποτέ στο σύρμα', () => {
    const outcomes = [MANDATE_FOUND, MANDATE_MISSING, MANDATE_NOT_A_MANDATE, MANDATE_NOT_YOURS];
    expect(new Set(outcomes).size).toBe(4); // ΠΑΡΟΝΟΜΑΣΤΗΣ: τέσσερα ΔΙΑΚΡΙΤΑ ονόματα

    const route = read(DETAIL_ROUTE);
    // Ο διακομιστής χειρίζεται τις τρεις ρητά…
    for (const kind of [MANDATE_FOUND, MANDATE_MISSING, MANDATE_NOT_A_MANDATE]) {
      expect(route).toContain(kind === MANDATE_FOUND ? 'MANDATE_FOUND' : `MANDATE_${kind.toUpperCase().replace(/-/g, '_')}`);
    }
    // …και το τέταρτο **δεν αναφέρεται καν** στη διαδρομή.
    expect(route).not.toContain('MANDATE_NOT_YOURS');
  });

  // ===========================================================================
  // Μ6 — Η ΟΘΟΝΗ ΥΠΑΡΧΕΙ, ΚΑΙ ΕΙΝΑΙ ΣΤΟΝ ΧΩΡΟ ΤΟΥ ΓΡΑΦΕΙΟΥ
  // ===========================================================================

  /**
   * ⚠️ *«Υπάρχει η σελίδα»* ≠ *«δείχνει την εντολή»* — αυτό το κρίνει το περπάτημα σε
   * φυλλομετρητή. Εδώ κρίνεται το **προηγούμενο** ερώτημα, που είναι φθηνό και δυαδικό:
   * **υπάρχει αρχείο στη διαδρομή που υπόσχεται ο helper;** Χωρίς αυτό, το Μ1 θα ήταν
   * πράσινο δείχνοντας σε **404**.
   */
  it('Μ6 — η διεύθυνση αντιστοιχεί σε υπαρκτή σελίδα, μέσα στο `(app)`', () => {
    expect(fs.existsSync(path.join(ROOT, DETAIL_PAGE))).toBe(true);

    // 🔴 **Στο `(app)`, ΠΟΤΕ στο `(me)`**: το `.shell-boundary.json` δηλώνει το `(me)`
    //    ως «ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ ΤΟΥ ΙΔΙΩΤΗ», και ο κατάλογος διαβάζει κατά
    //    `authorCompanyId` — περιουσία του **γραφείου**.
    expect(DETAIL_PAGE).toContain('(app)/o/[workspace]/');

    // Η σελίδα δείχνει στη διεύθυνση που παράγει ο helper — ίδιο τελευταίο τμήμα.
    expect(DETAIL_PAGE).toContain(`${MANDATE_CATALOG_ROUTE}/[ownerPropertyId]`);
  });
});
