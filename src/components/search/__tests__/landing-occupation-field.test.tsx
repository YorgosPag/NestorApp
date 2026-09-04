/**
 * @jest-environment jsdom
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΑΝΑΤΡΟΠΗΣ Α4.5** — *«πόσα πεδία ρωτά ΑΥΤΗ η λειτουργία;»*
 * @related ADR-841 §7 Α4.5 *(η ανατροπή)* · Α4.4.2 · Α5 · ADR-777 Α3 *(η αρχική δέσμευση)*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΥΠΑΡΧΕΙ ΧΩΡΙΣΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `landing-modes.test.ts` ρωτά *«ποιος είναι ο κανόνας;»* — καθαρές συναρτήσεις. Το
 * `showcase-filter.test.ts` ρωτά *«τι κόβει;»*. **Καμία από τις δύο δεν μπορεί να δει το
 * ελάττωμα που κλείνει εδώ**, γιατί το ελάττωμα ήταν *«η ερώτηση δεν γίνεται ποτέ»* — και
 * μια ερώτηση που δεν γίνεται είναι **απουσία στην οθόνη**, όχι λάθος τιμή σε συνάρτηση.
 *
 * Το ίδιο σχήμα με το Α17.6 / Α6.6: *«το λογικό μισό πράσινο, το ορατό μισό σπασμένο»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴🔴 ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ ΔΕΝ ΕΙΝΑΙ ΠΙΑ ΨΕΥΤΙΚΟ *(2026-09-04, ADR-841 §7 Α19)*
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι σήμερα αυτή η σουίτα **αντικαθιστούσε** το `@/components/ui/select` με native
 * `<select data-testid="occupation-select">`, με επιχείρημα *«το Radix ανοίγει με
 * `pointerdown` πάνω σε portal — σε jsdom θα δοκίμαζα το Radix, όχι εμάς»*. Το επιχείρημα
 * ήταν **σωστό για το Radix**, αλλά η τιμή του φάνηκε όταν η **Α19** άλλαξε το χειριστήριο
 * σε `SearchableCombobox`:
 *
 * 🔴 **Η σουίτα κοκκίνισε για λόγο ΜΗΧΑΝΙΚΟ, όχι σημασιολογικό**: όχι επειδή χάλασε η
 * καλωδίωση, αλλά επειδή το `testid` **του ίδιου του ψεύτικου** εξαφανίστηκε.
 *
 * ⚠️ **Ακριβώς τι έκρυβε — και τι ΟΧΙ, μετρημένο**: η καλωδίωση `onValueChange` του
 * `OccupationSelect` **δοκιμαζόταν** κανονικά *(το ψεύτικο αντικαθιστούσε μόνο το
 * `ui/select`)*, και μια μετάλλαξη σε αυτήν κοκκινίζει και στις δύο γραφές. Αυτό που
 * **χανόταν** ήταν η ίδια η **πράξη της επιλογής**: το «διάλεξε» ήταν `fireEvent.change`
 * σε native `<select>`, δηλαδή παρέκαμπτε **άνοιγμα, φιλτράρισμα και επιλογή γραμμής**.
 *
 * 🔴 Και ένας έλεγχος ήταν **κενός**: το `queryByTestId('occupation-select')` στις τρεις
 * λειτουργίες ακινήτων επιβεβαίωνε την απουσία στοιχείου **που δεν υπήρξε ποτέ στην
 * παραγωγή** — θα ήταν πράσινο ακόμη κι αν το πεδίο ήταν **παρόν**. Τώρα ρωτά τον
 * `role="combobox"`, δηλαδή το χειριστήριο που πραγματικά αποδίδεται.
 *
 * ✅ **Τώρα ο επιλογέας είναι ο ΠΡΑΓΜΑΤΙΚΟΣ**, και η επιλογή γίνεται όπως την κάνει ο
 * άνθρωπος: εστίαση → κλικ στη γραμμή. Το `SearchableCombobox` είναι Radix **Popover**
 * *(όχι Select)* και αποδίδει `role="option"` σε **κανονικό DOM**, οπότε η αρχική ένσταση
 * **έπαψε να ισχύει** — δεν παρακάμπτεται, **εξέπνευσε**.
 *
 * *(Το «ποτέ `value=""`» το φυλάει η **CHECK 3.48** με δικό της όργανο· το φιλτράρισμα,
 * η ελληνική ταύτιση και το `aria-activedescendant` ζουν στο `occupation-typeahead`.)*
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { PlaceSearchBox } from '../PlaceSearchBox';
import { occupationOptions } from '@/lib/agency/showcase-filter';
import type { PublicShowcase, ShowcaseCredential } from '@/types/agency-profile';

// =============================================================================
// ΤΑ ΨΕΥΤΙΚΑ
// =============================================================================

const pushSpy = jest.fn();
const geocodeSpy = jest.fn();

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddressDetailed: (...args: unknown[]) => geocodeSpy(...args),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));


// =============================================================================
// Ο ΠΛΗΘΥΣΜΟΣ
// =============================================================================

const PAINTER_URI = 'http://data.europa.eu/esco/occupation/painter';
const BROKER_URI = 'http://data.europa.eu/esco/occupation/broker';

function credential(escoUri: string, el: string, en: string): ShowcaseCredential {
  return {
    standing: 'self-declared',
    occupation: { escoUri, label: { el, en }, iscoCode: '0000' },
    attestation: { state: 'unknown' },
  } as unknown as ShowcaseCredential;
}

function showcase(companyId: string, credentials: readonly ShowcaseCredential[]): PublicShowcase {
  return {
    companyId,
    alias: companyId,
    displayName: companyId,
    credentials,
    place: null,
    position: { lat: 40.64, lng: 22.94 },
    publishedAt: '2026-09-01T10:00:00.000Z',
  } as unknown as PublicShowcase;
}

const AGENCIES: readonly PublicShowcase[] = [
  showcase('c1', [credential(PAINTER_URI, 'Ελαιοχρωματιστής', 'Painter')]),
  showcase('c2', [credential(BROKER_URI, 'Μεσίτης', 'Broker')]),
];

/** ⚠️ **Οι ΠΡΑΓΜΑΤΙΚΕΣ επιλογές** — από το SSoT, ποτέ γραμμένες στο χέρι εδώ. */
const OPTIONS = occupationOptions(AGENCIES, 'el');

const OCCUPATION_LABEL_KEY = 'property-market:mandate.directory.occupationFilterLabel';
const AREA_LABEL_KEY = 'search-results:landing.search.label';

function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'search-results:landing.search.submit' });
}

function typePlace(text: string): void {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: text } });
}

function chooseOccupation(escoUri: string): void {
  // 🔑 **Όπως το κάνει ο άνθρωπος**: εστίαση ανοίγει τον κατάλογο, κλικ διαλέγει γραμμή.
  //    Ο επιλογέας είναι ο **ΠΡΑΓΜΑΤΙΚΟΣ** (ADR-841 §7 Α19) — η ετικέτα βρίσκεται από το
  //    `escoUri` μέσω του **πληθυσμού**, ποτέ γραμμένη δεύτερη φορά εδώ.
  const option = OPTIONS.find((candidate) => candidate.escoUri === escoUri);
  if (!option) throw new Error(`Ο πληθυσμός δεν περιέχει ${escoUri}`);

  fireEvent.focus(screen.getByRole('combobox'));
  // ⚠️ `mouseDown` και όχι `click`: το `SearchableCombobox` διαλέγει στο **mousedown**,
  //    ώστε να προλάβει το `blur` του πεδίου (δες `handleBlur`, καθυστέρηση 200ms).
  fireEvent.mouseDown(screen.getByRole('option', { name: option.label.el }));
}

/** Ο τελευταίος προορισμός, ως ωμή συμβολοσειρά. */
function lastPush(): string {
  expect(pushSpy).toHaveBeenCalled();
  return String(pushSpy.mock.calls[pushSpy.mock.calls.length - 1][0]);
}

beforeEach(() => {
  pushSpy.mockReset();
  geocodeSpy.mockReset();
  geocodeSpy.mockResolvedValue({
    kind: 'found',
    result: { lat: 40.64, lng: 22.94 },
  });
});

// =============================================================================

describe('ADR-841 §7 Α4.5 — ο αριθμός των πεδίων ανήκει στο ΠΑΝΕΛ', () => {
  // ===========================================================================
  // Κ1 — Η ΑΝΑΤΡΟΠΗ, ΟΡΑΤΗ
  // ===========================================================================

  describe('Κ1 — πόσα πεδία ρωτά η κάθε λειτουργία', () => {
    /**
     * 🔴 **ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΚΕΝΟ «Α» ΤΟΥ GIORGIO**, μετρημένο: *«θέλω υδραυλικό — τι κάνω;»*.
     * Πριν την Α4.5 το tab «Επαγγελματίες» ρωτούσε **μόνο τόπο**.
     */
    it('«Επαγγελματίες» ρωτά ΔΥΟ — και η ειδικότητα είναι η ΠΡΩΤΗ', () => {
      const { container } = render(
        <PlaceSearchBox mode="pros" occupations={OPTIONS} locale="el" />,
      );

      expect(screen.getByText(OCCUPATION_LABEL_KEY)).toBeInTheDocument();
      expect(screen.getByText(AREA_LABEL_KEY)).toBeInTheDocument();

      // ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ Η ΜΙΣΗ ΑΠΟΦΑΣΗ** (5 στις 5 πλατφόρμες, Α4.5.3). Χωρίς αυτόν
      //    τον έλεγχο, μια αναδιάταξη θα περνούσε πράσινη ενώ θα άλλαζε τη σειρά με την
      //    οποία ο άνθρωπος διαβάζει τις ερωτήσεις.
      const labels = [...container.querySelectorAll('label')].map((el) =>
        el.textContent?.trim(),
      );
      expect(labels[0]).toContain(OCCUPATION_LABEL_KEY);
      expect(labels[1]).toContain(AREA_LABEL_KEY);
    });

    it.each(['buy', 'rent', 'stay'] as const)(
      '«%s» κρατά ΕΝΑ πεδίο — η ADR-777 Α3 παραμένει αληθής εκεί',
      (mode) => {
        render(<PlaceSearchBox mode={mode} occupations={OPTIONS} locale="el" />);

        expect(screen.queryByText(OCCUPATION_LABEL_KEY)).not.toBeInTheDocument();
        // ⚠️ **Το χειριστήριο, όχι ένα `testid` δικής μας επινόησης**: η προηγούμενη γραφή
        //    ζητούσε `queryByTestId('occupation-select')` — στοιχείο που υπήρχε **μόνο
        //    μέσα στο ψεύτικο**, άρα «απουσίαζε» και όταν το πεδίο ήταν παρόν.
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.getByText(AREA_LABEL_KEY)).toBeInTheDocument();
      },
    );
  });

  // ===========================================================================
  // Κ2 — «ΥΔΡΑΥΛΙΚΟΣ ΟΠΟΥΔΗΠΟΤΕ»: Ο ΤΟΠΟΣ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΟΣ (Α4.5.δ)
  // ===========================================================================

  describe('Κ2 — υποβάλλεις με ΕΣΤΩ ΕΝΑΝ άξονα', () => {
    it('τίποτα-τίποτα ⇒ η υποβολή είναι ΝΕΚΡΗ (η πόρτα της Α4.4.2 το καλύπτει ήδη)', () => {
      render(<PlaceSearchBox mode="pros" occupations={OPTIONS} locale="el" />);
      expect(submitButton()).toBeDisabled();
    });

    it('ΜΟΝΟ ειδικότητα ⇒ η υποβολή ζωντανεύει', () => {
      render(<PlaceSearchBox mode="pros" occupations={OPTIONS} locale="el" />);
      chooseOccupation(PAINTER_URI);
      expect(submitButton()).toBeEnabled();
    });

    /**
     * 🔑 **ΚΑΙ Ο ΓΕΩΚΩΔΙΚΟΠΟΙΗΤΗΣ ΔΕΝ ΚΑΛΕΙΤΑΙ** — δεν είναι βελτιστοποίηση: μια κλήση με
     * κενό κείμενο θα επέστρεφε `not-found`, και ο επισκέπτης θα διάβαζε *«δεν εντοπίσαμε
     * αυτή την περιοχή»* για περιοχή **που δεν ζήτησε ποτέ**.
     */
    it('ΜΟΝΟ ειδικότητα ⇒ `/pro?occupation=…` ΧΩΡΙΣ γεωκωδικοποίηση και ΧΩΡΙΣ lat/lng', async () => {
      render(<PlaceSearchBox mode="pros" occupations={OPTIONS} locale="el" />);
      chooseOccupation(PAINTER_URI);
      fireEvent.click(submitButton());

      await waitFor(() => expect(pushSpy).toHaveBeenCalled());
      const href = lastPush();

      expect(href).toContain('/pro?');
      expect(href).toContain(`occupation=${encodeURIComponent(PAINTER_URI)}`);
      expect(href).not.toContain('lat=');
      expect(href).not.toContain('lng=');
      expect(geocodeSpy).not.toHaveBeenCalled();
    });

    it('ΜΟΝΟ τόπος ⇒ η ιστορική διαδρομή μένει ΑΘΙΚΤΗ (lat/lng/r, καμία ειδικότητα)', async () => {
      render(<PlaceSearchBox mode="pros" occupations={OPTIONS} locale="el" />);
      typePlace('Θεσσαλονίκη');
      fireEvent.click(submitButton());

      await waitFor(() => expect(pushSpy).toHaveBeenCalled());
      const href = lastPush();

      expect(href).toContain('lat=');
      expect(href).toContain('lng=');
      expect(href).toContain('r=');
      expect(href).not.toContain('occupation=');
      expect(geocodeSpy).toHaveBeenCalledTimes(1);
    });

    it('ΚΑΙ ΤΑ ΔΥΟ ⇒ και οι δύο άξονες ταξιδεύουν μαζί', async () => {
      render(<PlaceSearchBox mode="pros" occupations={OPTIONS} locale="el" />);
      chooseOccupation(BROKER_URI);
      typePlace('Θεσσαλονίκη');
      fireEvent.click(submitButton());

      await waitFor(() => expect(pushSpy).toHaveBeenCalled());
      const href = lastPush();

      expect(href).toContain(`occupation=${encodeURIComponent(BROKER_URI)}`);
      expect(href).toContain('lat=');
    });
  });

  // ===========================================================================
  // Κ3 — Η ΕΙΔΙΚΟΤΗΤΑ ΔΕΝ ΔΙΑΡΡΕΕΙ ΣΤΙΣ ΑΓΓΕΛΙΕΣ (Α5)
  // ===========================================================================

  describe('Κ3 — Α5: οι επαγγελματίες δεν είναι αγγελία', () => {
    it('λειτουργία ακινήτων ⇒ ο προορισμός είναι τα αποτελέσματα, ποτέ ο κατάλογος', async () => {
      render(<PlaceSearchBox mode="buy" occupations={OPTIONS} locale="el" />);
      typePlace('Θεσσαλονίκη');
      fireEvent.click(submitButton());

      await waitFor(() => expect(pushSpy).toHaveBeenCalled());
      const href = lastPush();

      expect(href).not.toContain('/pro');
      expect(href).not.toContain('occupation=');
      expect(href).toContain('offer');
    });
  });

  // ===========================================================================
  // Κ4 — Η ΖΩΝΤΑΝΗ ΣΥΝΔΡΟΜΗ: Η ΕΠΙΛΟΓΗ ΝΙΚΑ ΟΣΟ ΠΑΡΑΜΕΝΕΙ ΔΥΝΑΤΗ
  // ===========================================================================

  describe('Κ4 — ειδικότητα που έπαψε να υπάρχει', () => {
    /**
     * ⚠️ Ο `usePublicAgencies` είναι **ζωντανή συνδρομή**: ο τελευταίος ελαιοχρωματιστής
     * μπορεί να αποσυρθεί όσο η σελίδα είναι ανοιχτή. Χωρίς τον φρουρό, το χειριστήριο θα
     * κρατούσε τιμή **εκτός επιλογών** και η υποβολή θα έστελνε σε φίλτρο που δίνει μηδέν —
     * σιωπηλά. Ίδιος κανόνας με το `chosen` του `SearchLandingContent`.
     */
    it('πέφτει σε «όλες» — και η υποβολή ξαναγίνεται νεκρή', () => {
      const { rerender } = render(
        <PlaceSearchBox mode="pros" occupations={OPTIONS} locale="el" />,
      );
      chooseOccupation(PAINTER_URI);
      expect(submitButton()).toBeEnabled();

      // Ο ελαιοχρωματιστής αποσύρθηκε ⇒ μένει μόνο ο μεσίτης.
      const remaining = occupationOptions([AGENCIES[1]], 'el');
      rerender(<PlaceSearchBox mode="pros" occupations={remaining} locale="el" />);

      expect(submitButton()).toBeDisabled();
    });
  });
});
