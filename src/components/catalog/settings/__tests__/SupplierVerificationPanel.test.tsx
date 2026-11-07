/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { OwnSupplierReview } from '@/server/catalog/supplier-review.server';

import { SupplierVerificationPanel } from '../SupplierVerificationPanel';

const get = jest.fn();
const post = jest.fn();
const upload = jest.fn();

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (url: string) => get(url), post: (url: string, body: unknown) => post(url, body) },
}));
jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'user-1', displayName: 'Χρήστης' } }) }));
jest.mock('@/hooks/useCompanyId', () => ({ useCompanyId: () => ({ companyId: 'comp-a' }) }));
jest.mock('@/services/filesystem/file-mutation-gateway', () => ({ validateUploadAuth: async () => undefined }));
jest.mock('@/services/filesystem/upload-entity-file', () => ({
  uploadEntityFile: (input: unknown, file: File) => upload(input, file),
}));
jest.mock('../../shared/catalog-ui-hooks', () => ({ useCatalogText: () => ({ t: (key: string) => key }) }));

const REVIEW: OwnSupplierReview = {
  status: null,
  routeKind: 'submit-document',
  canRequest: true,
  identityIncomplete: false,
  reviewNote: null,
  verified: false,
  canPublish: false,
  published: false,
};
const PDF = new File(['%PDF'], 'bebaiosi.pdf', { type: 'application/pdf' });

const REACH = { published: 2, total: 2, lastPassAtMs: null, reasons: [] };

/** Ανά URL: δημοσιευμένη βιτρίνα ⇒ το πάνελ διαβάζει και την εμβέλεια (§5.13 Σ9) από το `supplier-showcase`. */
const shown = async (review: OwnSupplierReview) => {
  get.mockImplementation(async (url: string) => (url === '/api/catalog/supplier-showcase' ? { reach: REACH } : { review }));
  render(<SupplierVerificationPanel />);
  await screen.findByRole('heading', { name: 'supplierVerification.title' });
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  upload.mockReset();
});

describe('SupplierVerificationPanel', () => {
  it('χωρίς δικαίωμα ή με βλάβη δεν εμφανίζεται', async () => {
    get.mockRejectedValue(new Error('403'));
    const { container } = render(<SupplierVerificationPanel />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container.querySelector('section')).toBeNull();
  });

  it('ανεβάζει το έγγραφο δεμένο με τον χώρο και υποβάλλει το αρχείο', async () => {
    upload.mockResolvedValue({ fileId: 'file-1' });
    post.mockResolvedValue({ kind: 'done', status: 'pending-review' });
    await shown(REVIEW);
    fireEvent.change(screen.getByLabelText('supplierVerification.document'), { target: { files: [PDF] } });
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/catalog/supplier-verification', { evidenceFileId: 'file-1' }));
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ custody: { companyId: 'comp-a' }, entityType: 'supplier_verification', entityId: 'comp-a' }),
      PDF,
    );
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it('αποτυχία ⇒ μήνυμα', async () => {
    upload.mockRejectedValue(new Error('no'));
    await shown(REVIEW);
    fireEvent.change(screen.getByLabelText('supplierVerification.document'), { target: { files: [PDF] } });
    expect(await screen.findByText('supplierVerification.failed')).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it('χωρίς δυνατότητα αίτησης δεν υπάρχει πεδίο αρχείου', async () => {
    await shown({ ...REVIEW, status: 'approved', canRequest: false });
    expect(screen.queryByLabelText('supplierVerification.document')).toBeNull();
    expect(screen.getByText('supplierVerification.status.approved')).toBeTruthy();
  });

  it('🔑 εγκεκριμένος μέσω ελέγχου ⇒ καμία γραμμή «χρειάζεται έλεγχο» (ζωντανό εύρημα 2026-11-07)', async () => {
    await shown({ ...REVIEW, status: 'approved', routeKind: 'manual-review', canRequest: false, verified: true, published: true });
    expect(screen.getByText('supplierVerification.status.approved')).toBeTruthy();
    expect(screen.queryByText(/supplierVerification\.route\./)).toBeNull();
  });

  it('επιβεβαιωμένος από το μητρώο ⇒ το λέει', async () => {
    await shown({ ...REVIEW, routeKind: 'verified', canRequest: false, verified: true });
    expect(screen.getByText('supplierVerification.route.verified')).toBeTruthy();
  });

  it('🔒 εγκεκριμένος που δεν καλύπτεται πια ⇒ ο δρόμος ξαναφαίνεται', async () => {
    await shown({ ...REVIEW, status: 'approved', routeKind: 'manual-review', canRequest: true, verified: false });
    expect(screen.getByText('supplierVerification.route.manual-review')).toBeTruthy();
  });

  it('απόρριψη ⇒ δείχνει τη σημείωση', async () => {
    await shown({ ...REVIEW, status: 'rejected', reviewNote: 'θολό έγγραφο' });
    expect(screen.getByText('θολό έγγραφο')).toBeTruthy();
  });

  it('κλεισμένη εταιρεία ⇒ δεν υπόσχεται έλεγχο', async () => {
    await shown({ ...REVIEW, routeKind: 'manual-review', canRequest: false });
    expect(screen.getByText('supplierVerification.route.closed')).toBeTruthy();
  });

  it.each(['submit-document', 'manual-review'] as const)('🔑 ελλιπές προφίλ σε %s ⇒ δικό του κείμενο, όχι «κλειστή» ή «υποβάλετε»', async (routeKind) => {
    await shown({ ...REVIEW, routeKind, canRequest: false, identityIncomplete: true });
    expect(screen.getByText('supplierVerification.route.identity-incomplete')).toBeTruthy();
    expect(screen.queryByText('supplierVerification.route.closed')).toBeNull();
    expect(screen.queryByText(`supplierVerification.route.${routeKind}`)).toBeNull();
  });

  it('επιβεβαιωμένος ⇒ η δημοσίευση είναι ρητή πράξη', async () => {
    post.mockResolvedValue({ kind: 'published' });
    await shown({ ...REVIEW, status: 'approved', canRequest: false, canPublish: true });
    fireEvent.click(screen.getByRole('button', { name: 'supplierVerification.publish' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/catalog/supplier-showcase', {}));
  });

  it('χωρίς δυνατότητα δημοσίευσης δεν υπάρχει κουμπί', async () => {
    await shown(REVIEW);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('δημοσιευμένη βιτρίνα ⇒ το δηλώνει', async () => {
    await shown({ ...REVIEW, canRequest: false, published: true });
    expect(screen.getByText('supplierVerification.published')).toBeTruthy();
  });
});
