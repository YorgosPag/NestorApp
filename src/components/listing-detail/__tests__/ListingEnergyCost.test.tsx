/**
 * ADR-777 §8.95 — **η εκτίμηση ετήσιου κόστους ενέργειας στη δημόσια αγγελία**: ποσό μόνο όταν στέκει, και κάθε κενό
 * με το όνομά του.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import type { FinalEnergyLine } from '@/lib/energy-certificate/certificate-final-energy';
import { ENERGY_PRICE_SOURCES } from '@/lib/energy-cost/energy-reference-prices';
import type { EnergyCostSubject } from '@/lib/energy-cost/listing-energy-cost';

import { ListingEnergyCost } from '../ListingEnergyCost';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

/** Οι τιμές είναι του πραγματικού πίνακα· η «σήμερα» καρφώνεται ώστε το test να μη γεράσει μαζί του. */
jest.mock('@/lib/date-local', () => ({ ...jest.requireActual('@/lib/date-local'), todayLocalDate: () => '2026-10-13' }));

const L = 'listing-detail:energyCost';
const S = 'properties-enums:energyCertificate.source';
const LINES: readonly FinalEnergyLine[] = [
  { source: 'electricity', perSqm: 20 },
  { source: 'oil', perSqm: 80 },
];

function subject(over: Partial<EnergyCostSubject['energyCertificate'] & object> = {}, rest: Partial<EnergyCostSubject> = {}): EnergyCostSubject {
  return {
    energyClass: 'C',
    energyCertificate: { primaryEnergy: null, co2Emissions: null, usefulArea: 100, finalEnergy: LINES, scope: null, absence: null, ...over },
    commonCharges: null,
    ...rest,
  };
}

describe('Ο1 — πότε υπάρχει γραμμή', () => {
  it('🔴 χωρίς κλάση ή χωρίς κουτί ⇒ ΤΙΠΟΤΑ', () => {
    expect(render(<ListingEnergyCost listing={subject({}, { energyClass: null })} />).container).toBeEmptyDOMElement();
    expect(render(<ListingEnergyCost listing={subject({}, { energyCertificate: null })} />).container).toBeEmptyDOMElement();
  });

  it('🔴 χωρίς καταναλώσεις ⇒ τίτλος και ονομασμένο κενό — ΚΑΝΕΝΑ ποσό', () => {
    render(<ListingEnergyCost listing={subject({ finalEnergy: null })} />);
    expect(screen.getByRole('heading', { name: `${L}.heading` })).toBeInTheDocument();
    expect(screen.getByText(`${L}.undeclared`)).toBeInTheDocument();
    expect(screen.queryByText(/energyCost\.(range|single)/)).not.toBeInTheDocument();
  });

  it('🔴 πηγή χωρίς επίσημη τιμή ⇒ «δεν εκτιμάται», με το όνομα της πηγής', () => {
    render(<ListingEnergyCost listing={subject({ finalEnergy: [...LINES, { source: 'biomass', perSqm: 40 }] })} />);
    expect(screen.getByText(new RegExp(`${L.replace('.', '\\.')}\\.unpriced::.*${S.replace(/\./g, '\\.')}\\.biomass`))).toBeInTheDocument();
    expect(screen.queryByText(/energyCost\.(range|single)/)).not.toBeInTheDocument();
  });
});

describe('Ο2 — η εκτίμηση', () => {
  it('εύρος, οι καταναλώσεις ανά πηγή σε kWh τον χρόνο, και η περίοδος των τιμών', () => {
    render(<ListingEnergyCost listing={subject()} />);
    expect(screen.getByText(/energyCost\.range::/)).toBeInTheDocument();
    expect(screen.getByText(`${S}.electricity`)).toBeInTheDocument();
    expect(screen.getByText(`${S}.oil`)).toBeInTheDocument();
    expect(screen.getAllByText(/energyCost\.kwhPerYear::/)).toHaveLength(2);
    expect(screen.getByText(/energyCost\.basis::.*energyCost\.semester(First|Second)/)).toBeInTheDocument();
  });

  it('🔴 κάθε εκδότης τιμών έχει σύνδεσμο — η απόδοση της πηγής δεν είναι προαιρετική', () => {
    render(<ListingEnergyCost listing={subject()} />);
    for (const source of ENERGY_PRICE_SOURCES) {
      expect(screen.getByRole('link', { name: source.name })).toHaveAttribute('href', source.url);
    }
  });

  it('η σήμανση «τα κοινόχρηστα περιλαμβάνουν θέρμανση» μόνο όταν δηλώθηκε', () => {
    const { unmount } = render(<ListingEnergyCost listing={subject()} />);
    expect(screen.queryByText(`${L}.heatingInCommonCharges`)).not.toBeInTheDocument();
    unmount();
    render(<ListingEnergyCost listing={subject({}, { commonCharges: { monthlyAmount: 80, includes: ['heating'] } })} />);
    expect(screen.getByText(`${L}.heatingInCommonCharges`)).toBeInTheDocument();
  });
});
