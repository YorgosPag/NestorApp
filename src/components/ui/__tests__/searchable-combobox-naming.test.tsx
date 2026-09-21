/**
 * Άγκυρα — **ΚΑΘΕ COMBOBOX ΕΧΕΙ ΟΝΟΜΑ, ΚΑΙ ΤΟ ΟΝΟΜΑ ΥΠΑΡΧΕΙ**
 *
 * ## Γιατί υπάρχει
 *
 * Στις 2026-09-21 μετρήθηκαν ~27 `role="combobox"` **χωρίς όνομα** σε 18 αρχεία (axe
 * `aria-input-field-name`, WCAG 4.1.2), και δύο ορατές ετικέτες με `htmlFor` προς `id`
 * που **δεν αποδιδόταν ποτέ** (`fwa-vendor`, `customerTaxOffice`).
 *
 * Δύο ερωτήσεις, δύο φύλακες:
 * - *«Δήλωσε όνομα;»* → ο **τύπος** `FieldAccessibleName` (δεν ελέγχεται εδώ — ελέγχεται από
 *   τον tsc και, για όλο το `src/`, από τη φρουρά `combobox-naming.test.ts`).
 * - *«Το όνομα ΥΠΑΡΧΕΙ στο DOM;»* → ο **φύλακας εκτέλεσης** του `SearchableCombobox`, που
 *   ελέγχεται εδώ, μαζί με το `findMissingAccessibleName` που τον τροφοδοτεί.
 *
 * @module components/ui/__tests__/searchable-combobox-naming
 * @see ADR-598 G11 · ADR-841 §7 Α19.4δ
 */

import { render, screen } from '@testing-library/react';
import { SearchableCombobox } from '../searchable-combobox';
import { Label } from '../label';
import type { ComboboxOption } from '../searchable-combobox-types';
import { findMissingAccessibleName } from '@/lib/a11y/accessible-name';
import { expectNoA11yViolations } from '@/test-utils/a11y';

const OPTIONS: ComboboxOption[] = [
  { value: 'ath', label: 'Αθήνα' },
  { value: 'thes', label: 'Θεσσαλονίκη' },
];
const noop = () => undefined;
const GUARD = '[SearchableCombobox] unnamed combobox';

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(noop);
});
afterEach(() => errorSpy.mockRestore());

function guardCalls(): unknown[][] {
  return errorSpy.mock.calls.filter((args) => String(args[0]).startsWith(GUARD));
}

describe('SearchableCombobox — όνομα από κάθε δρόμο που επιτρέπει ο τύπος', () => {
  it('id + <Label htmlFor> ⇒ η ορατή ετικέτα ονομάζει το πεδίο, ο φύλακας σιωπά', async () => {
    const { container } = render(
      <>
        <Label htmlFor="city">Πόλη</Label>
        <SearchableCombobox id="city" value="" onValueChange={noop} options={OPTIONS} />
      </>,
    );
    expect(screen.getByRole('combobox', { name: 'Πόλη' })).toBeInTheDocument();
    expect(guardCalls()).toHaveLength(0);
    await expectNoA11yViolations(container);
  });

  it('aria-labelledby ⇒ ονομάζεται από ορατό κείμενο που δεν είναι <label> (legend, κεφαλίδα)', () => {
    render(
      <fieldset>
        <legend id="suppliers">Προτιμώμενοι προμηθευτές</legend>
        <SearchableCombobox aria-labelledby="suppliers" value="" onValueChange={noop} options={OPTIONS} />
      </fieldset>,
    );
    expect(screen.getByRole('combobox', { name: 'Προτιμώμενοι προμηθευτές' })).toBeInTheDocument();
    expect(guardCalls()).toHaveLength(0);
  });

  it('aria-label ⇒ όνομα χωρίς ορατό κείμενο', () => {
    render(<SearchableCombobox aria-label="Ειδικότητα" value="" onValueChange={noop} options={OPTIONS} />);
    expect(screen.getByRole('combobox', { name: 'Ειδικότητα' })).toBeInTheDocument();
    expect(guardCalls()).toHaveLength(0);
  });
});

describe('<label> που περιτυλίγει: τι ονομάζει ΠΡΑΓΜΑΤΙΚΑ (μετρημένο, όχι υποθετικό)', () => {
  it('μόνο με κείμενο ετικέτας ⇒ σωστό όνομα (τα κουμπιά ×/▾ ΔΕΝ μπαίνουν)', () => {
    render(
      <label>
        Ειδικότητα
        <SearchableCombobox id="wrapped" value="ath" onValueChange={noop} options={OPTIONS} />
      </label>,
    );
    expect(screen.getByRole('combobox', { name: 'Ειδικότητα' })).toBeInTheDocument();
    expect(guardCalls()).toHaveLength(0); // `input.labels` βλέπει και την περιτύλιξη
  });

  it('με υπαινιγμό ΜΕΣΑ στην ετικέτα (σχήμα AgencyDirectoryFilters) ⇒ ο υπαινιγμός μπαίνει στο όνομα', () => {
    const { container } = render(
      <label>
        <span>Περιοχή</span>
        <input />
        <p>Δείχνει αποτελέσματα σε ακτίνα 10 km</p>
      </label>,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(screen.queryByRole('textbox', { name: 'Περιοχή' })).toBeNull();
    expect(input).toHaveAccessibleName(/Περιοχή.*ακτίνα/);
  });
});

describe('SearchableCombobox — ο φύλακας πιάνει ό,τι ο τύπος ΔΕΝ μπορεί', () => {
  it('κρεμασμένο id (καμία ετικέτα δεν δείχνει εκεί) ⇒ console.error με το id', () => {
    render(<SearchableCombobox id="fwa-vendor" value="" onValueChange={noop} options={OPTIONS} />);
    const calls = guardCalls();
    expect(calls).toHaveLength(1);
    expect(String(calls[0][0])).toContain('fwa-vendor');
  });

  it('ετικέτα με htmlFor προς ΑΛΛΟ id (το σχήμα του fwa-vendor) ⇒ console.error', () => {
    render(
      <>
        <Label htmlFor="fwa-vendor">Προμηθευτής</Label>
        <SearchableCombobox id="vendor" value="" onValueChange={noop} options={OPTIONS} />
      </>,
    );
    expect(guardCalls()).toHaveLength(1);
  });

  it('aria-labelledby προς στοιχείο που δεν υπάρχει ⇒ console.error', () => {
    render(<SearchableCombobox aria-labelledby="ghost" value="" onValueChange={noop} options={OPTIONS} />);
    expect(String(guardCalls()[0]?.[0])).toContain('ghost');
  });
});

describe('findMissingAccessibleName — η απάντηση του DOM', () => {
  function input(html: string, selector = 'input'): HTMLInputElement {
    document.body.innerHTML = html;
    return document.querySelector(selector) as HTMLInputElement;
  }
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['ρητή ετικέτα', '<label for="a">A</label><input id="a">'],
    ['ετικέτα που τυλίγει', '<label>A <input></label>'],
    ['aria-label', '<input aria-label="A">'],
    ['aria-labelledby, όλοι οι στόχοι υπάρχουν', '<span id="x">A</span><span id="y">B</span><input aria-labelledby="x y">'],
  ])('%s ⇒ null (έχει όνομα)', (_case, html) => {
    expect(findMissingAccessibleName(input(html))).toBeNull();
  });

  it.each([
    ['τίποτα', '<input>', 'no id'],
    ['id χωρίς ετικέτα', '<input id="a">', 'htmlFor="a"'],
    ['aria-label μόνο κενά', '<input aria-label="   ">', 'no id'],
    ['aria-labelledby με έναν στόχο που λείπει', '<span id="x">A</span><input aria-labelledby="x y">', 'element(s): y'],
  ])('%s ⇒ αιτία', (_case, html, reason) => {
    expect(findMissingAccessibleName(input(html))).toContain(reason);
  });
});
