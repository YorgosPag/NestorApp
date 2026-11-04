/**
 * ADR-923 κύμα 3 Λ5β — η σελίδα συμβατότητας `/procurement/purchase-orders/[id]`.
 *
 * Διάβαζε την PO χωρίς εταιρεία και ανακατεύθυνε σε `/projects/<projectId>/…` ακόμη και για ξένη PO:
 * το `projectId` ξένης εταιρείας έβγαινε στη διεύθυνση. Εδώ τρέχει ο ΑΛΗΘΙΝΟΣ φράχτης (`findOwnedPO`)
 * πάνω σε ψεύτικη ανάγνωση βάσης· ψεύτικα είναι μόνο η ταυτότητα σελίδας και η πλοήγηση.
 */

jest.mock('server-only', () => ({}));

class NotFoundSignal extends Error {}
class RedirectSignal extends Error {
  constructor(readonly href: string) {
    super(href);
  }
}

jest.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFoundSignal('NEXT_NOT_FOUND');
  },
}));
jest.mock('@/lib/workspace/server-navigation', () => ({
  redirect: (href: string) => {
    throw new RedirectSignal(href);
  },
}));
jest.mock('@/lib/navigation/procurement-urls', () => ({
  getPoDetailUrl: (projectId: string, poId: string) => `/projects/${projectId}/procurement/${poId}`,
}));

var identity: unknown;
jest.mock('@/server/auth/page-identity', () => ({
  readPageIdentity: async () => identity,
}));

var getPurchaseOrder = jest.fn();
jest.mock('@/services/procurement/procurement-repository', () => ({
  getPurchaseOrder: (...a: unknown[]) => getPurchaseOrder(...a),
}));
jest.mock('@/services/procurement', () => ({
  findOwnedPO: jest.requireActual<typeof import('@/services/procurement/po-tenant-scope')>(
    '@/services/procurement/po-tenant-scope',
  ).findOwnedPO,
}));

import PurchaseOrderRedirect from '../page';

const ORG_IDENTITY = {
  ok: true,
  scope: 'organization',
  ctx: { uid: 'u1', email: 'a@b.gr', companyId: 'comp_1', globalRole: 'company_admin', isAuthenticated: true },
};

function visit(): Promise<unknown> {
  return PurchaseOrderRedirect({ params: Promise.resolve({ workspace: 'acme', id: 'po_1' }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  identity = ORG_IDENTITY;
});

describe('PO deep link — ξένη PO δεν αποκαλύπτει το έργο της', () => {
  it('own PO → redirect to its project-scoped page (positive control)', async () => {
    getPurchaseOrder.mockResolvedValue({ id: 'po_1', companyId: 'comp_1', projectId: 'proj_own' });
    await expect(visit()).rejects.toEqual(new RedirectSignal('/projects/proj_own/procurement/po_1'));
  });

  it('foreign PO → notFound(), no redirect, projectId never leaves', async () => {
    getPurchaseOrder.mockResolvedValue({ id: 'po_1', companyId: 'comp_other', projectId: 'proj_secret' });
    const outcome = await visit().catch((signal: unknown) => signal);
    expect(outcome).toBeInstanceOf(NotFoundSignal);
    expect(String((outcome as Error).message)).not.toContain('proj_secret');
  });

  it('missing PO → the same notFound()', async () => {
    getPurchaseOrder.mockResolvedValue(null);
    await expect(visit()).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it.each([
    ['no session', { ok: false, reason: 'no-session' }],
    ['personal identity (no company)', { ok: true, scope: 'personal', ctx: { uid: 'u1', globalRole: 'user' } }],
  ])('%s → notFound() without reading the PO', async (_label, value) => {
    identity = value;
    await expect(visit()).rejects.toBeInstanceOf(NotFoundSignal);
    expect(getPurchaseOrder).not.toHaveBeenCalled();
  });
});
