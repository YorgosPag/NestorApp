/**
 * AddressSuggestionsPanel — «μήπως εννοούσες;» πρέπει να ρωτά **μόνο όταν υπάρχει επιλογή**.
 *
 * 🔴 **ΤΟ ΠΑΝΕΛ ΔΕΝ ΕΙΧΕ ΚΑΜΙΑ ΑΓΚΥΡΑ ΩΣ ΤΙΣ 2026-09-02** (`grep` = 0) — ενώ 42 άγκυρες
 * ήταν πράσινες πάνω στην *κατάταξη* και στις *σκανδάλες* του. Δηλαδή κανείς δεν είχε
 * ρωτήσει ποτέ **τι βλέπει ο άνθρωπος**, και η απάντηση ήταν: κατάλογος με μία γραμμή,
 * την απάντηση που του είχαμε ήδη δώσει. Δέκατη εμφάνιση του «0 = κανείς δεν κοίταξε».
 *
 * Ο παραγωγικός καταναλωτής είναι το `BuildingAddressesEditor` (καρτέλα «Γενικά» κτιρίου),
 * όχι μόνο η σελίδα demo.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';

import {
  AddressSuggestionsPanel,
  type AddressSuggestionsPanelProps,
} from '../components/AddressSuggestionsPanel';
import type { GeocodingApiResponse, SuggestionRanking } from '../types';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, currentLanguage: 'el' }),
}));

function candidate(displayName: string, confidence: number): GeocodingApiResponse {
  return {
    lat: 40.64, lng: 22.94, accuracy: 'exact', confidence, displayName,
    resolvedFields: {}, partialMatch: false, alternatives: [],
    reasoning: { fieldMatches: {}, attemptsLog: [], confidenceBreakdown: {
      base: 0.4, streetMatch: 0, cityMatch: 0, postalMatch: 0, total: confidence,
    } },
    source: { provider: 'nominatim', variantUsed: 1 },
  } as GeocodingApiResponse;
}

function ranking(displayName: string, confidence = 0.6): SuggestionRanking {
  return {
    candidate: candidate(displayName, confidence),
    originalRank: 0,
    distanceFromCenterM: null,
    rankScore: confidence,
  };
}

function renderPanel(overrides: Partial<AddressSuggestionsPanelProps> = {}) {
  return render(
    <AddressSuggestionsPanel
      trigger="low-confidence"
      presentation="chooser"
      candidates={[]}
      nextOmitField={null}
      retryExhausted={false}
      onSelect={jest.fn()}
      {...overrides}
    />,
  );
}

describe('AddressSuggestionsPanel — κατάλογος ΜΟΝΟ όταν υπάρχει επιλογή', () => {
  it('🔴 ADVISORY: δεν υπάρχει κατάλογος, και η μοναδική διεύθυνση ΔΕΝ επαναλαμβάνεται', () => {
    // Ακριβώς η οθόνη που παρήγαγε το `NOMINATIM_RESULT_LIMIT = '1'`.
    renderPanel({
      presentation: 'advisory',
      candidates: [ranking('Σαμοθράκης 16, Θεσσαλονίκη')],
    });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByText('Σαμοθράκης 16, Θεσσαλονίκη')).toBeNull();
    expect(screen.getByText('editor.suggestions.advisorySingle')).toBeInTheDocument();
  });

  it('ADVISORY χωρίς κανέναν υποψήφιο λέει «δεν βρέθηκαν», όχι «διάλεξε»', () => {
    renderPanel({ presentation: 'advisory', trigger: 'no-results-after-retry', candidates: [] });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByText('editor.suggestions.empty')).toBeInTheDocument();
  });

  it('ADVISORY κρατά τον ΤΙΤΛΟ της επιβεβαίωσης, όχι το «μήπως εννοούσες;»', () => {
    renderPanel({ presentation: 'advisory', candidates: [ranking('Α')] });

    expect(screen.getByText('editor.suggestions.advisoryTitle')).toBeInTheDocument();
    expect(screen.queryByText('editor.suggestions.title')).toBeNull();
  });

  it('ADVISORY δίνει την ΕΠΟΜΕΝΗ ΚΙΝΗΣΗ — το κουμπί επανάληψης χωρίς πεδίο', () => {
    // Ο μηχανισμός που ήταν απρόσιτος στην παραγωγή ως τις 02/09.
    renderPanel({
      presentation: 'advisory',
      trigger: 'no-results-after-retry',
      candidates: [],
      nextOmitField: 'postalCode',
      onRetry: jest.fn(),
    });

    expect(screen.getByText('editor.suggestions.retryWithout')).toBeInTheDocument();
  });

  it('CHOOSER δείχνει μία γραμμή ανά επιλογή — μετρημένη «Αθηνάς 5»', () => {
    renderPanel({
      presentation: 'chooser',
      trigger: 'multiple-candidates-similar',
      candidates: [
        ranking('5, Αθηνάς, Άγιοι Ανάργυροι'),
        ranking('5, Αθηνάς, Θεσσαλονίκη'),
        ranking('5, Αθηνάς, Λάρισα'),
      ],
    });

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByText('5, Αθηνάς, Λάρισα')).toBeInTheDocument();
    expect(screen.getByText('editor.suggestions.title')).toBeInTheDocument();
  });

  it('CHOOSER αναγγέλλει τον ΛΟΓΟ που άνοιξε — ο άνθρωπος δεν μαντεύει γιατί ρωτήθηκε', () => {
    renderPanel({
      presentation: 'chooser',
      trigger: 'partial-match-flag',
      candidates: [ranking('Α'), ranking('Β')],
    });

    expect(screen.getByText('editor.suggestions.triggerReason.partialMatchFlag')).toBeInTheDocument();
  });
});

// =============================================================================
// Η ΒΕΒΑΙΟΤΗΤΑ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ — ADR-332 D25 §μονάδα
// =============================================================================

/**
 * 🔴 **ΟΡΑΤΟ ΕΛΑΤΤΩΜΑ, ΠΙΑΣΜΕΝΟ ΜΕ ΠΕΡΠΑΤΗΜΑ** (05/09, με 476 άγκυρες πράσινες).
 *
 * Ο `AddressConfidenceMeter` γράφει ήδη «Βεβαιότητα ▮▮▯ 65%». Δίπλα του το πάνελ τύπωνε
 * **και** το `editor.suggestions.confidence` = «Βεβαιότητα: 65%» — και επειδή ο μετρητής
 * στριμωχνόταν σε `w-16` (64 px) ενώ η μπάρα του είναι `w-24` (96 px), τα δύο κείμενα
 * **έπεφταν το ένα πάνω στο άλλο**: η οθόνη έγραφε «Βεβαιότητα Β65αιότητα: 65%».
 *
 * 🔑 Η αρχή, όχι το δείγμα: **ένας ιδιοκτήτης ανά πληροφορία**. Ο μετρητής κατέχει την
 * παρουσίαση της βεβαιότητας· το πάνελ δεν την ξαναλέει.
 */
describe('AddressSuggestionsPanel — ένας ιδιοκτήτης της βεβαιότητας (D25)', () => {
  /**
   * ⚠️ Δύο υποψήφιοι, αλλιώς ο κατάλογος **δεν ζωγραφίζεται καθόλου** (D22: `chooser`
   * απαιτεί επιλογή) και οι έλεγχοι θα ήταν πράσινοι χωρίς να δουν τίποτα.
   * Ο `TooltipProvider` είναι απαίτηση του μετρητή, όπως στην εφαρμογή το `ConditionalAppShell`.
   */
  function renderWithChoices() {
    return render(
      <TooltipProvider>
        <AddressSuggestionsPanel
          trigger="low-confidence"
          presentation="chooser"
          candidates={[ranking('Αθηνάς, Μελίσσια'), ranking('Αθηνάς, Βούλα')]}
          nextOmitField={null}
          retryExhausted={false}
          onSelect={jest.fn()}
        />
      </TooltipProvider>,
    );
  }

  it('το πάνελ ΔΕΝ τυπώνει δεύτερη ετικέτα βεβαιότητας δίπλα στον μετρητή', () => {
    renderWithChoices();

    // Με ταυτοτικό `t`, το διπλότυπο θα εμφανιζόταν ως το ίδιο του το κλειδί.
    expect(screen.queryByText('editor.suggestions.confidence')).toBeNull();
  });

  it('ο μετρητής βεβαιότητας εξακολουθεί να υπάρχει — δεν σβήστηκε η πληροφορία', () => {
    renderWithChoices();

    expect(screen.getAllByRole('meter')).toHaveLength(2);
  });
});
