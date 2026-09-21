/**
 * ADR-598 G11 — axe σε ΚΑΘΕ κατάσταση που βλέπει ο άνθρωπος, για τα στοιχεία φόρμας της ρίζας του `ui/`.
 *
 * Ο πήχης (Radix / Material / Fluent): ένα axe στο mount είναι «0 = κανείς δεν κοίταξε». Το
 * πρόβλημα προσβασιμότητας ζει σχεδόν πάντα σε κατάσταση που **δεν** είναι η αρχική — ανοιχτό
 * popover, σφάλμα πεδίου, disabled, κενό. Γι' αυτό κάθε component σαρώνεται σε κάθε μία.
 *
 * ⚠️ Τα αναδυόμενα (Popover, Select, Tooltip) ζουν σε **portal** στο `document.body` — έξω από το
 * `container` του render. Σάρωση του `container` όταν είναι ανοιχτά θα έβλεπε μόνο το κουμπί που
 * τα άνοιξε. Γι' αυτό οι ανοιχτές καταστάσεις σαρώνουν το `document.body`.
 *
 * Και δύο tests **συμπεριφοράς** που το axe δομικά δεν μπορεί να γράψει: το ερέθισμα του
 * `InfoLabel` είναι εστιάσιμο, και η «Προσθήκη «x»» του combobox φτάνει με ↓ και γίνεται με Enter.
 * Και τα δύο ήταν ελαττώματα μέχρι 2026-09-21 με **μηδέν** παραβιάσεις axe. Το δεύτερο ήταν κουμπί
 * ΕΞΩ από το listbox, που το πληκτρολόγιο δεν έφτανε ποτέ. Πλέον είναι επιλογή (ADR-841 §7 Α19.4δ).
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { TooltipProvider } from '@/components/ui/tooltip';

import { HintedField } from '../hinted-field';
import { DatePickerField } from '../date-picker-field';
import { EnumSelect } from '../enum-select';
import { FilterChip } from '../filter-chip';
import { InfoDt, InfoLabel, InfoTableHead } from '../InfoLabel';
import { SearchableCombobox } from '../searchable-combobox';
import { SearchableComboboxListbox, optionDomId } from '../searchable-combobox-listbox';
import type { ComboboxOption } from '../searchable-combobox-types';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

// =============================================================================
// HintedField — υπόδειξη · σφάλμα · disabled · readOnly · κενή υπόδειξη
// =============================================================================

describe('HintedField a11y', () => {
  const base = { id: 'agency-name', label: 'Επωνυμία', value: 'Νέστωρ' };

  it.each([
    ['με υπόδειξη', { hint: 'Όπως στο ΓΕΜΗ' }],
    ['σε σφάλμα', { hint: 'Όπως στο ΓΕΜΗ', error: 'Υποχρεωτικό πεδίο' }],
    ['disabled', { hint: 'Όπως στο ΓΕΜΗ', disabled: true }],
    ['readOnly', { hint: 'Όπως στο ΓΕΜΗ', readOnly: true }],
    ['χωρίς υπόδειξη', { hint: '' }],
    ['με επίθεμα ετικέτας', { hint: 'x', labelSuffix: '(προαιρετικό)' }],
  ])('%s', async (_state, props) => {
    await expectNoA11yViolations(<HintedField {...base} {...props} onChange={jest.fn()} />);
  });

  it('σε σφάλμα: το πεδίο δηλώνεται άκυρο και περιγράφεται από το σφάλμα ΠΡΩΤΑ', () => {
    render(<HintedField {...base} hint="Όπως στο ΓΕΜΗ" error="Υποχρεωτικό" onChange={jest.fn()} />);
    const input = screen.getByRole('textbox', { name: 'Επωνυμία' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Υποχρεωτικό Όπως στο ΓΕΜΗ');
  });
});

// =============================================================================
// DatePickerField — κλειστό · ανοιχτό ημερολόγιο · επιλεγμένη μέρα · disabled
// =============================================================================

describe('DatePickerField a11y', () => {
  function Field(props: Partial<React.ComponentProps<typeof DatePickerField>>) {
    return (
      <form>
        <Label htmlFor="due">Προθεσμία</Label>
        <DatePickerField id="due" value={undefined} onSelect={jest.fn()} placeholder="Επιλέξτε ημερομηνία" {...props} />
      </form>
    );
  }

  it('κλειστό, χωρίς τιμή', async () => {
    await expectNoA11yViolations(<Field />);
  });

  it('κλειστό, με επιλεγμένη ημερομηνία', async () => {
    await expectNoA11yViolations(<Field value={new Date(2026, 8, 21)} />);
  });

  it('disabled', async () => {
    await expectNoA11yViolations(<Field disabled />);
  });

  it('ανοιχτό ημερολόγιο (portal), με απαγορευμένες μέρες', async () => {
    const user = userEvent.setup();
    render(<Field value={new Date(2026, 8, 21)} disabledDates={{ before: new Date(2026, 8, 10) }} />);
    await user.click(screen.getByRole('button', { name: /Προθεσμία|2026/ }));
    expect(screen.getByRole('grid')).toBeInTheDocument();
    await expectNoA11yViolations(document.body);
  });
});

// =============================================================================
// EnumSelect — κλειστό · ανοιχτή λίστα · disabled
// =============================================================================

describe('EnumSelect a11y', () => {
  const PRIORITIES = ['low', 'medium', 'high'] as const;
  const LABELS: Record<(typeof PRIORITIES)[number], string> = {
    low: 'Χαμηλή',
    medium: 'Μεσαία',
    high: 'Υψηλή',
  };

  function Field({ disabled = false }: { readonly disabled?: boolean }) {
    return (
      <form>
        <Label htmlFor="priority">Προτεραιότητα</Label>
        <EnumSelect
          id="priority"
          value="medium"
          values={PRIORITIES}
          getLabel={(value) => LABELS[value]}
          onValueChange={jest.fn()}
          disabled={disabled}
        />
      </form>
    );
  }

  it('κλειστό', async () => {
    await expectNoA11yViolations(<Field />);
  });

  it('disabled', async () => {
    await expectNoA11yViolations(<Field disabled />);
  });

  it('ανοιχτή λίστα (portal)', async () => {
    const user = userEvent.setup();
    render(<Field />);
    const trigger = screen.getByRole('combobox', { name: 'Προτεραιότητα' });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    await expectNoA11yViolations(document.body);
  });
});

// =============================================================================
// FilterChip — μία σειρά ενεργών φίλτρων
// =============================================================================

describe('FilterChip a11y', () => {
  it('σειρά σημαδιών με διακριτά ονόματα αφαίρεσης', async () => {
    await expectNoA11yViolations(
      <ul aria-label="Ενεργά φίλτρα">
        <li>
          <FilterChip label="Θεσσαλονίκη" removeLabel="Αφαίρεση φίλτρου: Θεσσαλονίκη" onRemove={jest.fn()} />
        </li>
        <li>
          <FilterChip label="Διαμέρισμα" removeLabel="Αφαίρεση φίλτρου: Διαμέρισμα" onRemove={jest.fn()} />
        </li>
      </ul>,
    );
  });
});

// =============================================================================
// InfoLabel / InfoTableHead / InfoDt — χωρίς επεξήγηση · κλειστή · ανοιχτή (με ΠΛΗΚΤΡΟΛΟΓΙΟ)
// =============================================================================

describe('InfoLabel family a11y', () => {
  function Form({ tooltip }: { readonly tooltip?: string }) {
    return (
      <TooltipProvider delayDuration={0}>
        <form>
          <InfoLabel htmlFor="rate" label="Επιτόκιο" tooltip={tooltip} />
          <input id="rate" type="text" defaultValue="3,2" />
        </form>
      </TooltipProvider>
    );
  }

  function Grid() {
    return (
      <TooltipProvider delayDuration={0}>
        <Table>
          <TableHeader>
            <TableRow>
              <InfoTableHead label="Σενάριο" />
              <InfoTableHead label="DSCR" tooltip="Λόγος κάλυψης χρέους" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <InfoTableHead scope="row" label="+100 bps" tooltip="Σοκ επιτοκίου" />
              <TableCell>1,42</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <dl>
          <InfoDt label="Συνολικό κόστος" tooltip="Τόκοι και προμήθειες" />
          <dd>12.400 €</dd>
        </dl>
      </TooltipProvider>
    );
  }

  it('ετικέτα χωρίς επεξήγηση', async () => {
    await expectNoA11yViolations(<Form />);
  });

  it('ετικέτα με επεξήγηση, κλειστή', async () => {
    await expectNoA11yViolations(<Form tooltip="Ετήσιο ονομαστικό επιτόκιο" />);
  });

  it('το κουμπί βοήθειας ονομάζεται «ετικέτα + περισσότερες πληροφορίες» και ανοίγει με Tab', async () => {
    const user = userEvent.setup();
    render(<Form tooltip="Ετήσιο ονομαστικό επιτόκιο" />);

    const help = screen.getByRole('button', { name: 'Επιτόκιο a11y.moreInfo' });
    await user.tab();
    expect(help).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Ετήσιο ονομαστικό επιτόκιο');
    await expectNoA11yViolations(document.body);
  });

  it('πίνακας και λίστα ορισμών, κλειστά', async () => {
    await expectNoA11yViolations(<Grid />);
  });

  it('ο όρος με υπογράμμιση είναι στάση Tab και η επεξήγηση γίνεται περιγραφή του', async () => {
    const user = userEvent.setup();
    render(<Grid />);

    await user.tab();
    const term = screen.getByRole('button', { name: 'DSCR' });
    expect(term).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Λόγος κάλυψης χρέους');
    expect(term).toHaveAccessibleDescription('Λόγος κάλυψης χρέους');
    await expectNoA11yViolations(document.body);
  });
});

// =============================================================================
// SearchableCombobox — «Προσθήκη «x»» ως ΕΠΙΛΟΓΗ της λίστας (ADR-841 §7 Α19.4δ)
// =============================================================================

describe('SearchableCombobox a11y — «Προσθήκη «x»» ως επιλογή', () => {
  const OPTIONS: ComboboxOption[] = [
    { value: 'friend', label: 'Φίλος' },
    { value: 'cousin', label: 'Ξάδερφος', secondaryLabel: 'συγγενής' },
    { value: 'boss', label: 'Προϊστάμενος', disabled: true, disabledHint: 'κλειδωμένο' },
  ];
  const formatAddNewLabel = (typed: string) => `Προσθήκη «${typed}»`;

  function Harness({
    onAddNew = jest.fn(),
    withAddNew = true,
  }: { readonly onAddNew?: (label: string) => void; readonly withAddNew?: boolean }) {
    const [value, setValue] = React.useState('');
    return (
      <>
        <Label htmlFor="relationship-type">Τύπος σχέσης</Label>
        <SearchableCombobox
          id="relationship-type"
          value={value}
          onValueChange={(next) => setValue(next)}
          options={OPTIONS}
          debounceMs={0}
          emptyMessage="Κανένας τύπος"
          {...(withAddNew ? { onAddNew, formatAddNewLabel } : {})}
        />
      </>
    );
  }

  const combobox = () => screen.getByRole('combobox', { name: 'Τύπος σχέσης' });

  it('ονομάζεται από την ετικέτα του (`id` → `htmlFor`)', () => {
    render(<Harness />);
    expect(combobox()).toBeInTheDocument();
  });

  it('κλειστό · ανοιχτό · με πληκτρολογημένο νέο κείμενο · με την προσφορά επισημασμένη', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await expectNoA11yViolations(container);

    await user.click(combobox());
    await expectNoA11yViolations(document.body);

    await user.type(combobox(), 'Κουμπάρος');
    expect(screen.getByRole('option', { name: 'Προσθήκη «Κουμπάρος»' })).toBeInTheDocument();
    await expectNoA11yViolations(document.body);

    await user.keyboard('{ArrowDown}');
    await expectNoA11yViolations(document.body);
  });

  it('↓ φτάνει στην προσφορά μετά τις επιλογές, ανακοινώνεται, και το Enter τη δημιουργεί', async () => {
    const onAddNew = jest.fn();
    const user = userEvent.setup();
    render(<Harness onAddNew={onAddNew} />);

    // «φίλ» ταιριάζει ΜΟΝΟ το «Φίλος» ⇒ κατάλογος: [Φίλος, Προσθήκη «φίλ»]
    await user.type(combobox(), 'φίλ');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Φίλος', 'Προσθήκη «φίλ»']);

    await user.keyboard('{ArrowDown}{ArrowDown}');
    const addNew = screen.getByRole('option', { name: 'Προσθήκη «φίλ»' });
    expect(combobox()).toHaveAttribute('aria-activedescendant', addNew.id);
    expect(addNew).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    expect(onAddNew).toHaveBeenCalledTimes(1);
    expect(onAddNew).toHaveBeenCalledWith('φίλ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('χωρίς κανένα ταίριασμα, η προσφορά είναι η ΜΟΝΗ επιλογή — όχι ψευδο-γραμμή «κανένα αποτέλεσμα»', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(combobox(), 'Κουμπάρος');

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.queryByText('Κανένας τύπος')).not.toBeInTheDocument();
  });

  it('ΔΕΝ προσφέρει διπλότυπο: ίδια ετικέτα, και χωρίς τόνους ή με άλλα κεφαλαία', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(combobox(), 'ΦΙΛΟΣ');

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Φίλος']);
  });

  it('χωρίς `onAddNew` και χωρίς ταίριασμα: μήνυμα, κανένα listbox, κανένα `aria-controls` στο κενό', async () => {
    const user = userEvent.setup();
    render(<Harness withAddNew={false} />);
    await user.type(combobox(), 'Κουμπάρος');

    expect(screen.getByText('Κανένας τύπος')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combobox()).not.toHaveAttribute('aria-controls');
    await expectNoA11yViolations(document.body);
  });
});

// =============================================================================
// SearchableComboboxListbox — το leaf, σε κάθε κατάσταση που αποδίδει
// =============================================================================

describe('SearchableComboboxListbox a11y', () => {
  const OPTIONS: ComboboxOption[] = [
    { value: 'friend', label: 'Φίλος' },
    { value: 'boss', label: 'Προϊστάμενος', disabled: true, disabledHint: 'κλειδωμένο' },
  ];

  function Listbox({
    highlightedIndex = -1,
    addNewText = 'Προσθήκη «Κουμπάρος»',
    options = OPTIONS,
  }: {
    readonly highlightedIndex?: number;
    readonly addNewText?: string | null;
    readonly options?: readonly ComboboxOption[];
  }) {
    const listRef = React.useRef<HTMLUListElement>(null);
    return (
      <>
        <input role="combobox" aria-label="Τύπος σχέσης" aria-expanded="true" aria-controls="lb" readOnly />
        <SearchableComboboxListbox
          id="lb"
          listRef={listRef}
          options={options}
          highlightedIndex={highlightedIndex}
          addNewText={addNewText}
          onSelect={jest.fn()}
          onAddNew={jest.fn()}
          onHighlight={jest.fn()}
        />
      </>
    );
  }

  it.each([
    ['με επιλογές και προσφορά', {}],
    ['με την προσφορά επισημασμένη', { highlightedIndex: OPTIONS.length }],
    ['χωρίς προσφορά', { addNewText: null }],
    ['μόνο η προσφορά', { options: [] }],
  ])('%s', async (_label, props) => {
    const { container } = render(<Listbox {...props} />);
    await expectNoA11yViolations(container);
  });

  it('η προσφορά παίρνει το `id` της θέσης ΜΕΤΑ την τελευταία επιλογή', () => {
    render(<Listbox />);
    expect(screen.getByRole('option', { name: 'Προσθήκη «Κουμπάρος»' }).id).toBe(
      optionDomId('lb', OPTIONS.length),
    );
  });
});
