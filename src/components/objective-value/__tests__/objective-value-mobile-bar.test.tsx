/**
 * ADR-947 (διάταξη) — **η κάτω μπάρα του ποσού** στο κινητό, πάνω στην αληθινή μηχανή.
 *
 * Τι αποδεικνύει: (1) με υπολογισμό ⇒ το ΙΔΙΟ ποσό με το αποτέλεσμα (`formatCurrency`) · (2) χωρίς υπολογισμό ⇒
 * «δεν υπολογίστηκε ακόμη», ποτέ ψεύτικο ποσό · (3) όταν φαίνεται το αποτέλεσμα ⇒ κρυφή (`invisible`, όχι αφαίρεση:
 * καμία μετατόπιση διάταξης) · (4) «Ανάλυση» ⇒ ζητά το αποτέλεσμα.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { formatCurrency } from '@/lib/intl-formatting';
import { computeObjectiveValue } from '@/lib/objective-value/compute-objective-value';
import { draftToInput, INITIAL_DRAFT, type ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';

import { ObjectiveValueMobileBar } from '../ObjectiveValueMobileBar';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string) => key;
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

const TODAY = '2026-11-20';

const COMPLETE: ObjectiveValueDraft = {
  ...INITIAL_DRAFT,
  zonePrice: 1200,
  levels: [{ floor: 1, area: 85 }],
  frontage: 'single',
  hasCentralHeating: false,
  hasElevator: true,
  commercialityFactor: 1,
  permitDate: '2010-01-01',
};

const computed = computeObjectiveValue(draftToInput(COMPLETE, TODAY));
const pending = computeObjectiveValue(draftToInput(INITIAL_DRAFT, TODAY));

function bar() {
  return screen.getByRole('complementary', { name: 'objective-value:result.barLabel' });
}

describe('ObjectiveValueMobileBar — ADR-947', () => {
  it('το εμπόδιο της άγκυρας: το πλήρες πρόχειρο ΒΓΑΖΕΙ ποσό και το κενό ΔΕΝ βγάζει', () => {
    expect(computed.kind).toBe('computed');
    expect(pending.kind).not.toBe('computed');
  });

  it('με υπολογισμό ⇒ το ΙΔΙΟ ποσό με το αποτέλεσμα', () => {
    if (computed.kind !== 'computed') throw new Error('το πρόχειρο έπαψε να βγάζει ποσό');
    render(<ObjectiveValueMobileBar result={computed} resultInView={false} onShowBreakdown={() => undefined} />);
    // Ακατέργαστο `textContent`: το `toHaveTextContent` κανονικοποιεί το αδιάσπαστο κενό του «72.675 €» μόνο στη μία πλευρά.
    expect(bar().textContent).toContain(formatCurrency(computed.value));
    expect(bar()).not.toHaveTextContent('objective-value:result.barPending');
  });

  it('χωρίς υπολογισμό ⇒ «δεν υπολογίστηκε ακόμη», κανένα ποσό', () => {
    render(<ObjectiveValueMobileBar result={pending} resultInView={false} onShowBreakdown={() => undefined} />);
    expect(bar()).toHaveTextContent('objective-value:result.barPending');
    expect(bar()).not.toHaveTextContent('€');
  });

  it('🔴 όταν φαίνεται το αποτέλεσμα ⇒ `invisible` (μένει στη ροή, καμία μετατόπιση)· αλλιώς ορατή', () => {
    const { container, rerender } = render(
      <ObjectiveValueMobileBar result={computed} resultInView={false} onShowBreakdown={() => undefined} />,
    );
    const aside = container.querySelector('aside');
    expect(aside).not.toHaveClass('invisible');
    rerender(<ObjectiveValueMobileBar result={computed} resultInView onShowBreakdown={() => undefined} />);
    expect(container.querySelector('aside')).toHaveClass('invisible');
  });

  it('«Ανάλυση» ⇒ ζητά το αποτέλεσμα, μία φορά', () => {
    const onShowBreakdown = jest.fn();
    render(<ObjectiveValueMobileBar result={computed} resultInView={false} onShowBreakdown={onShowBreakdown} />);
    fireEvent.click(screen.getByRole('button', { name: 'objective-value:result.showBreakdown' }));
    expect(onShowBreakdown).toHaveBeenCalledTimes(1);
  });
});
