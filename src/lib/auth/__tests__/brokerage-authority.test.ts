/**
 * @fileoverview **Η ΑΔΕΙΑ ΠΟΥ ΔΕΝ ΖΗΤΗΘΗΚΕ ΠΟΤΕ** — ο φρουρός της ρυθμιζόμενης πράξης.
 * @related ADR-824 §6 · §8 · lib/auth/brokerage-authority.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι τις 2026-08-27 η πόρτα `POST /api/owner-properties/brokered` ήταν σκέτο
 * `withAuth`: **οποιοδήποτε** γραφείο —αρχιτεκτονικό, τεχνικό, δικηγορικό,
 * λογιστικό— μπορούσε να δημοσιεύσει αγγελία για **ξένο** ακίνητο. Ο **Ν. 4072/2012**
 * (άρθρα 197-204) το επιτρέπει μόνο σε εγγεγραμμένους μεσίτες.
 *
 * ⚠️ **Το μενού δεν ήταν φρουρός, και το ομολογούσε**: το tooltip του επιλογέα
 * «δουλειάς» γράφει *«Δεν αλλάζει δικαιώματα — **μόνο τι εμφανίζεται**»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΔΗΛΩΜΕΝΟ ΟΡΙΟ — ΤΙ **ΔΕΝ** ΜΠΟΡΕΙ ΝΑ ΔΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το Jest τρέχει με **@swc/jest**, που **σβήνει τους τύπους**. Άρα η κεντρική
 * εγγύηση του ADR-824 §6 — *«διαδρομή που ξεχνά τον έλεγχο **δεν μεταγλωττίζεται**»*
 * — **δεν είναι ελέγξιμη εδώ**. Τα δύο όργανα δηλώνονται χωριστά:
 *
 * | Εγγύηση | Ποιος την επιβάλλει |
 * |---|---|
 * | *«ο γραφέας **δεν καλείται** χωρίς απόδειξη»* | ο **μεταγλωττιστής** (`unique symbol`) — pre-commit · CI |
 * | *«η απόδειξη δίνεται **μόνο** στη σωστή κατάσταση»* | **αυτή η σουίτα** |
 */

import {
  isBrokerageDenial,
  requireBrokerageCapability,
} from '../brokerage-authority';
import {
  CAPABILITY_STATUSES,
  type CapabilityStatus,
  type OrganizationCapabilities,
} from '@/types/organization-capability';

const COMPANY = 'comp_alfa';

function withStatus(status: CapabilityStatus): OrganizationCapabilities {
  return {
    brokerage_listings: {
      status,
      requirements: [],
      declaration: null,
      decidedByUserId: null,
      decidedAt: null,
      revocationReason: null,
    },
  };
}

// =============================================================================
// Κ1 — ΧΩΡΙΣ `active` ΔΕΝ ΥΠΑΡΧΕΙ ΑΠΟΔΕΙΞΗ
// =============================================================================

describe('Κ1 — γραφείο χωρίς ενεργή ικανότητα ΔΕΝ παίρνει απόδειξη', () => {
  /** ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε τον έλεγχο `isCapabilityActive` να επιστρέφει `true` ⇒ κόκκινο. */
  it('καμία δηλωμένη ικανότητα ⇒ άρνηση `unrequested`', () => {
    const verdict = requireBrokerageCapability(COMPANY, undefined);

    expect(isBrokerageDenial(verdict)).toBe(true);
    if (!isBrokerageDenial(verdict)) return;
    expect(verdict.status).toBe('unrequested');
    expect(verdict.reason).toBe('auth:brokerage.denyReason.unrequested');
  });

  /**
   * ✅ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — ο φρουρός ΑΦΗΝΕΙ να περάσει το εγκεκριμένο γραφείο.**
   *
   * Χωρίς αυτόν, όλα τα υπόλοιπα θα ήταν πράσινα και αν ο φρουρός αρνιόταν **τα
   * πάντα** — δηλαδή αν είχαμε «λύσει» το πρόβλημα κλείνοντας τη λειτουργία.
   */
  it('`active` ⇒ ΑΠΟΔΕΙΞΗ, με το companyId του κριτή', () => {
    const verdict = requireBrokerageCapability(COMPANY, withStatus('active'));

    expect(isBrokerageDenial(verdict)).toBe(false);
    if (isBrokerageDenial(verdict)) return;
    expect(verdict.companyId).toBe(COMPANY);
  });
});

// =============================================================================
// Κ2 — ΤΟ `pending` ΑΡΝΕΙΤΑΙ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ
// =============================================================================

describe('Κ2 — «δήλωσε» δεν σημαίνει «επιτρέπεται»', () => {
  /**
   * 🔴 **Η ροή έγκρισης θα ήταν διακοσμητική αν το `pending` περνούσε.** Ο Ν. 4072
   * κάνει τη μεσιτεία **χωρίς εγγραφή παράνομη**· πλατφόρμα που ενεργοποιεί
   * ρυθμιζόμενη δραστηριότητα με **αυτοδήλωση** αναλαμβάνει το ρίσκο η ίδια.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε το `pending` να περνά ⇒ **κόκκινο**.
   */
  it('`pending` ⇒ άρνηση, με λόγο που ονομάζει την εκκρεμότητα', () => {
    const verdict = requireBrokerageCapability(COMPANY, withStatus('pending'));

    expect(isBrokerageDenial(verdict)).toBe(true);
    if (!isBrokerageDenial(verdict)) return;
    expect(verdict.status).toBe('pending');
    expect(verdict.reason).toBe('auth:brokerage.denyReason.pending');
  });
});

// =============================================================================
// Κ3 — ΤΟ `revoked` ΑΡΝΕΙΤΑΙ, ΚΑΙ ΤΟ «≠ unrequested» ΔΕΝ ΑΡΚΕΙ
// =============================================================================

describe('Κ3 — ο έλεγχος είναι ΘΕΤΙΚΟΣ, ποτέ «≠ unrequested»', () => {
  /**
   * 🔴 **Η ΑΚΡΙΒΗΣ ΜΕΤΑΛΛΑΞΗ ΤΟΥ ADR-824 §8 Κ3.** Ένας φρουρός γραμμένος ως
   * `status !== 'unrequested'` αφήνει να περάσουν **δύο** καταστάσεις που υπάρχουν
   * **ακριβώς** για να αρνούνται. Η δοκιμή τις ελέγχει **και τις δύο μαζί**, ώστε η
   * αρνητική διατύπωση να μη μπορεί να περάσει από καμία διαδρομή.
   */
  it('`revoked` ⇒ άρνηση με δικό της λόγο', () => {
    const verdict = requireBrokerageCapability(COMPANY, withStatus('revoked'));

    expect(isBrokerageDenial(verdict)).toBe(true);
    if (!isBrokerageDenial(verdict)) return;
    expect(verdict.status).toBe('revoked');
    expect(verdict.reason).toBe('auth:brokerage.denyReason.revoked');
  });

  /**
   * 🔑 **Κλειστή λογιστική**: **ακριβώς μία** από τις τέσσερις καταστάσεις δίνει
   * απόδειξη. Μια πέμπτη κατάσταση δεν μεταγλωττίζεται· μια **δεύτερη** που
   * επιτρέπει θα κοκκίνιζε **εδώ**.
   */
  it('ΑΚΡΙΒΩΣ μία από τις τέσσερις καταστάσεις επιτρέπει', () => {
    const granted = CAPABILITY_STATUSES.filter(
      (status) => !isBrokerageDenial(requireBrokerageCapability(COMPANY, withStatus(status))),
    );

    expect(granted).toEqual(['active']);
  });

  /**
   * ⚠️ **`revoked` ΔΕΝ γυρίζει σε `unrequested`.** *«Δεν ζήτησε ποτέ»* και *«του το
   * πήραμε»* είναι διαφορετικά γεγονότα με **διαφορετική θεραπεία στην οθόνη**, και
   * τα δύο μηνύματα οφείλουν να διαφέρουν.
   */
  it('οι τρεις αρνήσεις έχουν ΤΡΕΙΣ διαφορετικούς λόγους', () => {
    const reasons = CAPABILITY_STATUSES.filter((s) => s !== 'active').map((status) => {
      const verdict = requireBrokerageCapability(COMPANY, withStatus(status));
      return isBrokerageDenial(verdict) ? verdict.reason : 'ΠΕΡΑΣΕ';
    });

    expect(new Set(reasons).size).toBe(3);
    expect(reasons).not.toContain('ΠΕΡΑΣΕ');
  });
});

// =============================================================================
// Κ4 — FAIL-CLOSED: Η ΑΠΟΥΣΙΑ ΜΙΣΘΩΤΗ ΔΕΝ ΠΑΡΑΓΕΙ ΑΠΟΔΕΙΞΗ
// =============================================================================

describe('Κ4 — απόδειξη χωρίς υποκείμενο είναι αδύνατη', () => {
  /**
   * 🔴 **Πρότυπο `extractCustomClaims` (ADR-657 §3.5)**: *«κενή συμβολοσειρά =
   * **απουσία**, όχι μισθωτής»*. Μια απόδειξη με κενό `companyId` θα γραφόταν ως
   * `authorCompanyId: ''` στην αγγελία — δηλαδή αγγελία γραφείου **χωρίς γραφείο**.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: βγάλε τον έλεγχο κενού ⇒ **κόκκινο**.
   */
  it.each([null, undefined, '', '   '])('companyId «%s» ⇒ άρνηση ακόμη και με `active`', (id) => {
    const verdict = requireBrokerageCapability(id, withStatus('active'));

    expect(isBrokerageDenial(verdict)).toBe(true);
  });
});
