/**
 * ADR-834 §6.2 — ΑΓΚΥΡΕΣ της **ΕΝΕΡΓΗΣΙΜΗΣ ΑΡΝΗΣΗΣ** (σχήμα P2B άρθρο 4).
 *
 * 🔑 **Λόγος ΚΑΙ δυνατότητα διόρθωσης.** Μια άρνηση που λέει *«λείπουν τα στοιχεία
 * σου»* χωρίς να πει **πού**, αφήνει τον άνθρωπο να ψάχνει μενού — δηλαδή αντικαθιστά
 * το αδιέξοδο του γραφείου με ένα **δικό του**.
 *
 *   Δ-1  🔴 Ο σύνδεσμος είναι **ΚΥΡΙΟΛΕΚΤΙΚΑ** `/profile`
 *   Δ-2  Είναι η **ΜΟΝΗ** άρνηση με διέξοδο — οι άλλες λύνονται μέσα στη φόρμα
 *   Δ-3  🔴 Το `/profile` είναι **ΕΚΤΟΣ ΧΩΡΟΥ** — αλλιώς ο σύνδεσμος του συνόρου θα
 *        παρήγαγε `/o/<ψευδώνυμο>/profile`, **διεύθυνση χωρίς σελίδα**
 *   Δ-4  Το κείμενο του συνδέσμου υπάρχει σε **el ΚΑΙ en**
 *   Ο-1  🔴 Η ΟΘΟΝΗ: η άρνηση ταυτότητας φτάνει **με τον σύνδεσμο**
 *   Ο-2  🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ: άλλη άρνηση ⇒ κείμενο **χωρίς** σύνδεσμο
 *   Ο-3  🔴 `null` = *«δεν μάθαμε»* (N.12) — άλλο κείμενο, κανένας σύνδεσμος
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: ο μεταφραστής είναι μοκαρισμένος (`t = κλειδί`), οπότε τα
 * `Ο-*` κρίνουν **δομή**: ποιο κλειδί, ποιος σύνδεσμος. Ότι τα κλειδιά **λύνονται σε
 * λέξεις** το κρίνει το `mandate-request-labels.test.ts` (Ρ1/Ρ2/Ρ3), που διαβάζει τα
 * ίδια τα locale — δύο άγκυρες, δύο γεγονότα, καμία ψευδαίσθηση.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  REJECTION_KEYS,
  REJECTION_REMEDY,
  SCREEN_KEYS,
} from '@/components/mandate/mandate-request-form-labels';
import { MandateRequestOutcomeNotice } from '@/components/mandate/MandateRequestOutcomeNotice';
import { isInsideWorkspace } from '@/lib/workspace/workspace-scope';
import { MANDATE_REQUEST_REJECTIONS } from '@/services/mandate/mandate-request-vocabulary';

import el from '@/i18n/locales/el/property-market.json';
import en from '@/i18n/locales/en/property-market.json';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

type Bundle = Record<string, unknown>;

/** `property-market:mandate.request.x` → η τιμή του, ή `undefined`. */
function wordsForKey(bundle: Bundle, qualifiedKey: string): unknown {
  const path = qualifiedKey.includes(':') ? qualifiedKey.split(':')[1] : qualifiedKey;
  return path
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object' ? (node as Bundle)[part] : undefined,
      bundle,
    );
}

// ============================================================================
describe('Δ — η διέξοδος, ως δεδομένο', () => {
  it('Δ-1 🔴 ο σύνδεσμος της ταυτότητας είναι ΚΥΡΙΟΛΕΚΤΙΚΑ `/profile`', () => {
    // ⚠️ **ΟΧΙ `toBe(PRIVATE_PROFILE_ROUTE)`**: αυτό θα σύγκρινε τη σταθερά με τον
    //    εαυτό της και θα **επιζούσε** κάθε μετάλλαξης. Ό,τι είναι υπόσχεση προς τον
    //    άνθρωπο γράφεται με κυριολεξία.
    expect(REJECTION_REMEDY['identity-incomplete']?.href).toBe('/profile');
  });

  it('Δ-2 είναι η ΜΟΝΗ άρνηση με διέξοδο — οι άλλες λύνονται μέσα στη φόρμα', () => {
    const withRemedy = MANDATE_REQUEST_REJECTIONS.filter(
      (code) => REJECTION_REMEDY[code] !== null,
    );
    expect(withRemedy).toEqual(['identity-incomplete']);
  });

  it('Δ-3 🔴 το `/profile` είναι ΕΚΤΟΣ χώρου — αλλιώς ο σύνδεσμος δείχνει σε κενό', () => {
    // Ο **πραγματικός** κριτής, όχι αντιγραφή του: αν κάποιος αφαιρέσει το `profile`
    // από το `OUTSIDE_WORKSPACE`, ο `Link` του συνόρου θα παρήγαγε
    // `/o/<ψευδώνυμο>/profile` — το ακριβές σχήμα των περιστατικών `/unauthorized`,
    // `/workspace/new` και `/home`.
    expect(isInsideWorkspace('/profile')).toBe(false);
  });

  it('Δ-4 το κείμενο του συνδέσμου υπάρχει σε el ΚΑΙ en', () => {
    for (const code of MANDATE_REQUEST_REJECTIONS) {
      const remedy = REJECTION_REMEDY[code];
      if (remedy === null) continue;
      expect(wordsForKey(el as Bundle, remedy.labelKey)).toEqual(expect.any(String));
      expect(wordsForKey(en as Bundle, remedy.labelKey)).toEqual(expect.any(String));
    }
  });
});

// ============================================================================
describe('Ο — η οθόνη: ο λόγος φτάνει, και η διέξοδος μαζί του', () => {
  it('Ο-1 🔴 η άρνηση ταυτότητας δείχνει ΚΑΙ κείμενο ΚΑΙ σύνδεσμο προς `/profile`', () => {
    render(<MandateRequestOutcomeNotice reason="identity-incomplete" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      REJECTION_KEYS['identity-incomplete'],
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/profile');
  });

  it('Ο-2 🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ: άλλη άρνηση ⇒ κείμενο, ΚΑΝΕΝΑΣ σύνδεσμος', () => {
    // Χωρίς αυτό, το `Ο-1` θα μπορούσε να είναι πράσινο επειδή η οθόνη δείχνει
    // σύνδεσμο **πάντα** — δηλαδή θα έστελνε στο προφίλ και όποιον έχει σωστά
    // στοιχεία αλλά μπαγιάτικο σύνδεσμο αγγελίας.
    render(<MandateRequestOutcomeNotice reason="listing-absent" />);

    expect(screen.getByRole('alert')).toHaveTextContent(REJECTION_KEYS['listing-absent']);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('Ο-3 🔴 `null` = «δεν μάθαμε»: ΑΛΛΟ κείμενο, κανένας σύνδεσμος (N.12)', () => {
    render(<MandateRequestOutcomeNotice reason={null} />);

    expect(screen.getByRole('alert')).toHaveTextContent(SCREEN_KEYS.unverified);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
