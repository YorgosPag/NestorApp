/**
 * @fileoverview 🔴 **Η ΟΘΟΝΗ ΛΕΕΙ ΜΟΝΟ ΤΗΝ ΑΙΤΙΑ ΠΟΥ ΚΑΠΟΙΟΣ ΚΑΤΕΓΡΑΨΕ.**
 * @related ADR-834 §6.5.δ · components/mandate/catalog/MandateCatalogRow.tsx
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ, ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΟΘΟΝΗ (ADR-834 §6.5.α #14)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κατάλογος εντολών έγραφε, **ζωντανά**:
 *
 * ```
 * Δεν στάλθηκε ποτέ
 * Η επαφή δεν είχε διεύθυνση email τη στιγμή της καταχώρησης. Συμπληρώστε την…
 * ```
 *
 * Η επαφή **είχε** email· η αποτυχία ήταν του **γραφέα**. Η οθόνη διάβαζε **μία**
 * κατάσταση *(«δεν ειδοποιήθηκε»)* και την παρουσίαζε ως **μία συγκεκριμένη αιτία** —
 * ενώ ο γραφέας έχει **τρεις** ονομαστικές εκβάσεις. Ο μεσίτης στάλθηκε να διορθώσει
 * **σωστά δεδομένα**.
 *
 * 🔑 **ΓΙΑΤΙ ΑΓΚΥΡΑ ΠΑΝΩ ΣΤΟ COMPONENT ΚΑΙ ΟΧΙ ΣΕ ΒΟΗΘΗΤΙΚΗ.** Το ερώτημα είναι
 * ***«τι λέει ΑΥΤΗ η οθόνη σε ΑΥΤΟΝ τον κόσμο;»*** — και είναι ακριβώς το ερώτημα που
 * καμία άγκυρα πάνω σε πίνακα κλειδιών δεν μπορεί να θέσει: ο πίνακας μπορεί να είναι
 * τέλειος και η γραμμή να διαβάζει **τον λάθος άξονα**. Ίδιο συμβόλαιο με το
 * `consent-term-day.test.tsx` *(«η συνάρτηση ήταν σωστή, σε λάθος θέση»)* και με το
 * `occupancy-line-unknown-scope.test.tsx`.
 *
 * ⛔ **ΚΑΜΙΑ ΣΥΓΚΡΙΣΗ ΚΕΙΜΕΝΟΥ ΜΕ ΚΕΙΜΕΝΟ** *(ADR-834 §5)*: ο μεταφραστής
 * αντικαθίσταται με **ταυτότητα**, οπότε στο DOM φτάνει το **κλειδί**. Οι έλεγχοι
 * κρίνουν **ποιο κλειδί ζήτησε η οθόνη** — ό,τι επιβιώνει κάθε αλλαγής διατύπωσης και
 * κοκκινίζει σε κάθε αλλαγή **συμπεριφοράς**.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { MandateCatalogRow } from '@/components/mandate/catalog/MandateCatalogRow';
import {
  CLIENT_NAME_KEYS,
  NEVER_NOTIFIED_HINT_KEYS,
  NOTIFY_UNRECORDED,
  STANDING_HINT_KEYS,
} from '@/components/mandate/catalog/mandate-catalog-labels';
import {
  CLIENT_NAME_IS_MISSING,
  CLIENT_NAME_IS_UNNAMED,
  CLIENT_NAME_KNOWN,
  type MandateClientName,
} from '@/lib/mandate/mandate-client-name';
import { AWAITING_VIEW, NEVER_NOTIFIED } from '@/lib/mandate/mandate-standing';
import type { MandateCatalogRow as CatalogRow } from '@/services/mandate/mandate-catalog.service';
import {
  NOTIFY_FAILED,
  NOTIFY_NO_ADDRESS,
  type MandateNotifyOutcome,
} from '@/types/owner-property-mandate';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const NAMED: MandateClientName = { kind: CLIENT_NAME_KNOWN, name: 'Κώστας Παπαδόπουλος' };

function rowWith(over: Partial<CatalogRow> = {}): CatalogRow {
  return {
    ownerPropertyId: 'ownp_a',
    listingTitle: 'Οικόπεδο Κώστα',
    clientName: NAMED,
    clientContactId: 'cont_kostas',
    standing: NEVER_NOTIFIED,
    group: 'needs-us',
    daysLeft: 120,
    expiresAt: '2027-02-20T23:59:59.999Z',
    notifiedAt: null,
    notifyOutcome: null,
    viewedAt: null,
    decidedAt: null,
    proofVia: 'owner-consent',
    onTheMarket: false,
    ...over,
  };
}

/** Ό,τι κείμενο έφτασε στο DOM για αυτή τη γραμμή — δηλαδή τα **κλειδιά** που ζήτησε. */
function screenFor(over: Partial<CatalogRow> = {}): string {
  const { unmount } = render(
    <MandateCatalogRow
      row={rowWith(over)}
      busy={false}
      feedback={null}
      onAct={() => undefined}
      onSetPresence={() => undefined}
    />,
  );
  const text = screen.getByRole('article').textContent ?? '';
  unmount();
  return text;
}

// ============================================================================
// Θ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// ============================================================================

describe('🔑 Θ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: υπάρχουν διαφορετικά πράγματα να ειπωθούν', () => {
  it('Θ0α — η γραμμή ζωγραφίζεται και ΛΕΕΙ κάτι', () => {
    // Χωρίς αυτό, μια οθόνη που δεν ζωγραφίζει **τίποτα** θα περνούσε κάθε
    // «δεν περιέχει το λάθος κλειδί» παρακάτω.
    expect(screenFor()).toContain(STANDING_HINT_KEYS[NEVER_NOTIFIED]);
  });

  it('🔴 Θ0β — τα κλειδιά των ΔΥΟ ΑΙΤΙΩΝ είναι ΔΙΑΦΟΡΕΤΙΚΑ μεταξύ τους ΚΑΙ από το γενικό', () => {
    // 🔑 **Η γραμμή που κάνει όλη την άγκυρα να σημαίνει κάτι.** Αν και τα τρία
    //    κλειδιά ήταν το ίδιο, κάθε «λέει τη σωστή αιτία» παρακάτω θα ήταν
    //    **διακόσμηση**: ο μεσίτης θα διάβαζε πάντα το ίδιο κείμενο.
    const distinct = new Set([
      NEVER_NOTIFIED_HINT_KEYS[NOTIFY_NO_ADDRESS],
      NEVER_NOTIFIED_HINT_KEYS[NOTIFY_FAILED],
      NEVER_NOTIFIED_HINT_KEYS[NOTIFY_UNRECORDED],
    ]);
    expect(distinct.size).toBe(3);
  });

  it('🔴 Θ0γ — και οι ΔΥΟ ΑΓΝΟΙΕΣ για το όνομα έχουν ξεχωριστά κλειδιά', () => {
    expect(CLIENT_NAME_KEYS.missing).not.toBe(CLIENT_NAME_KEYS.unnamed);
  });
});

// ============================================================================
// Θ1-Θ4 — Η ΑΙΤΙΑ ΠΟΥ ΔΕΙΧΝΕΤΑΙ ΕΙΝΑΙ Η ΑΙΤΙΑ ΠΟΥ ΚΑΤΑΓΡΑΦΗΚΕ
// ============================================================================

describe('🔴 Θ — «Δεν στάλθηκε ποτέ»: η οθόνη διαβάζει τον ΔΕΥΤΕΡΟ ΑΞΟΝΑ', () => {
  it('🔴 Θ1 — καταγεγραμμένο `no-address` ⇒ η οθόνη λέει ΑΥΤΟ, όχι το γενικό', () => {
    const text = screenFor({ notifyOutcome: NOTIFY_NO_ADDRESS });
    expect(text).toContain(NEVER_NOTIFIED_HINT_KEYS[NOTIFY_NO_ADDRESS]);
    expect(text).not.toContain(NEVER_NOTIFIED_HINT_KEYS[NOTIFY_FAILED]);
  });

  it('🔴 Θ2 — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: καταγεγραμμένο `failed` ⇒ ΔΕΝ λέει «δεν είχε email»', () => {
    // 🔴 **Η γραμμή που κοκκινίζει αν κάποιος επαναφέρει το ένα bit.** Αυτός είναι
    //    ο κόσμος που μετρήθηκε ζωντανά: η επαφή **είχε** email, ο γραφέας απέτυχε,
    //    και η οθόνη έστειλε τον μεσίτη να συμπληρώσει σωστό πεδίο.
    const text = screenFor({ notifyOutcome: NOTIFY_FAILED });
    expect(text).toContain(NEVER_NOTIFIED_HINT_KEYS[NOTIFY_FAILED]);
    expect(text).not.toContain(NEVER_NOTIFIED_HINT_KEYS[NOTIFY_NO_ADDRESS]);
  });

  it('🔴 Θ3 — ΚΑΜΙΑ καταγραφή ⇒ ΚΑΜΙΑ αιτία δεν ονομάζεται', () => {
    // ⚠️ Η άγνοια **δεν** μεταμφιέζεται σε αιτία: το γενικό κείμενο λέει «δεν έφυγε
    //    μήνυμα» και τίποτα για το γιατί. Ίδιο μάθημα με το `undetermined`.
    const text = screenFor({ notifyOutcome: null });
    expect(text).toContain(NEVER_NOTIFIED_HINT_KEYS[NOTIFY_UNRECORDED]);
    expect(text).not.toContain(NEVER_NOTIFIED_HINT_KEYS[NOTIFY_NO_ADDRESS]);
    expect(text).not.toContain(NEVER_NOTIFIED_HINT_KEYS[NOTIFY_FAILED]);
  });

  it('🔴 Θ4 — ο δεύτερος άξονας διαβάζεται ΜΟΝΟ εκεί που έχει νόημα', () => {
    // ⚠️ Το `awaiting-view` **δεν** μιλά για αποτυχία αποστολής — το μήνυμα έφυγε.
    //    Ένα `notifyOutcome` που «χρωμάτιζε» κάθε κατάσταση θα έλεγε στον μεσίτη
    //    «η επαφή δεν έχει email» για μήνυμα που **στάλθηκε**.
    const text = screenFor({ standing: AWAITING_VIEW, notifyOutcome: NOTIFY_NO_ADDRESS });
    expect(text).toContain(STANDING_HINT_KEYS[AWAITING_VIEW]);
    expect(text).not.toContain(NEVER_NOTIFIED_HINT_KEYS[NOTIFY_NO_ADDRESS]);
  });

  it('🔴 Θ5 — ΟΛΟΤΗΤΑ: καμία έκβαση δεν αφήνει την οθόνη χωρίς λέξεις', () => {
    // Ο τύπος `Record<NotifyHintAxis, string>` το εγγυάται στη μεταγλώττιση — αλλά ο
    // N.17 απαγορεύει `tsc` στον πράκτορα, άρα μόνο **εκτελούμενη** άγκυρα το λέει
    // σήμερα (ίδιο σκεπτικό με το `mandate-hint-claims.test.ts` Ν1).
    const axis: readonly (MandateNotifyOutcome | null)[] = [
      NOTIFY_NO_ADDRESS,
      NOTIFY_FAILED,
      null,
    ];
    for (const outcome of axis) {
      const text = screenFor({ notifyOutcome: outcome });
      expect(text).toMatch(/property-market:offer\.mandates\./);
    }
  });
});

// ============================================================================
// Θ6-Θ8 — «Η ΕΠΑΦΗ ΔΕΝ ΒΡΕΘΗΚΕ» ΜΟΝΟ ΟΤΑΝ ΔΕΝ ΒΡΕΘΗΚΕ
// ============================================================================

describe('🔴 Θ — ο πελάτης: «χωρίς όνομα» ≠ «δεν υπάρχει»', () => {
  it('🔑 Θ6 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: με όνομα, τυπώνεται ΤΟ ΟΝΟΜΑ και κανένα κλειδί', () => {
    const text = screenFor();
    expect(text).toContain('Κώστας Παπαδόπουλος');
    expect(text).not.toContain(CLIENT_NAME_KEYS.missing);
    expect(text).not.toContain(CLIENT_NAME_KEYS.unnamed);
  });

  it('🔴 Θ7 — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: επαφή ΧΩΡΙΣ ΟΝΟΜΑ ΔΕΝ λέγεται «δεν βρέθηκε»', () => {
    // 🔴 Η επαφή υπάρχει μια χαρά — λείπει το όνομα. Η θεραπεία είναι «άνοιξε την
    //    καρτέλα», όχι «ψάξε διαγραμμένη επαφή».
    const text = screenFor({ clientName: CLIENT_NAME_IS_UNNAMED });
    expect(text).toContain(CLIENT_NAME_KEYS.unnamed);
    expect(text).not.toContain(CLIENT_NAME_KEYS.missing);
  });

  it('🔴 Θ8 — και η ΑΛΗΘΙΝΑ χαμένη επαφή εξακολουθεί να λέγεται «δεν βρέθηκε»', () => {
    // ⚠️ Η διόρθωση **δεν** επιτρέπεται να καταπιεί την αρχική αλήθεια: ο σπασμένος
    //    δεσμός είναι πραγματική δουλειά για το γραφείο.
    const text = screenFor({ clientName: CLIENT_NAME_IS_MISSING });
    expect(text).toContain(CLIENT_NAME_KEYS.missing);
    expect(text).not.toContain(CLIENT_NAME_KEYS.unnamed);
  });
});
