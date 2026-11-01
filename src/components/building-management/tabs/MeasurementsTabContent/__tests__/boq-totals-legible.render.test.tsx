/**
 * @jest-environment jsdom
 */

/**
 * ADR-923 §5.12 — τα «Υπολογιζόμενα Σύνολα» διαβάζονται, με το ίδιο χρώμα ανά είδος κόστους που έχουν οι κάρτες σύνοψης.
 * Ζωντανό σύμπτωμα: «Υλικά» και «Σύνολο» σκούρο σε σκούρο, ενώ Εργασία και Εξοπλισμός φαίνονταν (CHECK 3.38).
 */

import { render } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));
jest.mock('../BOQPriceSourceField', () => ({ BOQPriceSourceField: () => null }));

import { TooltipProvider } from '@/components/ui/tooltip';
import type { BOQItem } from '@/types/boq';
import { BOQ_COST_ACCENTS } from '../boq-cost-accents';
import { TotalsFieldset, type FieldsetCommon } from '../BOQEditorFieldsets';
import { BOQSummaryCards } from '../BOQSummaryCards';

const COMMON: FieldsetCommon = {
  colors: { text: { muted: 'text-muted-foreground' } } as unknown as FieldsetCommon['colors'],
  t: (key) => key,
};

const ORDER = ['material', 'labor', 'equipment', 'total'] as const;

const LINE = {
  id: 'boq_1', estimatedQuantity: 1, wasteFactor: 0, materialUnitCost: 1000, laborUnitCost: 200, equipmentUnitCost: 30,
} as unknown as BOQItem;

/** Τα ποσά, με τη σειρά που τα δείχνουν και οι δύο επιφάνειες. */
const expectAccents = (container: HTMLElement) => {
  const amounts = Array.from(container.querySelectorAll('.tabular-nums'));
  expect(amounts).toHaveLength(ORDER.length);
  ORDER.forEach((key, index) => expect(amounts[index].className).toContain(BOQ_COST_ACCENTS[key]));
};

describe('BOQ — ποσά που διαβάζονται', () => {
  it('το σύνολο της φόρμας δεν ζωγραφίζεται με χρώμα επιφάνειας', () => {
    const { container } = render(
      <TotalsFieldset grossQuantity={1} materialCost={1000} laborCost={200} equipmentCost={30} totalCost={1230} {...COMMON} />,
      { wrapper: TooltipProvider },
    );
    expectAccents(container);
    const icons = Array.from(container.querySelectorAll('svg.shrink-0'));
    expect(icons).toHaveLength(ORDER.length);
    ORDER.forEach((key, index) => expect(icons[index].getAttribute('class')).toContain(BOQ_COST_ACCENTS[key]));
  });

  it('οι κάρτες σύνοψης παίρνουν τα ίδια χρώματα', () => {
    const { container } = render(<BOQSummaryCards items={[LINE]} />);
    expectAccents(container);
  });
});
