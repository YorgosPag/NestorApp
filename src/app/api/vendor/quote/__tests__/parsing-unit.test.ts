/**
 * ADR-923 §5.11 «3γ» 4β — η πύλη προμηθευτή γράφει **κωδικό** μονάδας, μέσα από τον ΕΝΑ κανόνα εισόδου (`toStoredUom`).
 * - Π1: γνωστή γραφή («τμχ», «τ.μ.») ⇒ κανονικός κωδικός.
 * - Π2: άγνωστη γραφή μένει **αυτούσια** (ποτέ σιωπηλή αντιστοίχιση)· κενή / μη-κείμενο ⇒ `DEFAULT_UOM`.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/server/vendor-portal/vendor-link-door', () => ({ vendorPortalError: jest.fn() }));
jest.mock('@/services/vendor-portal/admin-client-timestamp', () => ({ adminTimestampFromDateAsClient: jest.fn() }));

import { parseQuoteLines } from '../parsing';
import { DEFAULT_UOM } from '@/lib/uom/uom-registry';

const line = (unit: unknown) => ({ description: 'Πλακάκι', quantity: 2, unitPrice: 10, vatRate: 24, unit });

describe('parseQuoteLines — μονάδα', () => {
  it('Π1: γνωστή γραφή ⇒ κανονικός κωδικός', () => {
    expect(parseQuoteLines([line('τμχ'), line('τ.μ.')])?.map((l) => l.unit)).toEqual(['pcs', 'm2']);
  });

  it('Π2: άγνωστη αυτούσια · κενή ή μη-κείμενο ⇒ προεπιλογή', () => {
    expect(parseQuoteLines([line('καρότσι'), line('  '), line(7)])?.map((l) => l.unit))
      .toEqual(['καρότσι', DEFAULT_UOM, DEFAULT_UOM]);
  });
});
