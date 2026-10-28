/**
 * ΑΓΚΥΡΑ — **η περιγραφή γραμμής έχει ΔΙΚΗ ΤΗΣ σειρά σε όλο το πλάτος** (ADR-327 §8.5.4, 2026-10-29).
 *
 * Μετρημένο ζωντανά (QT-0004, 2026-10-28): σε μία σειρά, οι σταθερές αριθμητικές στήλες άφηναν στην περιγραφή ~69px
 * («Θερμ», «Κόλλ») — και σε οθόνη 2400px. Το jsdom δεν έχει διάταξη, άρα εδώ κρίνεται η **δομή** που κάνει το στρίμωγμα
 * αδύνατο: η περιγραφή δεν μοιράζεται σειρά με αριθμό, καλύπτει **όλες** τις αριθμητικές στήλες, και αναδιπλώνεται
 * (πολυγραμμικό πεδίο, όχι `<input>` μίας γραμμής). Το πλάτος μετριέται ζωντανά.
 */

import { render, screen } from '@testing-library/react';

import { QuoteLineEditorTable } from '../QuoteLineEditorTable';
import type { ExtractedQuoteLine, QuoteLine } from '@/subapps/procurement/types/quote';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/shared/UomSelect', () => ({ UomSelect: () => <select aria-label="quotes.unit" /> }));
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

const LONG = 'Θερμοπρόσοψη με πλάκες EPS 10cm, κόλλα, βύσματα, οπλισμός και τελικό επίχρισμα';
const line = { id: 'ln_1', description: LONG, quantity: 2, unit: 'm2', unitPrice: 3.37, lineTotal: 6.74 } as QuoteLine;
const field = <T,>(value: T) => ({ value, confidence: 90 });
const extracted = [{
  description: field(LONG), quantity: field(2), unitPrice: field(3.37), parentRowNumber: '1',
}] as unknown as ExtractedQuoteLine[];

function renderTable(withConfidence: boolean) {
  render(
    <QuoteLineEditorTable
      lines={[line]}
      extractedLineItems={withConfidence ? extracted : undefined}
      onChange={jest.fn()}
      onValidationChange={jest.fn()}
    />,
  );
}

describe('QuoteLineEditorTable — η περιγραφή δεν στριμώχνεται', () => {
  it.each([true, false])('Σ1 — δική της σειρά, καλύπτει ΟΛΕΣ τις αριθμητικές στήλες (αξιοπιστία: %s)', (withConfidence) => {
    renderTable(withConfidence);

    const description = screen.getByRole('textbox', { name: 'quotes.lineDescription' });
    const cell = description.closest('td') as HTMLTableCellElement;
    const figures = screen.getByRole('textbox', { name: 'quotes.quantity' }).closest('tr') as HTMLTableRowElement;

    expect(description.tagName).toBe('TEXTAREA');
    expect(cell.parentElement).not.toBe(figures);
    expect(cell.colSpan).toBe(figures.cells.length);
  });

  it('Σ2 — η επικεφαλίδα «Περιγραφή» καλύπτει τις ίδιες στήλες με το κελί της', () => {
    renderTable(true);

    const header = screen.getByRole('columnheader', { name: 'quotes.lineDescription' }) as HTMLTableCellElement;
    const cell = screen.getByRole('textbox', { name: 'quotes.lineDescription' }).closest('td') as HTMLTableCellElement;

    expect(header.colSpan).toBe(cell.colSpan);
  });
});
