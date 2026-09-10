/**
 * Άγκυρα της ειδοποίησης απόκλισης — ADR-332 D27 Βήμα Β (Φ2β).
 *
 * 🔑 Η απόσταση **δεν** μορφοποιείται εδώ: περνά από τον **έναν** μορφοποιητή
 * (`formatGeoDistance`, κλίμακα Google Maps, Intl). Το test το ελέγχει με την **πραγματική**
 * έξοδό του — «4,6 χλμ.» στα ελληνικά — ώστε ένας δεύτερος μορφοποιητής εδώ να κοκκινίσει.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { distance?: string }) => (params?.distance ? `${key} ${params.distance}` : key),
    currentLanguage: 'el',
  }),
}));

import { AddressPositionDriftNotice } from '../AddressPositionDriftNotice';

function renderNotice(busy = false) {
  const onRelocate = jest.fn();
  const onKeep = jest.fn();
  render(<AddressPositionDriftNotice distanceMetres={4_600} busy={busy} onRelocate={onRelocate} onKeep={onKeep} />);
  return { onRelocate, onKeep };
}

describe('AddressPositionDriftNotice — πόσο απέχει η πινέζα, και τι αποφασίζει ο άνθρωπος', () => {
  it('η απόσταση έρχεται από τον ΕΝΑ μορφοποιητή (Intl, ελληνικά): «4,6»', () => {
    renderNotice();
    expect(screen.getByRole('status')).toHaveTextContent('editor.positionDrift.message');
    expect(screen.getByRole('status')).toHaveTextContent('4,6');
  });

  it('«Μετακίνησε» και «Κράτα» καλούν ΜΟΝΟ τον δικό τους χειριστή', () => {
    const { onRelocate, onKeep } = renderNotice();

    fireEvent.click(screen.getByText('editor.positionDrift.relocate'));
    expect(onRelocate).toHaveBeenCalledTimes(1);
    expect(onKeep).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('editor.positionDrift.keep'));
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('κατά την αποθήκευση τα κουμπιά ΠΑΓΩΝΟΥΝ — καμία διπλή δήλωση', () => {
    renderNotice(true);
    expect(screen.getByText('editor.positionDrift.relocate').closest('button')).toBeDisabled();
    expect(screen.getByText('editor.positionDrift.keep').closest('button')).toBeDisabled();
  });
});
