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
 * | **Α21** (ADR-864 Φ3) | άρνηση διακομιστή ⇒ **ο λόγος** στην οθόνη, όχι «δοκίμασε ξανά» | `onChange: Promise<boolean>` (ο λόγος χάνεται) |
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
import { MarketingAudienceControl, type AudienceChangeOutcome } from '../MarketingAudienceControl';

const SAVED: AudienceChangeOutcome = { kind: 'saved' };
const FAILED: AudienceChangeOutcome = { kind: 'failed' };

const CONFIRM = 'property-market:audience.narrowing.confirm';

function choose(value: string): void {
  fireEvent.change(screen.getByLabelText('audience'), { target: { value } });
}

describe('MarketingAudienceControl — το στένεμα ζητά επιβεβαίωση, η γραφή δεν είναι αισιόδοξη', () => {
  it('🔴 Ε1 — στένεμα `public → custodians`: ΚΑΜΙΑ γραφή πριν την επιβεβαίωση, μία μετά', async () => {
    const onChange = jest.fn(async () => SAVED);
    render(<MarketingAudienceControl offered audience="public" onChange={onChange} />);

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
    const onChange = jest.fn(async () => SAVED);
    render(<MarketingAudienceControl offered audience="custodians" onChange={onChange} />);

    await act(async () => {
      choose('public');
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('public');
  });

  it('🔴 Ε3 — ακύρωση του στενέματος ⇒ ΚΑΜΙΑ γραφή', () => {
    const onChange = jest.fn(async () => SAVED);
    render(<MarketingAudienceControl offered audience="public" onChange={onChange} />);

    choose('custodians');
    fireEvent.click(screen.getByText('cancel'));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('🔴 Ε4 — αποτυχία ⇒ μήνυμα με λόγια, και η εμφανιζόμενη τιμή ΜΕΝΕΙ η αποθηκευμένη', async () => {
    const onChange = jest.fn(async () => FAILED);
    render(<MarketingAudienceControl offered audience="custodians" onChange={onChange} />);

    await act(async () => {
      choose('public');
    });

    await waitFor(() => expect(screen.getByText('property-market:audience.failed')).toBeInTheDocument());
    expect(screen.getByLabelText('audience')).toHaveValue('custodians');
  });

  it('🔴 Α21 — άρνηση ⇒ Ο ΛΟΓΟΣ φτάνει στην οθόνη, ΟΧΙ το γενικό «απέτυχε»', async () => {
    const refused: AudienceChangeOutcome = { kind: 'refused', reason: 'private-marketing-consent-missing' };
    render(<MarketingAudienceControl offered audience="public" onChange={jest.fn(async () => refused)} />);

    choose('custodians');
    await act(async () => {
      fireEvent.click(screen.getByText(CONFIRM));
    });

    await waitFor(() =>
      expect(
        screen.getByText('property-market:audience.refused.private-marketing-consent-missing'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('property-market:audience.failed')).not.toBeInTheDocument();
    expect(screen.getByLabelText('audience')).toHaveValue('public');
  });

  it('Ε5 — το `network` φαίνεται αλλά ΔΕΝ επιλέγεται (προϋποθέτει ADR-862)', () => {
    render(<MarketingAudienceControl offered audience="public" onChange={jest.fn(async () => SAVED)} />);

    const network = screen.getByText('properties-enums:marketingAudience.network');
    expect(network).toBeDisabled();
    expect(screen.getByText('properties-enums:marketingAudience.custodians')).not.toBeDisabled();
  });
});

/**
 * | **Ε6** (ADR-864 Ε-10 · ADR-329 §3.9) | ακίνητο που **δεν διατίθεται** ⇒ το κοινό λέγεται ως ρύθμιση που **θα ισχύσει**, όχι ως γεγονός | «εμφανίζεται στον δημόσιο χάρτη» για ακίνητο εκτός αγοράς |
 *
 * Μετρήθηκε ζωντανά 2026-10-07: ακίνητο με `commercialStatus: 'unavailable'` και **κανένα**
 * `public_listings` έγραφε «Η αγγελία εμφανίζεται στον δημόσιο χάρτη και στις αναζητήσεις».
 */
describe('Ε6 — το κοινό δεν παρουσιάζεται ως δημοσίευση όταν το ακίνητο δεν διατίθεται', () => {
  const SAVED_OUTCOME: AudienceChangeOutcome = { kind: 'saved' };
  const noop = jest.fn(async () => SAVED_OUTCOME);

  it('🔴 δεν διατίθεται ⇒ η μελλοντική διατύπωση, ΟΧΙ η παρούσα', () => {
    render(<MarketingAudienceControl offered={false} audience="public" onChange={noop} />);

    expect(screen.getByText('property-market:audience.describeWhenUnoffered.public')).toBeInTheDocument();
    expect(screen.queryByText('property-market:audience.describe.public')).not.toBeInTheDocument();
    expect(screen.getByText('property-market:audience.notOffered')).toBeInTheDocument();
  });

  it('διατίθεται ⇒ η παρούσα διατύπωση, χωρίς την ένδειξη «δεν διατίθεται»', () => {
    render(<MarketingAudienceControl offered audience="public" onChange={noop} />);

    expect(screen.getByText('property-market:audience.describe.public')).toBeInTheDocument();
    expect(screen.queryByText('property-market:audience.notOffered')).not.toBeInTheDocument();
  });

  it('δεν διατίθεται ⇒ η επιλογή κοινού ΜΕΝΕΙ ενεργή (ρύθμιση πριν από τη δημοσίευση)', () => {
    render(<MarketingAudienceControl offered={false} audience="custodians" onChange={noop} />);

    expect(screen.getByLabelText('audience')).not.toBeDisabled();
    expect(screen.getByText('property-market:audience.describeWhenUnoffered.custodians')).toBeInTheDocument();
  });
});
