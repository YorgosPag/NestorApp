/**
 * Ο συντελεστής ΦΠΑ που ισχύει σε μια κατηγορία (ADR-923 §5.13 Ε3): δικός της, αλλιώς του **πλησιέστερου** προγόνου που δηλώνει.
 */

import type { GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import { categoryVatSource } from '../category-vat';

type Holder = { readonly id: string; readonly vatRate?: GreekVatRatePercent | null };

const byId = new Map<string, Holder>([
  ['root', { id: 'root', vatRate: 24 }],
  ['food', { id: 'food', vatRate: 13 }],
  ['silent', { id: 'silent', vatRate: null }],
  ['legacy', { id: 'legacy' }],
]);

describe('categoryVatSource', () => {
  it('δικός της ⇒ αυτός, ακόμη κι αν ο πρόγονος δηλώνει άλλον', () => {
    expect(categoryVatSource(6, ['root', 'food'], byId)).toEqual({ kind: 'own', rate: 6 });
  });

  it('κληρονομείται ⇒ ο πλησιέστερος πρόγονος που δηλώνει, με την πηγή του · σιωπηλοί και παλιοί πρόγονοι παραλείπονται', () => {
    expect(categoryVatSource(null, ['root', 'food', 'silent', 'legacy'], byId)).toEqual({ kind: 'inherited', rate: 13, fromCategoryId: 'food' });
    expect(categoryVatSource(null, ['root', 'silent'], byId)).toEqual({ kind: 'inherited', rate: 24, fromCategoryId: 'root' });
  });

  it('κανένας στη διαδρομή, ή πρόγονος που λείπει ⇒ none', () => {
    expect(categoryVatSource(null, ['silent', 'gone'], byId)).toEqual({ kind: 'none' });
    expect(categoryVatSource(null, [], byId)).toEqual({ kind: 'none' });
  });
});
