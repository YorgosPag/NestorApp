import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { EmployerPicker } from '../../EmployerPicker';
import { EscoOccupationPicker } from '../../EscoOccupationPicker';
import { EscoSkillPicker } from '../../EscoSkillPicker';

// ---------------------------------------------------------------------------
// Mocks — isolate the shared picker mechanics (search/debounce/keyboard/listbox)
// from Radix portals, design-system primitives and the data services. (ADR-601)
// ---------------------------------------------------------------------------

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ text: { muted: 'muted' }, bg: { muted: 'bg-muted' } }),
}));

jest.mock('@/lib/design-system', () => ({}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, Record<string, unknown>>((props, ref) => (
    <input
      ref={ref}
      role={props.role as string}
      aria-expanded={props['aria-expanded'] as boolean}
      value={props.value as string}
      onChange={props.onChange as React.ChangeEventHandler<HTMLInputElement>}
      onKeyDown={props.onKeyDown as React.KeyboardEventHandler<HTMLInputElement>}
      onFocus={props.onFocus as React.FocusEventHandler<HTMLInputElement>}
      disabled={props.disabled as boolean}
      placeholder={props.placeholder as string}
    />
  )),
}));

jest.mock('@/components/ui/spinner', () => ({
  Spinner: () => <span data-testid="spinner" />,
}));

// Shell has its own test — here render anchor always + content when open.
jest.mock('@/components/shared/pickers/picker-popover-shell', () => ({
  PickerPopoverShell: ({ open, anchor, children }: { open: boolean; anchor: React.ReactNode; children: React.ReactNode }) => (
    <div>{anchor}{open ? children : null}</div>
  ),
}));

const getAllContacts = jest.fn();
jest.mock('@/services/contacts.service', () => ({
  ContactsService: { getAllContacts: (...a: unknown[]) => getAllContacts(...a) },
}));

const searchOccupations = jest.fn();
const searchSkills = jest.fn();
jest.mock('@/services/esco.service', () => ({
  EscoService: {
    searchOccupations: (...a: unknown[]) => searchOccupations(...a),
    searchSkills: (...a: unknown[]) => searchSkills(...a),
  },
}));

beforeEach(() => {
  getAllContacts.mockReset();
  searchOccupations.mockReset();
  searchSkills.mockReset();
});

// ---------------------------------------------------------------------------
// EmployerPicker
// ---------------------------------------------------------------------------

describe('EmployerPicker (ADR-601)', () => {
  it('emits free text immediately on input change', () => {
    const onChange = jest.fn();
    render(<EmployerPicker value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Ac' } });
    expect(onChange).toHaveBeenCalledWith({ employer: 'Ac', employerId: undefined });
  });

  it('searches company contacts and links the selected result', async () => {
    getAllContacts.mockResolvedValue({
      contacts: [{ type: 'company', id: 'c1', companyName: 'Acme', tradeName: 'Acme Ltd', vatNumber: '123' }],
    });
    const onChange = jest.fn();
    render(<EmployerPicker value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Ac' } });
    const option = await screen.findByText('Acme');
    fireEvent.click(option);

    expect(onChange).toHaveBeenLastCalledWith({ employer: 'Acme', employerId: 'c1' });
  });

  it('clears the value via the clear button', () => {
    const onChange = jest.fn();
    render(<EmployerPicker value="Acme" employerId="c1" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.clear' }));
    expect(onChange).toHaveBeenLastCalledWith({ employer: '', employerId: undefined });
  });
});

// ---------------------------------------------------------------------------
// EscoOccupationPicker
// ---------------------------------------------------------------------------

describe('EscoOccupationPicker (ADR-601)', () => {
  it('emits free text profession on input change', () => {
    const onChange = jest.fn();
    render(<EscoOccupationPicker value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Μη' } });
    expect(onChange).toHaveBeenCalledWith({
      profession: 'Μη', escoUri: undefined, escoLabel: undefined, iscoCode: undefined,
    });
  });

  it('searches occupations and emits ESCO metadata on select', async () => {
    searchOccupations.mockResolvedValue({
      results: [{ occupation: { uri: 'u1', iscoCode: '1234', preferredLabel: { el: 'Μηχανικός', en: 'Engineer' } } }],
    });
    const onChange = jest.fn();
    render(<EscoOccupationPicker value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Μη' } });
    fireEvent.click(await screen.findByText('Μηχανικός'));

    expect(onChange).toHaveBeenLastCalledWith({
      profession: 'Μηχανικός', escoUri: 'u1', escoLabel: 'Μηχανικός', iscoCode: '1234',
    });
  });
});

// ---------------------------------------------------------------------------
// EscoSkillPicker (multi-select)
// ---------------------------------------------------------------------------

describe('EscoSkillPicker (ADR-601)', () => {
  it('renders selected skills as chips', () => {
    render(<EscoSkillPicker value={[{ uri: 's1', label: 'Python' }]} onChange={jest.fn()} />);
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('appends a searched skill on select', async () => {
    searchSkills.mockResolvedValue({
      results: [{ skill: { uri: 's1', preferredLabel: { el: 'Πάιθον', en: 'Python' } } }],
    });
    const onChange = jest.fn();
    render(<EscoSkillPicker value={[]} onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Py' } });
    fireEvent.click(await screen.findByText('Πάιθον'));

    expect(onChange).toHaveBeenCalledWith([{ uri: 's1', label: 'Πάιθον' }]);
  });

  it('removes the last skill on Backspace with empty input', () => {
    const onChange = jest.fn();
    render(<EscoSkillPicker value={[{ uri: 's1', label: 'Python' }]} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
