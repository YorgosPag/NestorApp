/**
 * Integration tests — AddressEditor coordinator (ADR-332 Phase 5)
 *
 * Verifies that the coordinator:
 *   - renders all 8 form fields
 *   - calls onChange on field edit
 *   - shows fields as disabled in view mode
 *   - exposes context via useAddressEditorContext
 *   - undo/redo buttons render (enabled state)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AddressEditor } from '../AddressEditor';
import { useAddressEditorContext } from '../AddressEditorContext';

// --- Mocks ---

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddress: jest.fn().mockResolvedValue(null),
  // 🔴 Ο editor καλεί **αυτό**, όχι το `geocodeAddress` (ADR-332 D11). Έλειπε από το
  // mock, και οι υπάρχουσες άγκυρες δεν το είδαν επειδή καμία δεν προχωρά τον χρόνο
  // πέρα από το debounce — δηλαδή καμία δεν έφτασε ποτέ στη γεωκωδικοποίηση.
  geocodeAddressDetailed: jest.fn().mockResolvedValue({ kind: 'not-found' }),
}));

// Radix Dialog needs pointer-events
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../components/AddressFieldTooltip', () => ({
  AddressFieldTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// --- Fixtures ---

const EMPTY_ADDRESS = {};
const INITIAL_ADDRESS = {
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Θεσσαλονίκη',
  postalCode: '54621',
};

// --- Helpers ---

/**
 * Ο `AddressEditor` χρησιμοποιεί Radix `Tooltip` (undo / redo / retry-geocode),
 * που απαιτεί `TooltipProvider` πρόγονο. Στην εφαρμογή τον παρέχει το
 * `ConditionalAppShell` («wraps EVERYTHING at the top level»). Το test render-άρει
 * τον editor απομονωμένο, οπότε πρέπει να αναπαραστήσει την ίδια συνθήκη —
 * αλλιώς σκάει με «`Tooltip` must be used within `TooltipProvider`», σφάλμα του
 * harness και όχι του κώδικα.
 */
function renderEditor(
  props: Partial<React.ComponentProps<typeof AddressEditor>> = {},
) {
  const onChange = jest.fn();
  const { rerender, container } = render(
    <TooltipProvider>
      <AddressEditor
        value={INITIAL_ADDRESS}
        onChange={onChange}
        {...props}
      />
    </TooltipProvider>,
  );
  return { onChange, rerender, container };
}

// --- Tests ---

describe('AddressEditor — coordinator', () => {
  // Το ορατό label είναι μετάφραση (`t` = identity στα mocks), άρα ΔΕΝ περιέχει
  // ποτέ «addr-street». Το σταθερό συμβόλαιο είναι το `id` του input
  // (`addr-${field}`, AddressEditor.tsx) — αυτό δένει και το <Label htmlFor>.
  const FIELD_IDS = [
    'street', 'number', 'postalCode', 'neighborhood',
    'city', 'county', 'region', 'country',
  ] as const;

  it('renders all 8 address fields', () => {
    const { container } = renderEditor();
    for (const field of FIELD_IDS) {
      expect(container.querySelector(`input#addr-${field}`)).toBeInTheDocument();
    }
  });

  it('calls onChange when a field is edited', () => {
    const { onChange } = renderEditor();
    const input = screen.getByDisplayValue('Σαμοθράκης');
    fireEvent.change(input, { target: { value: 'Εγνατίας' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ street: 'Εγνατίας' }),
    );
  });

  it('initialises fields from value prop', () => {
    renderEditor();
    expect(screen.getByDisplayValue('Σαμοθράκης')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Θεσσαλονίκη')).toBeInTheDocument();
  });

  it('disables all inputs in view mode', () => {
    renderEditor({ mode: 'view' });
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  it('renders undo/redo toolbar buttons', () => {
    renderEditor();
    // Το `t` είναι mock-αρισμένο ως identity — το aria-label ΕΙΝΑΙ το κλειδί i18n.
    // (Το component πέρασε σε i18n· η προσδοκία «Undo»/«Redo» ήταν κατάλοιπο των
    // hardcoded labels και άφηνε το test κόκκινο.)
    expect(screen.getByRole('button', { name: 'editor.coordinator.undo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'editor.coordinator.redo' })).toBeInTheDocument();
  });

  it('hides activity log in view mode', () => {
    renderEditor({ mode: 'view' });
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });
});

// --- Context test ---

function ContextConsumer() {
  const ctx = useAddressEditorContext();
  return <div data-testid="phase">{ctx.editorState.phase}</div>;
}

describe('AddressEditorContext', () => {
  it('exposes editorState via context', () => {
    render(
      <TooltipProvider>
        <AddressEditor value={EMPTY_ADDRESS} onChange={jest.fn()}>
          <ContextConsumer />
        </AddressEditor>
      </TooltipProvider>,
    );
    expect(screen.getByTestId('phase')).toHaveTextContent('idle');
  });

  it('throws outside AddressEditor', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ContextConsumer />)).toThrow(
      'useAddressEditorContext must be used inside <AddressEditor>',
    );
    spy.mockRestore();
  });
});

// =============================================================================
// Η ΑΦΕΤΗΡΙΑ ΕΓΓΥΤΗΤΑΣ ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ — ADR-332 D23
// =============================================================================

/**
 * 🔴 **ΑΥΤΗ ΕΙΝΑΙ Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ.** Ως τις 03/09 ο `AddressEditor` καλούσε το
 * `useAddressSuggestions(currentResult)` **χωρίς options** ⇒ `proximityAnchor` πάντα
 * `undefined` ⇒ `distanceFromCenterM` πάντα `null` ⇒ η γραμμή απόστασης **δεν
 * εμφανίστηκε ποτέ** στην παραγωγή. Καμία από τις 12 άγκυρες του `rankSuggestions`
 * δεν το έπιασε: όλες περνούσαν αφετηρία **οι ίδιες**.
 *
 * Ο έλεγχος **εκτελεί τον παραγωγικό καλόντα** — αν κάποιος σταματήσει να περνά την
 * αφετηρία, εδώ κοκκινίζει.
 */
describe('AddressEditor — η αφετηρία εγγύτητας φτάνει ως το πάνελ (D23)', () => {
  const THESSALONIKI = { lat: 40.6401, lng: 22.9444 };

  /** Δύο διακριτές διευθύνσεις ⇒ `chooser` (D22), ώστε να ζωγραφιστεί ο κατάλογος. */
  function twoChoices(): unknown {
    const base = {
      accuracy: 'exact' as const,
      resolvedFields: { street: 'Αθηνάς', number: '5' },
      partialMatch: false,
      reasoning: {
        fieldMatches: {},
        attemptsLog: [],
        confidenceBreakdown: { base: 0.4, streetMatch: 0, cityMatch: 0, postalMatch: 0, total: 0.6 },
      },
      source: { provider: 'nominatim' as const, variantUsed: 1 as const },
    };
    return {
      kind: 'found',
      result: {
        ...base,
        lat: 40.6440, lng: 22.9500, confidence: 0.6,
        displayName: '5, Αθηνάς, Άνω Πόλη, Θεσσαλονίκη',
        alternatives: [
          { ...base, lat: 39.6390, lng: 22.4191, confidence: 0.55, displayName: '5, Αθηνάς, Λάρισα' },
        ],
      },
    };
  }

  async function renderWithResult(props: Partial<React.ComponentProps<typeof AddressEditor>>) {
    const service = jest.requireMock('@/lib/geocoding/geocoding-service');
    service.geocodeAddressDetailed.mockResolvedValue(twoChoices());
    const view = renderEditor(props);
    // Ο editor γεωκωδικοποιεί μετά από debounce· χωρίς αυτό δεν φτάνει ποτέ αποτέλεσμα.
    await waitFor(
      () => expect(service.geocodeAddressDetailed).toHaveBeenCalled(),
      { timeout: 5000 },
    );
    await waitFor(
      () => expect(screen.getByRole('listbox')).toBeInTheDocument(),
      { timeout: 5000 },
    );
    return view;
  }

  it('ΜΕ αφετηρία: ο κατάλογος δείχνει απόσταση', async () => {
    await renderWithResult({ suggestions: { proximityAnchor: THESSALONIKI } });
    expect(screen.getAllByText('editor.suggestions.distance').length).toBeGreaterThan(0);
  });

  it('ΧΩΡΙΣ αφετηρία: ο κατάλογος υπάρχει, αλλά καμία απόσταση — και είναι σωστό', async () => {
    // Χωρίς σημείο αναφοράς κάθε «κοντά» θα ήταν μαντεψιά· η σιωπή είναι η τίμια απάντηση.
    await renderWithResult({});
    expect(screen.queryByText('editor.suggestions.distance')).toBeNull();
  });
});
