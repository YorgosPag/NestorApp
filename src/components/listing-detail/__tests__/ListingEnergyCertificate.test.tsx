/**
 * ADR-777 §8.94 — **το ενεργειακό πιστοποιητικό στη δημόσια αγγελία**: πέντε καταστάσεις, καμία σιωπηλή, και η ισχύς
 * από το **ένα** κανάλι νομιμότητας.
 */

import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ENERGY_CLASSES } from '@/constants/energy-classes';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { LegalitySignal } from '@/lib/legality/legality-signal';
import type { PublicListing } from '@/types/public-listing';

import { ListingEnergyCertificate } from '../ListingEnergyCertificate';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

const L = 'listing-detail:energyCertificate';
const UNDECLARED_BOX = { primaryEnergy: null, co2Emissions: null, usefulArea: null, finalEnergy: null, scope: null, absence: null };

function energySignal(signal: Omit<LegalitySignal, 'kind'>): readonly LegalitySignal[] {
  return [{ ...signal, kind: 'energy-performance' } as LegalitySignal];
}

function show(over: Partial<PublicListing>) {
  return render(<ListingEnergyCertificate listing={listing({ energyCertificate: UNDECLARED_BOX, ...over })} />);
}

describe('Ε1 — πότε υπάρχει ενότητα', () => {
  it('🔴 κουτί `null` (γη · διάθεση που δεν σηκώνει ΠΕΑ) ⇒ ΤΙΠΟΤΑ — ούτε «δεν έχει δηλωθεί»', () => {
    const { container } = show({ energyCertificate: null, energyClass: null });
    expect(container).toBeEmptyDOMElement();
  });

  it('κουτί χωρίς κλάση ⇒ ενότητα με ονομασμένο κενό, ΧΩΡΙΣ κλίμακα', () => {
    show({ energyClass: null });
    expect(screen.getByRole('heading', { name: `${L}.heading` })).toBeInTheDocument();
    expect(screen.getByText(`${L}.undeclared`)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('Ε2 — χωρίς κλάση: ο λόγος, με όνομα', () => {
  it.each([
    ['pending', 'properties-enums:energyCertificate.absence.pending'],
    ['exempt', 'properties-enums:energyCertificate.absence.exempt'],
  ] as const)('`%s` ⇒ το λέει, και ΟΧΙ «δεν έχει δηλωθεί»', (absence, text) => {
    show({ energyClass: null, energyCertificate: { ...UNDECLARED_BOX, absence } });
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText(`${L}.undeclared`)).not.toBeInTheDocument();
  });
});

describe('Ε3 — με κλάση: η κλίμακα', () => {
  it('εννέα βαθμίδες, με τη σειρά του ΚΕΝΑΚ, και ΜΙΑ σημειωμένη', () => {
    show({ energyClass: 'B+' });

    const scale = screen.getByRole('list', { name: `${L}.scaleLabel` });
    const steps = within(scale).getAllByRole('listitem');
    expect(steps).toHaveLength(ENERGY_CLASSES.length);
    expect(steps.map((step) => step.getAttribute('aria-current'))).toEqual(
      ENERGY_CLASSES.map((energyClass) => (energyClass === 'B+' ? 'true' : null)),
    );
  });

  it('♿ η βαθμίδα του ακινήτου ΛΕΓΕΤΑΙ («αυτό το ακίνητο»), δεν χρωματίζεται μόνο', () => {
    show({ energyClass: 'G' });
    const current = screen.getByRole('list').querySelector('[aria-current="true"]');
    expect(current).toHaveTextContent('properties-enums:energyClass.g');
    expect(current).toHaveTextContent(`${L}.thisProperty`);
  });

  it('το γράμμα έρχεται από το λεξιλόγιο (Γ · Ζ · Η στα ελληνικά), όχι από την αποθηκευμένη τιμή', () => {
    show({ energyClass: 'C' });
    expect(screen.getByText('properties-enums:energyClass.c')).toBeInTheDocument();
    expect(screen.queryByText('C')).not.toBeInTheDocument();
  });
});

describe('Ε4 — με κλάση: οι αριθμοί', () => {
  it('και οι δύο με τη μονάδα τους, και η προέλευση', () => {
    show({ energyClass: 'B', energyCertificate: { ...UNDECLARED_BOX, primaryEnergy: 132.4, co2Emissions: 38.1 } });

    expect(screen.getByText(/primaryEnergyValue::/)).toHaveTextContent('132');
    expect(screen.getByText(/co2EmissionsValue::/)).toHaveTextContent('38');
    expect(screen.getByText(`${L}.provenance`)).toBeInTheDocument();
  });

  it('🔴 κλάση χωρίς αριθμούς ⇒ «δεν έχει δηλωθεί» για τον ΚΑΘΕΝΑ — ποτέ «0 kWh»', () => {
    show({ energyClass: 'B' });
    expect(screen.getAllByText(`${L}.figureUndeclared`)).toHaveLength(2);
    expect(screen.queryByText(/primaryEnergyValue::/)).not.toBeInTheDocument();
  });

  it('ένας δηλωμένος, ένας όχι ⇒ ο καθένας λέει το δικό του', () => {
    show({ energyClass: 'B', energyCertificate: { ...UNDECLARED_BOX, primaryEnergy: 0 } });
    expect(screen.getByText(/primaryEnergyValue::/)).toBeInTheDocument();
    expect(screen.getAllByText(`${L}.figureUndeclared`)).toHaveLength(1);
  });
});

describe('Ε5 — η ισχύς: το ΕΝΑ κανάλι νομιμότητας, καμία δεύτερη αλήθεια', () => {
  const AT = '2026-10-13T18:00:00.000Z';

  it.each([
    ['declared', { state: 'declared', tier: 'self-declared', value: 'B', assertedAt: AT }, `${L}.validity.valid`],
    ['expired', { state: 'expired', tier: 'self-declared', expiredAfter: '2022-01-10' }, `${L}.validity.expired`],
    ['expiry-unknown', { state: 'expiry-unknown', tier: 'self-declared' }, `${L}.validity.unknown`],
  ] as const)('`%s` ⇒ η γραμμή του', (_state, signal, text) => {
    show({ energyClass: 'B', legality: energySignal(signal) });
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('🔴 `undeclared` (παλιά κλάση που κανείς δεν ξαναδήλωσε) ⇒ ΚΑΜΙΑ γραμμή ισχύος — ούτε «ισχύει», ούτε «έληξε»', () => {
    show({ energyClass: 'B', legality: energySignal({ state: 'undeclared' }) });
    for (const key of ['valid', 'expired', 'unknown']) {
      expect(screen.queryByText(`${L}.validity.${key}`)).not.toBeInTheDocument();
    }
  });

  it('⛔ η ημέρα λήξης δεν γράφεται εδώ (τη λέει η ενότητα «Νομικά», μία φορά)', () => {
    const { container } = show({
      energyClass: 'B',
      legality: energySignal({ state: 'expired', tier: 'self-declared', expiredAfter: '2022-01-10' }),
    });
    expect(container).not.toHaveTextContent('2022');
  });
});
