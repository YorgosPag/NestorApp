/**
 * @jest-environment jsdom
 */

/**
 * ADR-923 §5.11 «3γ» 4γ — οι ετικέτες μονάδας του BOQ από το ΕΝΑ μητρώο μονάδων (`useUomLabel`, namespace `uom`), όχι από
 * δικό τους αντίγραφο (`tabs.measurements.units.*`, σβησμένο).
 * - Π1: γραμμή του πίνακα ⇒ **σύμβολο** (στενή στήλη).
 * - Π2: λίστα μονάδας του επεξεργαστή ⇒ **όνομα (σύμβολο)**, μόνο οι επιτρεπτές.
 * - Π3: παράγωγη τιμή μονάδας μιας σύνοψης ⇒ το σύμβολο φτάνει στο «€/μονάδα».
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));

import { installPointerEvents } from '@/test-utils/pointer-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { normalizeBOQItem } from '@/services/measurements/boq-document-normalize';
import { createInitialState } from '../useBOQEditorState';
import { QuantitiesFieldset } from '../BOQEditorFieldsets';
import { BOQDerivedCostFieldset } from '../BOQDerivedCostFieldset';
import { BOQFloorGroup } from '../BOQFloorGroup';

beforeAll(installPointerEvents);

const t = (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key);
const colors = { text: { muted: 'muted' } } as never;
const line = normalizeBOQItem('boq_1', { title: 'Επίχρισμα', unit: 'm2', estimatedQuantity: 20, categoryCode: 'OIK-4' });

describe('BOQ — ετικέτες μονάδας από το μητρώο', () => {
  it('Π1: γραμμή του πίνακα ⇒ σύμβολο', () => {
    render(
      <BOQFloorGroup items={[line]} derivedCosts={new Map()} categories={[]} onEdit={jest.fn()} onDelete={jest.fn()} onStatusChange={jest.fn()} t={t} />,
      { wrapper: TooltipProvider },
    );
    expect(screen.getByText('symbol.m2')).toBeTruthy();
  });

  it('Π2: λίστα μονάδας ⇒ «όνομα (σύμβολο)», μόνο οι επιτρεπτές', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <TooltipProvider>
        <QuantitiesFieldset
          form={createInitialState(line, 'OIK-4')}
          isEdit
          allowedUnits={['m2', 'lump']}
          grossQuantity={20}
          onUpdateField={jest.fn()}
          colors={colors}
          t={t}
        />
      </TooltipProvider>,
    );
    await user.click(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['name.m2 (symbol.m2)', 'name.lump (symbol.lump)']);  });

  it('Π3: παράγωγη τιμή μονάδας ⇒ το σύμβολο φτάνει στο μήνυμα', () => {
    const summary = normalizeBOQItem('boq_s', { title: 'Τοίχος', unit: 'm2', estimatedQuantity: 20, isGroupParent: true, groupRole: 'summary' });
    render(<BOQDerivedCostFieldset summary={summary} derived={{ layerCount: 1, totalCost: 300, unitRate: 15 }} layers={[]} colors={colors} t={t} />);
    expect(screen.getByText(/tabs\.measurements\.editor\.derived\.unitRateValue\|.*"unit":"symbol\.m2"/)).toBeTruthy();
  });
});
