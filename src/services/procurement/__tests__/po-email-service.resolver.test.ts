/**
 * Tests for PO email service — L2 resolver integration (ADR-326 Phase 6.1)
 */

import { resolveSupplierAccountingEmail } from '../po-email-service';

jest.mock('@/services/org-structure/org-routing-resolver', () => ({
  resolveContactDepartmentEmail: jest.fn(),
}));

const { resolveContactDepartmentEmail } = jest.requireMock(
  '@/services/org-structure/org-routing-resolver',
) as { resolveContactDepartmentEmail: jest.Mock };

describe('resolveSupplierAccountingEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns email when resolver finds accounting dept', async () => {
    resolveContactDepartmentEmail.mockResolvedValue({
      email: 'accounting@supplier.com',
      source: 'head',
      departmentCode: 'accounting',
    });

    const result = await resolveSupplierAccountingEmail('contact_123');
    expect(result).toBe('accounting@supplier.com');
    expect(resolveContactDepartmentEmail).toHaveBeenCalledWith('contact_123', 'accounting');
  });

  it('returns null when resolver finds no accounting dept', async () => {
    resolveContactDepartmentEmail.mockResolvedValue(null);

    const result = await resolveSupplierAccountingEmail('contact_123');
    expect(result).toBeNull();
  });

  it('returns null when resolver throws', async () => {
    resolveContactDepartmentEmail.mockRejectedValue(new Error('Firestore unavailable'));

    await expect(resolveSupplierAccountingEmail('contact_123')).rejects.toThrow();
  });
});
