/**
 * @fileoverview Άγκυρες της **πράξης** αλλαγής κοινού (ADR-864 Ε-10 · §5.2).
 *
 * | # | Κανόνας | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Ε1 | στένεμα ⇒ **πρώτα** επιβεβαίωση, γραφή **μόνο** μετά | γραφή χωρίς επιβεβαίωση |
 * | Ε2 | διεύρυνση ⇒ γραφή αμέσως | επιβεβαίωση σε κάθε αλλαγή (τριβή χωρίς λόγο) |
 * | Ε3 | ακύρωση ⇒ **καμία** γραφή | η ακύρωση γράφει |
 * | Ε4 | αποτυχία ⇒ ορατό μήνυμα, τιμή = η αποθηκευμένη | αισιόδοξη όψη |
 * | Ε5 | το `network` είναι **μη επιλέξιμο** μέχρι το ADR-862 | επιλογή που υπόσχεται ό,τι δεν συμβαίνει |
 *
 * Τα Radix Select / AlertDialog αντικαθίστανται από εγγενή στοιχεία: ελέγχεται ο **καλών**,
 * όχι η βιβλιοθήκη.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/ui/select', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Select: ({
      value,
      onValueChange,
      disabled,
      children,
    }: {
      value: string;
      onValueChange: (next: string) => void;
      disabled?: boolean;
      children?: React.ReactNode;
    }) => (
      <select
        aria-label="audience"
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {children}
      </select>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: Pass,
    SelectItem: ({ value, disabled, children }: { value: string; disabled?: boolean; children?: React.ReactNode }) => (
      <option value={value} disabled={disabled}>
        {children}
      </option>
    ),
  };
});
jest.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({
    open,
    onOpenChange,
    onConfirm,
    confirmText,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    confirmText?: string;
  }) =>
    open ? (
      <section role="alertdialog">
        <button type="button" onClick={onConfirm}>
          {confirmText}
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          cancel
        </button>
      </section>
    ) : null,
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import { MarketingAudienceControl } from '../MarketingAudienceControl';

const CONFIRM = 'property-market:audience.narrowing.confirm';

function choose(value: string): void {
  fireEvent.change(screen.getByLabelText('audience'), { target: { value } });
}

describe('MarketingAudienceControl — το στένεμα ζητά επιβεβαίωση, η γραφή δεν είναι αισιόδοξη', () => {
  it('🔴 Ε1 — στένεμα `public → custodians`: ΚΑΜΙΑ γραφή πριν την επιβεβαίωση, μία μετά', async () => {
    const onChange = jest.fn(async () => true);
    render(<MarketingAudienceControl audience="public" onChange={onChange} />);

    choose('custodians');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText(CONFIRM));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('custodians');
  });

  it('Ε2 — διεύρυνση `custodians → public`: γραφή ΑΜΕΣΩΣ, χωρίς διάλογο', async () => {
    const onChange = jest.fn(async () => true);
    render(<MarketingAudienceControl audience="custodians" onChange={onChange} />);

    await act(async () => {
      choose('public');
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('public');
  });

  it('🔴 Ε3 — ακύρωση του στενέματος ⇒ ΚΑΜΙΑ γραφή', () => {
    const onChange = jest.fn(async () => true);
    render(<MarketingAudienceControl audience="public" onChange={onChange} />);

    choose('custodians');
    fireEvent.click(screen.getByText('cancel'));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('🔴 Ε4 — αποτυχία ⇒ μήνυμα με λόγια, και η εμφανιζόμενη τιμή ΜΕΝΕΙ η αποθηκευμένη', async () => {
    const onChange = jest.fn(async () => false);
    render(<MarketingAudienceControl audience="custodians" onChange={onChange} />);

    await act(async () => {
      choose('public');
    });

    await waitFor(() => expect(screen.getByText('property-market:audience.failed')).toBeInTheDocument());
    expect(screen.getByLabelText('audience')).toHaveValue('custodians');
  });

  it('Ε5 — το `network` φαίνεται αλλά ΔΕΝ επιλέγεται (προϋποθέτει ADR-862)', () => {
    render(<MarketingAudienceControl audience="public" onChange={jest.fn(async () => true)} />);

    const network = screen.getByText('properties-enums:marketingAudience.network');
    expect(network).toBeDisabled();
    expect(screen.getByText('properties-enums:marketingAudience.custodians')).not.toBeDisabled();
  });
});
