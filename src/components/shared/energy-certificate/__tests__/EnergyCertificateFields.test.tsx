/**
 * ADR-777 §8.94 — **τα πεδία του ενεργειακού πιστοποιητικού**: η κλάση ανοίγει τα υπόλοιπα, οι αριθμοί εκπέμπονται
 * όταν ο άνθρωπος τελειώσει, και το «γιατί δεν έχω ΠΕΑ» ζητείται μόνο χωρίς κλάση.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import {
  UNDECLARED_ENERGY_CERTIFICATE,
  type EnergyCertificate,
  type EnergyCertificatePatch,
} from '@/lib/energy-certificate/energy-certificate';

import { EnergyCertificateFields } from '../EnergyCertificateFields';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

const F = 'properties-enums:energyCertificate.form';
const WITH_CLASS: EnergyCertificate = { ...UNDECLARED_ENERGY_CERTIFICATE, class: 'C' };

function setup(value: EnergyCertificate, disabled = false) {
  const onChange = jest.fn<void, [EnergyCertificatePatch]>();
  const view = render(<EnergyCertificateFields value={value} onChange={onChange} disabled={disabled} idPrefix="t" />);
  return { onChange, ...view };
}

const primary = () => screen.getByLabelText(`${F}.primaryEnergy`) as HTMLInputElement;
const co2 = () => screen.getByLabelText(`${F}.co2Emissions`) as HTMLInputElement;
const issued = () => screen.getByLabelText(`${F}.issuedOn`) as HTMLInputElement;
const box = (name: string) => screen.getByRole('checkbox', { name });

describe('Π1 — η κλάση ανοίγει τα υπόλοιπα', () => {
  it('χωρίς κλάση: ΚΑΝΕΝΑ πεδίο αριθμού ή ημερομηνίας — μόνο «αν δεν έχετε κλάση»', () => {
    setup(UNDECLARED_ENERGY_CERTIFICATE);
    expect(screen.queryByLabelText(`${F}.primaryEnergy`)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(`${F}.issuedOn`)).not.toBeInTheDocument();
    expect(screen.getByText(`${F}.absenceLegend`)).toBeInTheDocument();
  });

  it('με κλάση: αριθμοί και ημερομηνία — και ΟΧΙ «αν δεν έχετε κλάση»', () => {
    setup(WITH_CLASS);
    expect(primary()).toBeInTheDocument();
    expect(co2()).toBeInTheDocument();
    expect(issued()).toBeInTheDocument();
    expect(screen.queryByText(`${F}.absenceLegend`)).not.toBeInTheDocument();
  });
});

describe('Π2 — οι αριθμοί του πιστοποιητικού', () => {
  it('🔴 εκπέμπονται στο blur, ΟΧΙ σε κάθε πλήκτρο', () => {
    const { onChange } = setup(WITH_CLASS);

    fireEvent.change(primary(), { target: { value: '13' } });
    fireEvent.change(primary(), { target: { value: '132.4' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(primary());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ primaryEnergy: 132.4 });
  });

  it('🔴 το κόμμα είναι δεκαδικό — ο άνθρωπος αντιγράφει «38,1» από ελληνικό πιστοποιητικό', () => {
    const { onChange } = setup(WITH_CLASS);

    fireEvent.change(co2(), { target: { value: '38,1' } });
    fireEvent.blur(co2());

    expect(onChange).toHaveBeenCalledWith({ co2Emissions: 38.1 });
  });

  it('κενό πεδίο ⇒ «δεν δηλώθηκε» (`null`)· το μηδέν είναι αριθμός', () => {
    const { onChange } = setup({ ...WITH_CLASS, primaryEnergy: 132.4, co2Emissions: 38.1 });

    fireEvent.change(primary(), { target: { value: '' } });
    fireEvent.blur(primary());
    expect(onChange).toHaveBeenLastCalledWith({ primaryEnergy: null });

    fireEvent.change(co2(), { target: { value: '0' } });
    fireEvent.blur(co2());
    expect(onChange).toHaveBeenLastCalledWith({ co2Emissions: 0 });
  });

  it('ίδια τιμή ⇒ καμία εκπομπή', () => {
    const { onChange } = setup({ ...WITH_CLASS, primaryEnergy: 132.4 });
    fireEvent.blur(primary());
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(['12.34', '-3', 'abc', '2001', '1.234,5'])('άκυρο «%s» ⇒ μήνυμα, και ΤΙΠΟΤΑ δεν εκπέμπεται', (raw) => {
    const { onChange } = setup(WITH_CLASS);

    fireEvent.change(primary(), { target: { value: raw } });
    fireEvent.blur(primary());

    expect(onChange).not.toHaveBeenCalled();
    expect(primary()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(`${F}.figureInvalid`);
  });

  it('το κάθε πεδίο κρίνεται με το ΔΙΚΟ του όριο: 600 είναι κατανάλωση, όχι εκπομπές', () => {
    const { onChange } = setup(WITH_CLASS);

    fireEvent.change(primary(), { target: { value: '600' } });
    fireEvent.blur(primary());
    expect(onChange).toHaveBeenCalledWith({ primaryEnergy: 600 });

    fireEvent.change(co2(), { target: { value: '600' } });
    fireEvent.blur(co2());
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Π3 — η ημερομηνία έκδοσης', () => {
  it('ημέρα ⇒ `YYYY-MM-DD`· καθαρισμός ⇒ `null`', () => {
    const { onChange } = setup(WITH_CLASS);

    fireEvent.change(issued(), { target: { value: '2024-03-12' } });
    expect(onChange).toHaveBeenLastCalledWith({ issuedOn: '2024-03-12' });
  });

  it('καθαρισμός ⇒ `null`', () => {
    const { onChange } = setup({ ...WITH_CLASS, issuedOn: '2024-03-12' });

    fireEvent.change(issued(), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ issuedOn: null });
  });

  it('το μέλλον δεν προσφέρεται: πιστοποιητικό που δεν έχει εκδοθεί δεν έχει ημερομηνία έκδοσης', () => {
    setup(WITH_CLASS);
    expect(issued().max).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Π4 — «αν δεν έχετε κλάση να δηλώσετε»', () => {
  const PENDING = 'properties-enums:energyCertificate.absence.pending';
  const EXEMPT = 'properties-enums:energyCertificate.absence.exempt';

  it('μία απάντηση τη φορά· ξεπάτημα ⇒ `null` («δεν απαντήθηκε»)', () => {
    const { onChange, rerender } = setup(UNDECLARED_ENERGY_CERTIFICATE);

    fireEvent.click(box(PENDING));
    expect(onChange).toHaveBeenLastCalledWith({ absence: 'pending' });

    rerender(
      <EnergyCertificateFields
        value={{ ...UNDECLARED_ENERGY_CERTIFICATE, absence: 'pending' }}
        onChange={onChange}
        disabled={false}
        idPrefix="t"
      />,
    );
    expect(box(PENDING)).toBeChecked();
    expect(box(EXEMPT)).not.toBeChecked();

    fireEvent.click(box(EXEMPT));
    expect(onChange).toHaveBeenLastCalledWith({ absence: 'exempt' });

    fireEvent.click(box(PENDING));
    expect(onChange).toHaveBeenLastCalledWith({ absence: null });
  });
});

describe('Π5 — κλειδωμένη φόρμα', () => {
  it('τίποτα δεν δέχεται είσοδο', () => {
    setup({ ...WITH_CLASS, primaryEnergy: 132.4 }, true);
    expect(primary()).toBeDisabled();
    expect(co2()).toBeDisabled();
    expect(issued()).toBeDisabled();
  });
});
