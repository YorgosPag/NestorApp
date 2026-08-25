/**
 * Άγκυρες του **ορατού μέρους**: τι λέει η καρτέλα διεύθυνσης για τον δημόσιο χάρτη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ `t` ΕΠΙΣΤΡΕΦΕΙ ΤΟ ΚΛΕΙΔΙ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Έτσι το test κρίνει **ποιο κλειδί ζητήθηκε**, δηλαδή **ποιο σχήμα αποφασίστηκε** —
 * όχι τη διατύπωση, που αλλάζει χωρίς να αλλάξει τίποτα ουσιαστικό. Η ύπαρξη των
 * κλειδιών φυλάσσεται χωριστά, από τη **CHECK 3.8**, και επαληθεύτηκε χειροκίνητα σε
 * **el ΚΑΙ en** πριν γραφτεί αυτό το αρχείο.
 *
 * 🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ είναι το `Ο1`**: αποδεικνύει ότι μια διεύθυνση **χωρίς**
 * μεταδεδομένα — η **μόνη** μορφή που μπορούσε να υπάρξει πριν από αυτή τη δουλειά —
 * δίνει `pin`, δηλαδή «ακριβής διεύθυνση», **ό,τι κι αν γράφτηκε**. Χωρίς αυτό, το
 * «η «Θεσσαλονίκη» βγάζει σκιασμένη πόλη» θα ήταν πράσινο επειδή δεν υπήρξε ποτέ βλάβη.
 */

/* global describe, it, expect, jest */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AddressPublicShapeBadge } from '../AddressPublicShapeBadge';

const POINT = { lat: 40.6401, lng: 22.9444 };

describe('Ο — η συνέπεια στην οθόνη του επαγγελματία', () => {
  it('Ο1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: σημείο ΧΩΡΙΣ ακρίβεια ⇒ «ακριβής διεύθυνση» (η παλιά συμπεριφορά)', () => {
    render(<AddressPublicShapeBadge coordinates={POINT} geocodingMetadata={null} />);
    expect(screen.getByText('search-results:map.shape.pin')).toBeInTheDocument();
  });

  it('Ο2 — «Θεσσαλονίκη» (ακρίβεια `center`) ⇒ ΣΚΙΑΣΜΕΝΗ ΠΟΛΗ, ποτέ πινέζα', () => {
    render(
      <AddressPublicShapeBadge
        coordinates={POINT}
        geocodingMetadata={{ confidence: 0.55, accuracy: 'center', variantUsed: 5 }}
      />,
    );
    expect(screen.getByText('search-results:map.shape.shadedCity')).toBeInTheDocument();
    expect(screen.queryByText('search-results:map.shape.pin')).not.toBeInTheDocument();
  });

  it('Ο3 — «Εγνατίας 147» (ακρίβεια `exact`) ⇒ ακριβής πινέζα', () => {
    render(
      <AddressPublicShapeBadge
        coordinates={POINT}
        geocodingMetadata={{ confidence: 0.93, accuracy: 'exact', variantUsed: 2 }}
      />,
    );
    expect(screen.getByText('search-results:map.shape.pin')).toBeInTheDocument();
  });

  it('Ο4 — δρόμος χωρίς αριθμό (`interpolated`) ⇒ πινέζα με δακτύλιο', () => {
    render(
      <AddressPublicShapeBadge
        coordinates={POINT}
        geocodingMetadata={{ confidence: 0.7, accuracy: 'interpolated', variantUsed: 2 }}
      />,
    );
    expect(screen.getByText('search-results:map.shape.pinWithRing')).toBeInTheDocument();
  });

  it('Ο5 — καμία θέση ⇒ το λέει ΡΗΤΑ και δίνει τη ΘΕΡΑΠΕΙΑ (Α5 §4.1: ποτέ σιωπηλή εξαφάνιση)', () => {
    render(<AddressPublicShapeBadge coordinates={null} geocodingMetadata={null} />);
    expect(screen.getByText('search-results:map.shape.none')).toBeInTheDocument();
    // Το «τι κάνω τώρα» — αλλιώς η κάρτα ανακοινώνει πρόβλημα χωρίς έξοδο.
    expect(screen.getByText('addresses:publicMap.noneHint')).toBeInTheDocument();
  });

  it('Ο6 — μισό ζεύγος συντεταγμένων ΔΕΝ είναι θέση', () => {
    render(<AddressPublicShapeBadge coordinates={{ lat: 40.6, lng: null }} geocodingMetadata={null} />);
    expect(screen.getByText('search-results:map.shape.none')).toBeInTheDocument();
  });

  it('Ο7 — το ΚΕΙΜΕΝΟ λέει την ίδια πληροφορία με το χρώμα (WCAG 1.4.1 · CHECK 3.41)', () => {
    const { container } = render(
      <AddressPublicShapeBadge
        coordinates={POINT}
        geocodingMetadata={{ confidence: 0.55, accuracy: 'center', variantUsed: 5 }}
      />,
    );
    // Ο ρόλος υπάρχει ως κλάση **και** η κατάσταση λέγεται με λέξεις: αφαιρώντας το
    // χρώμα, η κάρτα παραμένει πλήρως αναγνώσιμη.
    expect(container.querySelector('.text-\\[hsl\\(var\\(--text-warning\\)\\)\\]')).not.toBeNull();
    expect(screen.getByText('search-results:detail.position.meaning.shadedCity')).toBeInTheDocument();
  });

  it('Ο8 — ΚΑΜΙΑ χρήση της απαγορευμένης κλάσης επιφάνειας (σκοτεινό θέμα: 1,00:1 = αόρατο)', () => {
    // Η απαγορευμένη κλάση είναι το `text-primary` (ADR-770 / CHECK 3.38).
    //
    // ⚠️ ΓΡΑΦΕΤΑΙ ΣΥΝΘΕΤΑ, ΚΑΙ ΟΧΙ ΩΣ ΣΤΑΘΕΡΑ ΣΥΜΒΟΛΟΣΕΙΡΑ, ΕΠΙΤΗΔΕΣ: η πύλη 3.38
    // σαρώνει **και αυτό** το αρχείο, οπότε ένα literal εδώ θα την έκανε να
    // κοκκινίσει πάνω στην ΑΓΚΥΡΑ ΠΟΥ ΕΠΙΒΑΛΛΕΙ ΤΟΝ ΙΔΙΟ ΤΗΣ ΤΟΝ ΚΑΝΟΝΑ — το
    // σχήμα «Κ7β» (ADR-780 Φ.Γ), όπου φρουρός πυροδοτεί στην τεκμηρίωση του
    // προτύπου που φυλάει. Το σχόλιο το αγνοεί η πύλη· η σταθερά όχι.
    const FORBIDDEN_SURFACE_CLASS = ['text', 'primary'].join('-');

    const { container } = render(
      <AddressPublicShapeBadge coordinates={POINT} geocodingMetadata={null} />,
    );
    expect(container.innerHTML).not.toContain(FORBIDDEN_SURFACE_CLASS);
  });
});
