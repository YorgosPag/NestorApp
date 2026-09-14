/**
 * @fileoverview Άγκυρες του κοινού πλαισίου επιβεβαίωσης τόπου (ADR-332 D28).
 * @related components/geo/ResolvedPlaceConfirmation · hooks/geo/usePlaceResolver
 *
 * 🔑 Φυλάνε **τι λέγεται** στον άνθρωπο, όχι πώς φαίνεται: η διεύθυνση του παρόχου, η γραμμή
 * χαλάρωσης με τη **σωστή** από τις δύο προτάσεις, και η **σιωπή** όπου δεν υπάρχει κενό να εξηγηθεί.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => (params ? `${key} ${JSON.stringify(params)}` : key),
    currentLanguage: 'el',
  }),
}));

import { ResolvedPlaceConfirmation } from '../ResolvedPlaceConfirmation';
import type { ResolvedPlace } from '@/hooks/geo/usePlaceResolver';

const K = 'property-market:offer.form';

const BASE: ResolvedPlace = {
  lat: 40.6643092,
  lng: 22.8976016,
  accuracy: 'interpolated',
  label: 'Σαμοθράκης, Ελευθέριο-Κορδελιό',
  houseNumber: 'absent',
};

function text(): string {
  return screen.getByRole('status').textContent ?? '';
}

describe('ResolvedPlaceConfirmation — τι κατάλαβε ο πάροχος', () => {
  it('λέει τη διεύθυνση του παρόχου και τον βαθμό ακρίβειας', () => {
    render(<ResolvedPlaceConfirmation place={BASE} />);
    expect(text()).toContain('Σαμοθράκης, Ελευθέριο-Κορδελιό');
    expect(text()).toContain(`${K}.placeAccuracyNote.interpolated`);
    expect(text()).toContain(`${K}.placeRefine`);
  });

  it('🔑 χαλάρωση με ευρύτερη περιοχή ⇒ η ΗΠΙΑ πρόταση, με Τ.Κ. και περιοχή', () => {
    render(
      <ResolvedPlaceConfirmation
        place={{
          ...BASE,
          relaxation: { dropped: ['city'], anchor: 'postalCode' },
          localityMatch: 'broader',
          declaredLocality: 'Θεσσαλονίκη',
          declaredPostalCode: '56334',
        }}
      />,
    );
    expect(text()).toContain(`${K}.placeRelaxed.broader`);
    expect(text()).toContain('56334');
    expect(text()).toContain('Θεσσαλονίκη');
    expect(text()).not.toContain('placeRelaxed.dropped');
  });

  it('🔴 χαλάρωση με περιοχή που ΑΝΤΙΦΑΣΚΕΙ ⇒ η πρόταση που ζητά έλεγχο', () => {
    render(
      <ResolvedPlaceConfirmation
        place={{ ...BASE, relaxation: { dropped: ['city'], anchor: 'postalCode' }, localityMatch: 'mismatch' }}
      />,
    );
    expect(text()).toContain(`${K}.placeRelaxed.dropped`);
  });

  it('χωρίς χαλάρωση ⇒ καμία γραμμή περιοχής (ακόμη κι αν η περιοχή είναι ευρύτερη)', () => {
    render(<ResolvedPlaceConfirmation place={{ ...BASE, localityMatch: 'broader' }} />);
    expect(text()).not.toContain('placeRelaxed');
  });

  it('στάση αριθμού: ανεπιβεβαίωτος και αντιφατικός λέγονται· επιβεβαιωμένος σιωπά', () => {
    const { unmount } = render(<ResolvedPlaceConfirmation place={{ ...BASE, houseNumber: 'unconfirmed', declaredNumber: '16' }} />);
    expect(text()).toContain(`${K}.placeHouseNumber.unconfirmed`);
    unmount();

    const second = render(
      <ResolvedPlaceConfirmation place={{ ...BASE, houseNumber: 'contradicted', declaredNumber: '16', resolvedNumber: '18' }} />,
    );
    expect(text()).toContain(`${K}.placeHouseNumber.contradicted`);
    second.unmount();

    render(<ResolvedPlaceConfirmation place={{ ...BASE, accuracy: 'exact', houseNumber: 'confirmed' }} />);
    expect(text()).not.toContain('placeHouseNumber');
    expect(text()).not.toContain('placeRefine');
  });
});
