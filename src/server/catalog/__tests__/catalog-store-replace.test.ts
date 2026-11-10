/**
 * ADR-923 §5.5.2 Β6 — η **αντικατάσταση** ορισμού είναι αντικατάσταση. Ζωντανό περιστατικό (σελ. 87, 2026-11-09): η «Επαναφορά στην
 * τιμή του PDF» άδειαζε τον κατάλογο διορθώσεων, ο γραφέας παρέλειπε το κλειδί `edits`, και το `{...current, ...patch}` του
 * `stageRevision` το ξανάγραφε ⇒ το επόμενο ξαναχτίσιμο θα ξανάφερνε τη διόρθωση. Εδώ κρίνεται ο **στοιβαχτής**, όχι η συναλλαγή.
 */
import type { AuthContext } from '@/lib/auth';
import { stageReplace, stageSoftDelete, type CatalogTx, type StoredCatalogRecord } from '../catalog-store.server';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: jest.fn() }));
jest.mock('@/subapps/catalog/views/catalog-view-key', () => ({ distinctCatalogViews: jest.fn(() => []), catalogViewsOfWrite: jest.fn(() => []) }));
jest.mock('@/subapps/catalog/public/public-scopes-of-write', () => ({ distinctPublicScopes: jest.fn(() => []), publicScopesOfWrite: jest.fn(() => []) }));
jest.mock('@/subapps/catalog/public/showcase-price-writes', () => ({ showcasePricesTouched: jest.fn(() => false) }));
jest.mock('../catalog-view-signal.server', () => ({ signalCatalogViewsInTx: jest.fn() }));
jest.mock('../public/public-drain-schedule.server', () => ({ schedulePublicDrain: jest.fn() }));
jest.mock('../public/public-model-revalidate.server', () => ({ revalidatePublicPrices: jest.fn() }));
jest.mock('../public/public-outbox.server', () => ({ signalPublicScopesInTx: jest.fn() }));

interface ProposalLike {
  readonly status: string;
  readonly edits?: readonly { readonly rowKey: string; readonly text: string }[];
  readonly modelCodeEdit?: { readonly modelCode: string };
}

const NOW = '2026-11-09T22:00:00.000Z';

function fakeScope() {
  const set = jest.fn();
  const scope = {
    db: { collection: (name: string) => ({ doc: (id: string) => `${name}/${id}` }) },
    tx: { set },
    ctx: { companyId: 'comp_a', uid: 'u_editor' } as unknown as AuthContext,
    now: NOW,
    changes: [],
    views: [],
    publicScopes: [],
  } as unknown as CatalogTx;
  return { scope, set };
}

const stored: StoredCatalogRecord<ProposalLike> = {
  status: 'pending',
  edits: [{ rowKey: 'p87t0v0', text: '345 m³/h' }],
  modelCodeEdit: { modelCode: 'MFP-34' },
  id: 'cipsl_1',
  companyId: 'comp_a',
  revision: 17,
  isDeleted: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  createdBy: 'u_creator',
  updatedAt: '2026-11-08T00:00:00.000Z',
  updatedBy: 'u_creator',
  deletedAt: null,
  deletedBy: null,
};

const written = (set: jest.Mock): Record<string, unknown> => set.mock.calls[0][1] as Record<string, unknown>;

describe('stageReplace — αντικατάσταση, όχι συγχώνευση', () => {
  it('πεδίο που λείπει από τον ορισμό ΣΒΗΝΕΤΑΙ (η «Επαναφορά» φτάνει στην αποθήκευση)', () => {
    const { scope, set } = fakeScope();
    const record = stageReplace(scope, 'importProposal', stored, { status: 'pending' });
    expect(written(set)).not.toHaveProperty('edits');
    expect(written(set)).not.toHaveProperty('modelCodeEdit');
    expect(record).not.toHaveProperty('edits');
  });

  it('το περίβλημα έρχεται από την αποθηκευμένη και κερδίζει ορισμό που κουβαλά ξένο περίβλημα', () => {
    const { scope, set } = fakeScope();
    const hostile = { status: 'pending', id: 'x', companyId: 'comp_b', createdBy: 'u_x', revision: 99 } as ProposalLike;
    stageReplace(scope, 'importProposal', stored, hostile);
    expect(written(set)).toMatchObject({ id: 'cipsl_1', companyId: 'comp_a', createdBy: 'u_creator', createdAt: stored.createdAt });
    expect(written(set)).toMatchObject({ revision: 18, updatedAt: NOW, updatedBy: 'u_editor' });
  });

  it('το ίχνος βλέπει το σβήσιμο: before με edits, after χωρίς', () => {
    const { scope } = fakeScope();
    stageReplace(scope, 'importProposal', stored, { status: 'pending' });
    expect(scope.changes[0].before).toHaveProperty('edits');
    expect(scope.changes[0].after).not.toHaveProperty('edits');
  });
});

describe('stageSoftDelete — ρητό patch περιβλήματος', () => {
  it('κρατά τον ορισμό ανέπαφο και σημαδεύει τη διαγραφή', () => {
    const { scope, set } = fakeScope();
    stageSoftDelete(scope, 'importProposal', stored);
    expect(written(set)).toMatchObject({ edits: stored.edits, modelCodeEdit: stored.modelCodeEdit, isDeleted: true, deletedAt: NOW, deletedBy: 'u_editor', revision: 18 });
  });
});
