/**
 * ADR-923 §5.15.3 — ο ΕΝΑΣ εκδότης άδειας ανάγνωσης για τις τρεις πόρτες. Λάθος εδώ = ανώνυμος που δεν διαβάζει ποτέ (401 πριν
 * φύγει το αίτημα), άδεια σε μνήμη του browser, ή ακυρωμένη ανάγνωση που παίρνει παρ' όλα αυτά άδεια.
 */
const get = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: (...args: unknown[]) => get(...args) } }));

import { catalogEditionLicenseIssuer } from '../catalog-editions-api.client';

const LICENSE = { url: 'https://storage.example/signed', expiresAt: 1_000 };

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue(LICENSE);
});

describe('catalogEditionLicenseIssuer', () => {
  it('η ανώνυμη πόρτα φεύγει ΧΩΡΙΣ ταυτότητα και χωρίς μνήμη', async () => {
    const issue = catalogEditionLicenseIssuer('/api/supplier-catalogs/s/editions/cedx_1/file', 'public');
    await expect(issue(new AbortController().signal)).resolves.toEqual(LICENSE);
    expect(get).toHaveBeenCalledWith('/api/supplier-catalogs/s/editions/cedx_1/file', { skipAuth: true, cache: 'no-store' });
  });

  it('οι πόρτες με σύνδεση κρατούν την ταυτότητα, πάντα χωρίς μνήμη', async () => {
    await catalogEditionLicenseIssuer('/api/catalog/editions/cedx_1/file', 'signedIn')(new AbortController().signal);
    expect(get).toHaveBeenCalledWith('/api/catalog/editions/cedx_1/file', { cache: 'no-store' });
  });

  it('🔒 ακυρωμένη πριν ⇒ κανένα αίτημα', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(catalogEditionLicenseIssuer('/x', 'public')(controller.signal)).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });

  it('🔒 ακυρωμένη στη διάρκεια ⇒ η άδεια ΔΕΝ παραδίδεται', async () => {
    const controller = new AbortController();
    get.mockImplementation(async () => {
      controller.abort();
      return LICENSE;
    });
    await expect(catalogEditionLicenseIssuer('/x', 'signedIn')(controller.signal)).rejects.toThrow();
  });
});
