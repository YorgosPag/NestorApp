/**
 * ADR-777 §8.93 — **τα πεδία των κοινοχρήστων**: τρεις καταστάσεις ορατές, το ποσό εκπέμπεται όταν ο άνθρωπος
 * τελειώσει, και «τι περιλαμβάνουν» μόνο δίπλα σε θετικό ποσό.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import type { CommonCharges, CommonChargesPatch } from '@/lib/common-charges/common-charges';

import { CommonChargesFields } from '../CommonChargesFields';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

const UNDECLARED: CommonCharges = { monthlyAmount: null, includes: null };

function setup(value: CommonCharges, disabled = false) {
  const onChange = jest.fn<void, [CommonChargesPatch]>();
  const view = render(<CommonChargesFields value={value} onChange={onChange} disabled={disabled} idPrefix="t" />);
  return { onChange, ...view };
}

const amountInput = () => screen.getByLabelText('properties-enums:commonCharges.form.amount') as HTMLInputElement;
const box = (name: string) => screen.getByRole('checkbox', { name });

describe('Π1 — το ποσό', () => {
  it('🔴 εκπέμπεται στο blur, ΟΧΙ σε κάθε πλήκτρο («12» καθ’ οδόν προς «120» δεν είναι απάντηση)', () => {
    const { onChange } = setup(UNDECLARED);

    fireEvent.change(amountInput(), { target: { value: '12' } });
    fireEvent.change(amountInput(), { target: { value: '120' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(amountInput());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ monthlyAmount: 120 });
  });

  it('κενό πεδίο ⇒ «δεν δηλώθηκε» (`null`), ποτέ `0`', () => {
    const { onChange } = setup({ monthlyAmount: 120, includes: null });

    fireEvent.change(amountInput(), { target: { value: '' } });
    fireEvent.blur(amountInput());

    expect(onChange).toHaveBeenCalledWith({ monthlyAmount: null });
  });

  it('ίδια τιμή ⇒ καμία εκπομπή', () => {
    const { onChange } = setup({ monthlyAmount: 120, includes: null });
    fireEvent.blur(amountInput());
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(['12,5', '-3', 'abc', '5001'])('άκυρο «%s» ⇒ μήνυμα, και ΤΙΠΟΤΑ δεν εκπέμπεται', (raw) => {
    const { onChange } = setup(UNDECLARED);

    fireEvent.change(amountInput(), { target: { value: raw } });
    fireEvent.blur(amountInput());

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('properties-enums:commonCharges.form.amountInvalid');
    expect(amountInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('η αλήθεια αλλάζει απ’ έξω ⇒ το πεδίο την ακολουθεί', () => {
    const { rerender } = setup(UNDECLARED);
    rerender(<CommonChargesFields value={{ monthlyAmount: 85, includes: null }} onChange={jest.fn()} disabled={false} idPrefix="t" />);
    expect(amountInput().value).toBe('85');
  });
});

describe('Π2 — «χωρίς κοινόχρηστα» είναι το `0`, και λέγεται με κουτάκι', () => {
  it('τσεκάρισμα ⇒ `0` · ξετσεκάρισμα ⇒ «δεν δηλώθηκε»', () => {
    const first = setup(UNDECLARED);
    fireEvent.click(box('properties-enums:commonCharges.form.none'));
    expect(first.onChange).toHaveBeenCalledWith({ monthlyAmount: 0 });
    first.unmount();

    const second = setup({ monthlyAmount: 0, includes: null });
    expect(box('properties-enums:commonCharges.form.none')).toBeChecked();
    fireEvent.click(box('properties-enums:commonCharges.form.none'));
    expect(second.onChange).toHaveBeenCalledWith({ monthlyAmount: null });
  });

  it('με `0` το πεδίο ποσού είναι κενό και ανενεργό — ποτέ «0» γραμμένο', () => {
    setup({ monthlyAmount: 0, includes: null });
    expect(amountInput().value).toBe('');
    expect(amountInput()).toBeDisabled();
  });
});

describe('Π3 — «τι περιλαμβάνουν»', () => {
  it('🔴 χωρίς θετικό ποσό η ερώτηση ΔΕΝ υπάρχει (ποτέ ορφανός προσδιοριστής)', () => {
    const undeclared = setup(UNDECLARED);
    expect(screen.queryByText('properties-enums:commonCharges.form.includesLegend')).not.toBeInTheDocument();
    undeclared.unmount();

    setup({ monthlyAmount: 0, includes: null });
    expect(screen.queryByText('properties-enums:commonCharges.form.includesLegend')).not.toBeInTheDocument();
  });

  it('πρώτη παροχή ⇒ σύνολο με αυτήν· δεύτερη ⇒ στη σειρά του ΚΑΤΑΛΟΓΟΥ', () => {
    const first = setup({ monthlyAmount: 120, includes: null });
    fireEvent.click(box('properties-enums:commonCharges.inclusion.elevator'));
    expect(first.onChange).toHaveBeenCalledWith({ includes: ['elevator'] });
    first.unmount();

    const second = setup({ monthlyAmount: 120, includes: ['elevator'] });
    fireEvent.click(box('properties-enums:commonCharges.inclusion.heating'));
    expect(second.onChange).toHaveBeenCalledWith({ includes: ['heating', 'elevator'] });
  });

  it('αφαίρεση της τελευταίας ⇒ πίσω στο «δεν ρωτήθηκε» (`null`), ΟΧΙ στο «τίποτα» (`[]`)', () => {
    const { onChange } = setup({ monthlyAmount: 120, includes: ['heating'] });
    fireEvent.click(box('properties-enums:commonCharges.inclusion.heating'));
    expect(onChange).toHaveBeenCalledWith({ includes: null });
  });

  it('«τίποτα από αυτά» λέγεται ΡΗΤΑ: τσεκάρισμα ⇒ `[]` · ξετσεκάρισμα ⇒ `null`', () => {
    const first = setup({ monthlyAmount: 120, includes: null });
    expect(box('properties-enums:commonCharges.form.includesNothing')).not.toBeChecked();
    fireEvent.click(box('properties-enums:commonCharges.form.includesNothing'));
    expect(first.onChange).toHaveBeenCalledWith({ includes: [] });
    first.unmount();

    const second = setup({ monthlyAmount: 120, includes: [] });
    expect(box('properties-enums:commonCharges.form.includesNothing')).toBeChecked();
    fireEvent.click(box('properties-enums:commonCharges.form.includesNothing'));
    expect(second.onChange).toHaveBeenCalledWith({ includes: null });
  });
});

describe('Π4 — ανενεργό', () => {
  it('κανένα στοιχείο δεν δέχεται αλλαγή', () => {
    setup({ monthlyAmount: 120, includes: ['heating'] }, true);
    expect(amountInput()).toBeDisabled();
    for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).toBeDisabled();
  });
});
