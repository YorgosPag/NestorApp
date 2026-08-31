/**
 * @fileoverview 🔴 **Η ΟΘΟΝΗ ΠΟΥ ΥΠΟΓΡΑΦΕΤΑΙ ΔΕΙΧΝΕΙ ΤΗΝ ΗΜΕΡΑ ΠΟΥ ΣΥΜΦΩΝΗΘΗΚΕ.**
 * @related ADR-834 §6.5 · components/mandate/MandateConsentContent.tsx · ADR-832
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΗ Η ΟΘΟΝΗ ΕΧΕΙ ΔΙΚΗ ΤΗΣ ΑΓΚΥΡΑ, ΕΝΩ Η ΣΥΝΑΡΤΗΣΗ ΕΙΝΑΙ ΗΔΗ ΔΕΜΕΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `formatTermDay` έχει **εννέα** δικούς του ελέγχους *(`mandate-term-day.test.ts`)*.
 * Αυτό εδώ **δεν** τους επαναλαμβάνει — ρωτά κάτι **άλλο**, που εκείνοι δεν μπορούν:
 *
 * > **«Καλεί ΑΥΤΗ η οθόνη τη σωστή συνάρτηση;»**
 *
 * Είναι ακριβώς το κενό που μέτρησε το ADR-834: η οθόνη καλούσε το **καθολικό**
 * `formatDate` — μια συνάρτηση **σωστή**, με **σωστά** δικά της test, σε **λάθος θέση**.
 * Καμία άγκυρα του `formatTermDay` δεν μπορεί να δει αυτό το λάθος, γιατί το λάθος
 * **δεν είναι μέσα του**: είναι στο ότι κανείς δεν τον καλούσε.
 *
 * 🔴 **ΚΑΙ ΤΟ ΒΑΡΟΣ ΕΙΝΑΙ ΝΟΜΙΚΟ.** Οι άλλες δύο επιφάνειες *(κατάληψη · πάνελ
 * ιδιοκτήτη)* **πληροφορούν**· αυτή είναι το κείμενο που ο ιδιοκτήτης **αποδέχεται**
 * (άρθρο 200 §1 Ν.4072/2012 — εγγράφως). Ημερομηνία λάθος κατά μία ημέρα εδώ δεν είναι
 * αισθητικό ελάττωμα: είναι **άλλη συμφωνία από εκείνη που δηλώθηκε**.
 *
 * ✅ **ΤΟ ΟΡΙΟ ΑΡΘΗΚΕ 2026-08-31**: αυτό εκτελεί το **component**· η ίδια η διαδρομή
 * `/mandate/[token]` **εκτελέστηκε ζωντανά** και έδειξε *«Η εντολή θα ισχύει μέχρι
 * **30/04/2027**»* — ADR-834 **§6.5.α #8**. Το δέσιμο **διαδρομή → όψη → component**
 * δεν είναι πια αδοκίμαστο· αυτή η άγκυρα το **κρατά** χωρίς φυλλομετρητή.
 */

import React from 'react';
import { render } from '@testing-library/react';

import {
  MandateConsentContent,
  type MandateConsentView,
} from '@/components/mandate/MandateConsentContent';
import { endOfDay } from '@/lib/mandate/mandate-term-window';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** Η ημέρα που θα δήλωνε ο άνθρωπος — και που οφείλει να διαβάσει πίσω. */
const AGREED_DAY = '2027-04-30';

const VIEW: MandateConsentView = {
  token: 'nonce-test',
  listingTitle: 'TEST',
  agencyName: 'Δοκιμαστικό Γραφείο',
  // 🔑 **Η στιγμή γράφεται με τον ΙΔΙΟ γραφέα που τη γεννά στην παραγωγή.** Μια
  //    χειρόγραφη `'2027-04-30T23:59:59.999Z'` θα ήταν δεύτερη γραφή του ίδιου
  //    γεγονότος — και θα έμενε πίσω την ημέρα που θα αλλάξει ο `endOfDay`.
  mandateExpiresAt: endOfDay(AGREED_DAY),
  currentDecision: 'pending',
};

/** Ό,τι κείμενο έφτασε στην κάρτα συγκατάθεσης. */
function consentText(view: MandateConsentView = VIEW): string {
  const { container, unmount } = render(<MandateConsentContent view={view} />);
  const text = container.textContent ?? '';
  unmount();
  return text;
}

describe('🔑 Σ — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η κάρτα ζωγραφίζεται και λέει κάτι', () => {
  it('Σ0 — το περιβάλλον ΜΠΟΡΕΙ να εκφράσει το ελάττωμα, και η κάρτα έχει περιεχόμενο', () => {
    // 🔴 Χωρίς την πρώτη γραμμή, ένα πράσινο σε **UTC** θα σήμαινε *«κανείς δεν
    //    κοίταξε»*: εκεί τοπικό και UTC ταυτίζονται και η λάθος συνάρτηση δίνει το
    //    **ίδιο** αποτέλεσμα με τη σωστή. Ίδιο συμβόλαιο με το `Ζ0` του
    //    `mandate-term-day.test.ts` — δες εκεί το γιατί δεν επιβάλλεται ζώνη.
    const boundary = new Date(VIEW.mandateExpiresAt);
    expect(boundary.getDate()).not.toBe(boundary.getUTCDate());

    expect(consentText()).toContain('TEST');
  });
});

describe('🔴 Τ — η οθόνη που ΥΠΟΓΡΑΦΕΤΑΙ δείχνει τη ΔΗΛΩΜΕΝΗ ημέρα', () => {
  it('🔴 Τ1 — η λήξη διαβάζεται ως 30/04/2027, ποτέ 01/05', () => {
    const text = consentText();
    // Ο μήνας και η ημέρα **της συμφωνίας**, όχι της ζώνης του αναγνώστη.
    expect(text).toContain('30');
    expect(text).toContain('04');
    expect(text).toContain('2027');
  });

  it('🔑 Τ2 — και ΔΕΝ δείχνει την επόμενη ημέρα (το ακριβές περιστατικό)', () => {
    // 🔴 **Η γραμμή που κοκκινίζει αν κάποιος ξαναβάλει το καθολικό `formatDate`.**
    //    Στην Ελλάδα εκείνο δίνει «01/05/2027» για την ίδια στιγμή.
    const local = new Intl.DateTimeFormat('el', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(VIEW.mandateExpiresAt));

    expect(consentText()).not.toContain(local);
  });

  it('Τ3 — καμία ωμή ISO στιγμή στην οθόνη', () => {
    // Το `T23:59` / `Z` δεν το διαβάζει άνθρωπος — και το ADR-827 §9.16 ε το έχει
    // ήδη πληρώσει σε δύο οθόνες βιτρίνας.
    const text = consentText();
    expect(text).not.toContain('T23:59');
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
