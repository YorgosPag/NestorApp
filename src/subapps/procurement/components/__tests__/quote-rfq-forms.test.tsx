/**
 * @file ADR-598 G11 · §3 procurement — οι δύο φόρμες-κάρτες (`QuoteForm`, `RfqBuilder`).
 *
 * Ως 21/09 καμία από τις δύο **δεν ήταν `<form>`**: το Enter δεν υπέβαλλε τίποτα, το
 * σφάλμα δεν ανακοινωνόταν, και ένα αποτυχημένο αίτημα έδειχνε στον χρήστη το **ωμό σώμα**
 * της απάντησης (`res.text()`). Τώρα: `<form>` + `useFormSubmission` + `fetchJson` + `FormActions`.
 *
 * - Φ1: Enter με τα υποχρεωτικά ⇒ ΕΝΑ POST στο σωστό endpoint, `onSuccess(id)`.
 * - Φ2: «Προσθήκη γραμμής» μέσα στη φόρμα ⇒ προσθέτει γραμμή, ΔΕΝ υποβάλλει
 *       (`type="button"` — το `Button` του έργου δεν έχει προεπιλογή).
 * - Φ3: σφάλμα του server ⇒ το ΜΗΝΥΜΑ του (`{ error }`), όχι ωμό JSON, με `role="alert"`.
 * - Φ4: χωρίς τα υποχρεωτικά ⇒ καμία κλήση δικτύου.
 * - Α1: κανένα εύρημα axe — και με γραμμή στον πίνακα.
 */

import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));
jest.mock('@/providers/DirtyFormProvider', () => ({
  useDirtyForm: () => ({ registerDirty: () => undefined, clearDirty: () => undefined }),
}));
jest.mock('@/subapps/procurement/hooks/useSourcingEvent', () => ({
  useSourcingEvent: () => ({ create: jest.fn() }),
}));

interface PickerProps {
  readonly id?: string;
  readonly 'aria-label'?: string;
  readonly value: string;
  readonly onSelect?: (v: string) => void;
  readonly onChange?: (v: string) => void;
}

/** Οι πραγματικοί επιλογείς διαβάζουν Firestore· εδώ ένα πεδίο με την ίδια σύμβαση ονόματος. */
function mockPicker({ id, value, onSelect, onChange, ...rest }: PickerProps) {
  return (
    <input
      id={id}
      aria-label={rest['aria-label']}
      value={value}
      onChange={(e) => (onSelect ?? onChange)?.(e.target.value)}
    />
  );
}

jest.mock('@/components/procurement/POEntitySelectors', () => ({
  POProjectSelector: (p: PickerProps) => mockPicker(p),
  POSupplierSelector: (p: PickerProps) => mockPicker(p),
}));
jest.mock('../TradeSelector', () => ({ TradeSelector: (p: PickerProps) => mockPicker(p) }));
jest.mock('../VendorPickerSection', () => ({ VendorPickerSection: () => null }));
jest.mock('../BoqLinePicker', () => ({ BoqLinePicker: () => null }));

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { pressEnterToSubmit } from '@/test-utils/implicit-submission';
import { QuoteForm } from '../QuoteForm';
import { RfqBuilder } from '../RfqBuilder';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

function respond(status: number, body: unknown): void {
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
}

const field = (name: RegExp) => screen.getByLabelText<HTMLInputElement>(name);
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

function fillQuote(): void {
  type(field(/^quotes\.project$/), 'proj-1');
  type(field(/^quotes\.vendor$/), 'sup-1');
  type(field(/^quotes\.trade$/), 'concrete');
}

describe('QuoteForm', () => {
  it('Φ1: Enter ⇒ ΕΝΑ POST /api/quotes και onSuccess(id)', async () => {
    respond(201, { data: { id: 'q-1' } });
    const onSuccess = jest.fn();
    render(<QuoteForm onSuccess={onSuccess} onCancel={() => undefined} />);
    fillQuote();
    pressEnterToSubmit(field(/quotes\.paymentTerms/));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('q-1'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/quotes');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('Φ2: «Προσθήκη γραμμής» προσθέτει γραμμή και ΔΕΝ υποβάλλει', () => {
    render(<QuoteForm />);
    fillQuote();
    fireEvent.click(screen.getByRole('button', { name: 'quotes.actions.addLine' }));

    expect(screen.getByRole('table', { name: 'quotes.lines' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Φ3: σφάλμα server ⇒ το μήνυμά του, ανακοινωμένο', async () => {
    respond(409, { success: false, error: 'Η προσφορά υπάρχει ήδη' });
    render(<QuoteForm />);
    fillQuote();
    pressEnterToSubmit(field(/quotes\.paymentTerms/));

    expect(await screen.findByRole('alert')).toHaveTextContent('Η προσφορά υπάρχει ήδη');
  });

  it('Φ4: χωρίς προμηθευτή ⇒ καμία κλήση δικτύου', () => {
    render(<QuoteForm />);
    type(field(/^quotes\.project$/), 'proj-1');
    const form = field(/quotes\.paymentTerms/).form;
    if (form) fireEvent.submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Α1: κανένα εύρημα axe — και με γραμμή', async () => {
    render(<QuoteForm onCancel={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'quotes.actions.addLine' }));
    await expectNoA11yViolations(document.body);
  });
});

describe('RfqBuilder', () => {
  it('Φ1: Enter ⇒ ΕΝΑ POST /api/rfqs και onSuccess(id)', async () => {
    respond(201, { data: { id: 'rfq-1' } });
    const onSuccess = jest.fn();
    render(<RfqBuilder onSuccess={onSuccess} />);
    type(field(/^rfqs\.project$/), 'proj-1');
    type(field(/rfqs\.titleField/), 'Σκυρόδεμα Β΄ φάσης');
    pressEnterToSubmit(field(/rfqs\.titleField/));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('rfq-1'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/rfqs');
  });

  it('Φ2: «Προσθήκη γραμμής» ΔΕΝ υποβάλλει', () => {
    render(<RfqBuilder />);
    type(field(/^rfqs\.project$/), 'proj-1');
    type(field(/rfqs\.titleField/), 'x');
    fireEvent.click(screen.getByRole('button', { name: 'rfqs.addLine' }));

    expect(screen.getByRole('table', { name: 'rfqs.lines' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Α1: κανένα εύρημα axe — και με γραμμή', async () => {
    render(<RfqBuilder onCancel={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'rfqs.addLine' }));
    await expectNoA11yViolations(document.body);
  });
});
