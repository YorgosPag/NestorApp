/**
 * @jest-environment jsdom
 */
/**
 * ⚓ ADR-950 §10.5 · §11 — ο διάλογος «Διόρθωση ανάγνωσης».
 *
 * Τι φυλάει: (α) τιμή που δεν περνά τον ελεγκτή **δεν αποθηκεύεται** — τα κουμπιά μένουν σβηστά· (β) η κρίση φαίνεται
 * **πριν** από την αποθήκευση· (γ) το κύριο κουμπί κάνει την πράξη που ακολουθεί **μόνο** όταν αυτή είναι δυνατή, και
 * το «Μόνο διόρθωση» δεν τη ζητά ποτέ· (δ) ο διάλογος δεν γράφει τίποτα μόνος του — μόνο ενημερώνει τον καλούντα.
 */

import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => (params ? `${key}|${Object.values(params).join('|')}` : key),
  }),
}));

jest.mock('@/components/ui/doy-picker', () => ({
  DoyPicker: ({ id, value, onValueChange }: { id: string; value: string; onValueChange: (value: string) => void }) => (
    <input id={id} data-testid="doy-picker" value={value} onChange={(event) => onValueChange(event.target.value)} />
  ),
}));

const mockVat = jest.fn();
jest.mock('@/hooks/useVatUniqueness', () => ({ useVatUniqueness: (...args: unknown[]) => mockVat(...args) }));

import type { EvidenceFollowUp } from '@/lib/contacts/contact-evidence-acceptance';
import type { EvidenceComparisonState, EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import type { EvidenceCorrectionField, EvidenceCorrectionValues } from '@/lib/contacts/contact-evidence-corrections';

import { ContactEvidenceCorrectionDialog, type EvidenceCorrectionOutcomePreview } from '../ContactEvidenceCorrectionDialog';

const P = 'contacts-form:documentEvidence.correction';
const VALID_VAT = '040817944';
const VAT_FIELD: EvidenceCorrectionField = { key: 'vatNumber', kind: 'vat', machine: '0408 7944', alternate: null, initial: '0408 7944' };

const rowWith = (state: EvidenceComparisonState, contact: string | null = null): EvidenceRow =>
  ({ key: 'vatNumber', state, contact }) as unknown as EvidenceRow;

function setup(options: {
  readonly fields?: readonly EvidenceCorrectionField[];
  readonly corrected?: boolean;
  readonly outcome?: (values: EvidenceCorrectionValues) => EvidenceCorrectionOutcomePreview | null;
  readonly followUpBusy?: boolean;
} = {}) {
  const onSave = jest.fn<void, [EvidenceCorrectionValues, EvidenceFollowUp | null]>();
  const onClear = jest.fn();
  const onClose = jest.fn();
  render(
    <ContactEvidenceCorrectionDialog
      row="vatNumber"
      rowLabel="ΑΦΜ"
      purpose="stamp-signature"
      contactId="cont_self"
      fields={options.fields ?? [VAT_FIELD]}
      corrected={options.corrected ?? false}
      outcomeOf={options.outcome ?? (() => null)}
      followUpBusy={options.followUpBusy ?? false}
      onSave={onSave}
      onClear={onClear}
      onClose={onClose}
    />,
  );
  const type = (value: string) => fireEvent.change(screen.getByLabelText('ΑΦΜ'), { target: { value } });
  const button = (key: string) => screen.queryByRole('button', { name: key }) as HTMLButtonElement | null;
  return { onSave, onClear, onClose, type, button };
}

beforeEach(() => {
  mockVat.mockReset();
  mockVat.mockReturnValue({ isChecking: false, result: null });
});

describe('ο ελεγκτής κρατά το κουμπί — ίδιος με του διακομιστή', () => {
  it('ξεκινά με ό,τι διάβασε η μηχανή· δεν περνά ⇒ αποθήκευση σβηστή και μήνυμα', () => {
    const { button } = setup();
    expect((screen.getByLabelText('ΑΦΜ') as HTMLInputElement).value).toBe('0408 7944');
    expect(button(`${P}.save`)?.disabled).toBe(true);
    expect(screen.getByText(`${P}.invalid`)).toBeTruthy();
  });

  it('ΑΦΜ με λάθος ψηφίο ελέγχου ⇒ σβηστό· σωστός ⇒ ανάβει και αποθηκεύει ΜΟΝΟ τη διόρθωση', () => {
    const { type, button, onSave, onClose } = setup();
    type('040817945');
    expect(button(`${P}.save`)?.disabled).toBe(true);
    type(VALID_VAT);
    expect(screen.queryByText(`${P}.invalid`)).toBeNull();
    fireEvent.click(button(`${P}.save`) as HTMLButtonElement);
    expect(onSave).toHaveBeenCalledWith({ vatNumber: VALID_VAT }, null);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('κενό πεδίο δεν είναι «λάθος τιμή» — σβηστό κουμπί, κανένα μήνυμα', () => {
    const { type, button } = setup();
    type('');
    expect(button(`${P}.save`)?.disabled).toBe(true);
    expect(screen.queryByText(`${P}.invalid`)).toBeNull();
  });
});

describe('η κρίση ΠΡΙΝ από την αποθήκευση, και η πράξη με το ίδιο πάτημα (ADR-950 §11)', () => {
  const missing = () => ({ row: rowWith('missing'), followUp: 'register' as const });

  it('άκυρη τιμή ⇒ καμία κρίση και καμία πράξη (η σύγκριση δεν ρωτιέται καν)', () => {
    const outcome = jest.fn(missing);
    const { button } = setup({ outcome });
    expect(outcome).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('');
    expect(button(`${P}.followUp.register`)).toBeNull();
  });

  it('«Λείπει» από την προβολή ⇒ κύριο κουμπί «Αποθήκευση και καταχώριση», δίπλα «Μόνο διόρθωση»', () => {
    const { type, button, onSave } = setup({ outcome: missing });
    type(VALID_VAT);
    expect(screen.getByText(`${P}.outcome|contacts-form:documentEvidence.state.missing`)).toBeTruthy();
    expect(button(`${P}.save`)).toBeNull();
    fireEvent.click(button(`${P}.followUp.register`) as HTMLButtonElement);
    expect(onSave).toHaveBeenCalledWith({ vatNumber: VALID_VAT }, 'register');
  });

  it('«Μόνο διόρθωση» δεν ζητά ΠΟΤΕ την πράξη που ακολουθεί', () => {
    const { type, button, onSave } = setup({ outcome: missing });
    type(VALID_VAT);
    fireEvent.click(button(`${P}.saveOnly`) as HTMLButtonElement);
    expect(onSave).toHaveBeenCalledWith({ vatNumber: VALID_VAT }, null);
  });

  it('«Διαφέρει» ⇒ δείχνει τι λέει η επαφή, καμία πράξη — μόνο αποθήκευση της διόρθωσης', () => {
    const { type, button } = setup({ outcome: () => ({ row: rowWith('differs', '094063140'), followUp: null }) });
    type(VALID_VAT);
    expect(screen.getByText(`${P}.outcome|contacts-form:documentEvidence.state.differs`)).toBeTruthy();
    expect(screen.getByText(`${P}.contactSays|094063140`)).toBeTruthy();
    expect(button(`${P}.saveOnly`)).toBeNull();
    expect(button(`${P}.save`)?.disabled).toBe(false);
  });

  it('τρέχει ήδη αποθήκευση της καρτέλας ⇒ η πράξη περιμένει, η σκέτη διόρθωση όχι', () => {
    const { type, button } = setup({ outcome: missing, followUpBusy: true });
    type(VALID_VAT);
    expect(button(`${P}.followUp.register`)?.disabled).toBe(true);
    expect(button(`${P}.saveOnly`)?.disabled).toBe(false);
  });
});

describe('το ΑΦΜ το έχει ήδη άλλη επαφή (ADR-950 §12)', () => {
  const missing = () => ({ row: rowWith('missing'), followUp: 'register' as const });
  const taken = { isChecking: false, result: { isUnique: false, existingContact: { id: 'cont_other', name: 'Άλλη Επαφή', type: 'individual' } } };

  it('ρωτά για ό,τι γράφει ο άνθρωπος, εξαιρώντας την ίδια την επαφή', () => {
    const { type } = setup({ outcome: missing });
    type(VALID_VAT);
    expect(mockVat).toHaveBeenLastCalledWith(VALID_VAT, 'cont_self');
  });

  it('διπλό ⇒ προειδοποίηση με το όνομα, ΚΑΜΙΑ «καταχώριση» — μόνο αποθήκευση της διόρθωσης', () => {
    mockVat.mockReturnValue(taken);
    const { type, button, onSave } = setup({ outcome: missing });
    type(VALID_VAT);
    expect(screen.getByRole('alert').textContent).toContain('Άλλη Επαφή');
    expect(button(`${P}.followUp.register`)).toBeNull();
    expect(button(`${P}.saveOnly`)).toBeNull();
    fireEvent.click(button(`${P}.save`) as HTMLButtonElement);
    expect(onSave).toHaveBeenCalledWith({ vatNumber: VALID_VAT }, null);
  });

  it('όσο τρέχει ο έλεγχος, η καταχώριση περιμένει· η σκέτη διόρθωση όχι', () => {
    mockVat.mockReturnValue({ isChecking: true, result: null });
    const { type, button } = setup({ outcome: missing });
    type(VALID_VAT);
    expect(button(`${P}.followUp.register`)?.disabled).toBe(true);
    expect(button(`${P}.saveOnly`)?.disabled).toBe(false);
  });

  it('διπλό σε επεξεργασία ⇒ η «αποδοχή» μένει (η φόρμα προειδοποιεί μόνη της)', () => {
    mockVat.mockReturnValue(taken);
    const { type, button } = setup({ outcome: () => ({ row: rowWith('missing'), followUp: 'accept' }) });
    type(VALID_VAT);
    expect(button(`${P}.followUp.accept`)?.disabled).toBe(false);
  });
});

describe('δύο αναγνώσεις · αναίρεση', () => {
  it('διαφωνία ⇒ ήδη συμπληρωμένη όποια περνά ΜΟΝΗ της τον ελεγκτή, και οι δύο ως επιλογές', () => {
    const disputed: EvidenceCorrectionField = { ...VAT_FIELD, machine: '040817914', alternate: VALID_VAT, initial: '040817914' };
    const { button } = setup({ fields: [disputed] });
    expect((screen.getByLabelText('ΑΦΜ') as HTMLInputElement).value).toBe(VALID_VAT);
    fireEvent.click(button(`${P}.firstReading|040817914`) as HTMLButtonElement);
    expect((screen.getByLabelText('ΑΦΜ') as HTMLInputElement).value).toBe('040817914');
    expect(button(`${P}.save`)?.disabled).toBe(true);
  });

  it('χωρίς διόρθωση δεν προσφέρεται «Αναίρεση διόρθωσης»', () => {
    expect(setup().button(`${P}.clear`)).toBeNull();
  });

  it('«Αναίρεση διόρθωσης» δεν αποθηκεύει τίποτα — μόνο αναιρεί', () => {
    const { button, onClear, onSave, onClose } = setup({ corrected: true, fields: [{ ...VAT_FIELD, initial: VALID_VAT }] });
    fireEvent.click(button(`${P}.clear`) as HTMLButtonElement);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
