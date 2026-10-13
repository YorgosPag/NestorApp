/**
 * ADR-777 §8.95 — **τα πεδία ωφέλιμης επιφάνειας και τελικής ενέργειας**: ο πίνακας εκπέμπεται ολόκληρος, και μια
 * πηγή χωρίς αριθμό δεν είναι δήλωση.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import type { FinalEnergyLine } from '@/lib/energy-certificate/certificate-final-energy';
import type { EnergyCertificatePatch } from '@/lib/energy-certificate/energy-certificate';

import { FinalEnergyFields } from '../FinalEnergyFields';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

const F = 'properties-enums:energyCertificate.form';
const S = 'properties-enums:energyCertificate.source';
const LINES: readonly FinalEnergyLine[] = [
  { source: 'electricity', perSqm: 21.5 },
  { source: 'oil', perSqm: 96.3 },
];

function setup(value: { usefulArea: number | null; finalEnergy: readonly FinalEnergyLine[] | null }) {
  const onChange = jest.fn<void, [EnergyCertificatePatch]>();
  render(<FinalEnergyFields value={value} onChange={onChange} disabled={false} idPrefix="t" />);
  return onChange;
}

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, text: string) => {
  fireEvent.change(input(label), { target: { value: text } });
  fireEvent.blur(input(label));
};

describe('Φ1 — ωφέλιμη επιφάνεια', () => {
  it('εκπέμπεται στο blur, δέχεται κόμμα', () => {
    const onChange = setup({ usefulArea: null, finalEnergy: null });
    type(`${F}.usefulArea`, '84,6');
    expect(onChange).toHaveBeenCalledWith({ usefulArea: 84.6 });
  });

  it('🔴 μηδέν ή δύο δεκαδικά ⇒ άκυρο, ΤΙΠΟΤΑ δεν εκπέμπεται', () => {
    const onChange = setup({ usefulArea: null, finalEnergy: null });
    type(`${F}.usefulArea`, '0');
    type(`${F}.usefulArea`, '84.65');
    expect(onChange).not.toHaveBeenCalled();
    expect(input(`${F}.usefulArea`)).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Φ2 — οι γραμμές του πίνακα', () => {
  it('χωρίς δήλωση: καμία γραμμή — μόνο η προσθήκη πηγής', () => {
    setup({ usefulArea: null, finalEnergy: null });
    expect(screen.queryByLabelText(`${S}.electricity`)).not.toBeInTheDocument();
    expect(screen.getByText(`${F}.addSource`)).toBeInTheDocument();
  });

  it('κάθε δηλωμένη πηγή έχει τη γραμμή της, με τον αριθμό της', () => {
    setup({ usefulArea: 84.6, finalEnergy: LINES });
    expect(input(`${S}.electricity`).value).toBe('21.5');
    expect(input(`${S}.oil`).value).toBe('96.3');
    expect(screen.queryByLabelText(`${S}.biomass`)).not.toBeInTheDocument();
  });

  it('🔴 αλλαγή μιας γραμμής εκπέμπει ΟΛΟΝ τον πίνακα', () => {
    const onChange = setup({ usefulArea: 84.6, finalEnergy: LINES });
    type(`${S}.oil`, '88');
    expect(onChange).toHaveBeenCalledWith({
      finalEnergy: [
        { source: 'electricity', perSqm: 21.5 },
        { source: 'oil', perSqm: 88 },
      ],
    });
  });

  it('άδειασμα γραμμής τη βγάζει· άδειασμα της τελευταίας ⇒ `null` («δεν δηλώθηκε»)', () => {
    const onChange = setup({ usefulArea: 84.6, finalEnergy: LINES });
    type(`${S}.oil`, '');
    expect(onChange).toHaveBeenLastCalledWith({ finalEnergy: [{ source: 'electricity', perSqm: 21.5 }] });
  });

  it('η τελευταία γραμμή που αδειάζει ⇒ `null`', () => {
    const onChange = setup({ usefulArea: 84.6, finalEnergy: [LINES[0]] });
    type(`${S}.electricity`, '');
    expect(onChange).toHaveBeenLastCalledWith({ finalEnergy: null });
  });
});
