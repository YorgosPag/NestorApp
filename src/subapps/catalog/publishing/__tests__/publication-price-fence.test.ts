/**
 * 🔒 ADR-923 §12 — καμία διαρροή τιμής μεταξύ κοινών στην έκδοση.
 */
import type { PriceAudience, PricingViewer } from '../../types/price-list';
import { publicationListMayServe, publicationVersionPrintable } from '../publication-price-fence';

const wholesale: PriceAudience = { kind: 'customerGroup', customerGroupId: 'wholesale' };
const anyone: PriceAudience = { kind: 'anonymous' };
const asRetail: PricingViewer = { kind: 'signedIn', customerGroupId: 'retail', party: null };
const asWholesale: PricingViewer = { kind: 'signedIn', customerGroupId: 'wholesale', party: null };

describe('publicationListMayServe', () => {
  it('🔒 λίστα χονδρικής ΔΕΝ τυπώνεται για λιανική', () => {
    expect(publicationListMayServe({ kind: 'sales', audience: wholesale }, asRetail)).toBe(false);
  });

  it('το δικό της κοινό περνά', () => {
    expect(publicationListMayServe({ kind: 'sales', audience: wholesale }, asWholesale)).toBe(true);
  });

  it('λίστα για όλους περνά για κάθε θεατή', () => {
    expect(publicationListMayServe({ kind: 'sales', audience: anyone }, { kind: 'anonymous' })).toBe(true);
  });

  it('🔒 εσωτερική λίστα κόστους δεν τυπώνεται ποτέ, ακόμη κι αν κάποτε αποκτήσει κοινό', () => {
    expect(publicationListMayServe({ kind: 'cost', audience: anyone }, asWholesale)).toBe(false);
    expect(publicationListMayServe({ kind: 'cost', audience: null }, asWholesale)).toBe(false);
  });

  it('λίστα χωρίς κοινό δεν προσφέρεται σε κανέναν', () => {
    expect(publicationListMayServe({ kind: 'sales', audience: null }, asWholesale)).toBe(false);
  });
});

describe('publicationVersionPrintable', () => {
  const seal = {};
  it.each([['published', true], ['superseded', true], ['draft', false], ['discarded', false]])('%s ⇒ %s', (status, expected) => {
    expect(publicationVersionPrintable({ status, validFrom: '2026-11-01T00:00:00.000Z', seal })).toBe(expected);
  });

  it('χωρίς ισχύ ή σφραγίδα δεν αποδεικνύεται', () => {
    expect(publicationVersionPrintable({ status: 'published', validFrom: null, seal })).toBe(false);
    expect(publicationVersionPrintable({ status: 'published', validFrom: '2026-11-01T00:00:00.000Z', seal: null })).toBe(false);
  });
});
