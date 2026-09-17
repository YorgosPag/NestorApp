/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ Α33** — «εκδόσεις παντού, φάσεις μόνο όπου υπάρχουν μέλη» (ADR-862 §5.3.7).
 * @related services/iso19650/container-regime-policy · services/iso19650/container-custody ·
 *   services/iso19650/container-transitions · services/iso19650/version-stack · lib/files/file-record-read
 * @module services/iso19650/__tests__/container-regime-anchor
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ΤΙ ΚΛΕΙΔΩΝΕΙ
 * ════════════════════════════════════════════════════════════════════════════
 *   Α33.1  νέα έκδοση σε δοχείο ΕΚΤΟΣ έργου ⇒ αρχειοθέτηση + δεσμός, **κανένα** `cde*`, και ο
 *          **πραγματικός** αναγνώστης λέει `pre-cde` — όχι `SUPERSEDED` που κανείς δεν θα έβλεπε
 *   Α33.2  η στοίβα εκδόσεων βρίσκει και τις δύο εκδόσεις (ο δεσμός αρκεί, χωρίς φάση)
 *   Α33.3  share · seal · withdraw εκτός έργου ⇒ `no-project`, **μηδέν** γραφές
 *   Α33.4  δηλωμένο έργο ⇒ SUPERSEDED όπως πριν (οι φάσεις δεν χάθηκαν)
 *   Α33.5  έργο **παραγόμενο** (ακίνητο → κτίριο → έργο) ⇒ φάσεις + σφράγιση `projectId`
 *   Α33.6  δεύτερη κλήση ⇒ noop, **μία** γραφή συνολικά
 *   Α33.7  δοχείο **ήδη** σε φάση χωρίς έργο ⇒ μένει σε φάσεις (ποτέ υποβιβασμός)
 *   Α33.8  ίχνος `version_supersede` — **ποτέ** `cde_supersede` για μετάβαση που δεν έγινε
 *   Α33.9  ο πίνακας: μόνο η αντικατάσταση ζει και στα δύο καθεστώτα
 *
 * ⚠️ Ο αναγνώστης (`file-record-read`) και η στοίβα (`version-stack`) **δεν** γίνονται mock.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { readContainerState } from '@/lib/files/file-record-read';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
}));

jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: jest.fn(async () => 'audit_test'),
}));

import { recordFileAudit } from '@/services/file-audit-admin.service';
import { transitionContainer } from '../container-transitions';
import { readVersionStack } from '../version-stack';
import { regimeOfEntry, regimeRefusal } from '../container-regime-policy';
import { ACT_SPEC } from '../container-transition-policy';
import type { ContainerAct } from '../container-transition-vocabulary';

const PREV = 'file_prev';
const NEXT = 'file_next';
const COMPANY = 'c_alpha';
const OWNER = 'u_owner';

/** Αρχείο **επαφής** — η επαφή υπάρχει, αλλά δεν ζει σε έργο. */
const CONTACT_SLOT = {
  entityType: 'contact',
  entityId: 'cont_1',
  domain: 'legal',
  category: 'contracts',
  purpose: 'contact-document',
};

const coordinator = { uid: OWNER, custody: { companyId: COMPANY }, globalRole: 'company_admin' as const };

function fileDoc(id: string, createdAt: string, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id, companyId: COMPANY, createdBy: OWNER, status: 'ready', lifecycleState: 'active',
    isDeleted: false, createdAt, cdeReadReach: 'tenant', ...CONTACT_SLOT,
    // Τα πεδία που απαιτεί το `isFileRecord` — αλλιώς η στοίβα (Α33.2) θα έλεγε `not-found` για άσχετο λόγο.
    displayName: id, originalFilename: `${id}.pdf`, ext: 'pdf', contentType: 'application/pdf',
    storagePath: `companies/${COMPANY}/files/${id}.pdf`,
    ...extra,
  };
}

function seedPair(prev: Record<string, unknown> = {}, next: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.CONTACTS, 'cont_1', { id: 'cont_1', companyId: COMPANY });
  fake.seed(COLLECTIONS.FILES, PREV, fileDoc(PREV, '2026-09-01T10:00:00.000Z', prev));
  fake.seed(COLLECTIONS.FILES, NEXT, fileDoc(NEXT, '2026-09-17T10:00:00.000Z', next));
}

function stored(id: string): Record<string, unknown> {
  return fake.all<Record<string, unknown>>(COLLECTIONS.FILES).find((doc) => doc.id === id) ?? {};
}

const supersede = () =>
  transitionContainer({ fileId: PREV, act: 'supersede', actor: coordinator, supersededByFileId: NEXT });

const CDE_KEYS = ['cdeState', 'cdeSupersession', 'cdeShare', 'cdeSeal', 'cdeWithdrawal', 'cdeTeamId', 'suitabilityCode'];

beforeEach(() => {
  fake = new FakeFirestore();
  jest.clearAllMocks();
});

describe('Α33 — δοχείο εκτός έργου: εκδόσεις ΝΑΙ, φάσεις ΟΧΙ', () => {
  it('✅ Α33.1 — νέα έκδοση ⇒ αρχείο + δεσμός, κανένα cde*, ο αναγνώστης λέει pre-cde', async () => {
    seedPair();

    const outcome = await supersede();

    expect(outcome).toEqual({ kind: 'succeeded', fileId: PREV, act: 'supersede', supersededByFileId: NEXT });
    const prev = stored(PREV);
    expect(prev).toMatchObject({ supersededByFileId: NEXT, lifecycleState: 'archived', archivedBy: OWNER });
    for (const key of CDE_KEYS) expect(prev).not.toHaveProperty(key);
    expect(prev.isDeleted).toBe(false);
    expect(prev).not.toHaveProperty('purgeAt');
    // 🔴 Η ΟΥΣΙΑ: με `SUPERSEDED` ο κριτής θα ζητούσε μέλος έργου που δεν υπάρχει ⇒ αόρατο σε όλους.
    expect(readContainerState(prev)).toEqual({ phase: 'pre-cde' });
  });

  it('✅ Α33.2 — η στοίβα εκδόσεων βρίσκει και τις δύο (ο δεσμός αρκεί)', async () => {
    seedPair();
    await supersede();

    const stack = await readVersionStack({ companyId: COMPANY }, PREV);

    expect(stack.kind).toBe('stack');
    if (stack.kind !== 'stack') return;
    expect(stack.headFileId).toBe(NEXT);
    expect(stack.versions.map((v) => v.id)).toEqual([NEXT, PREV]);
  });

  it.each<ContainerAct>(['share', 'seal', 'withdraw'])(
    '🔴 Α33.3 — %s εκτός έργου ⇒ no-project, μηδέν γραφές',
    async (act) => {
      seedPair();
      const before = fake.writes;

      const outcome = await transitionContainer({ fileId: PREV, act, actor: coordinator });

      expect(outcome).toEqual({ kind: 'refused', fileId: PREV, act, why: 'no-project' });
      expect(fake.writes - before).toBe(0);
      for (const key of CDE_KEYS) expect(stored(PREV)).not.toHaveProperty(key);
    },
  );

  it('♻️ Α33.6 — δεύτερη φορά ⇒ noop, μία γραφή συνολικά', async () => {
    seedPair();
    const before = fake.writes;

    await supersede();
    const second = await supersede();

    expect(second).toEqual({ kind: 'noop', fileId: PREV, act: 'supersede', why: 'already-in-state' });
    expect(fake.writes - before).toBe(1);
  });

  it('📒 Α33.8 — ίχνος version_supersede, ποτέ cde_supersede', async () => {
    seedPair();
    await supersede();

    expect(recordFileAudit).toHaveBeenCalledTimes(1);
    expect(recordFileAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'version_supersede', fileId: PREV, companyId: COMPANY }),
    );
  });
});

describe('Α33 — δοχείο έργου: οι φάσεις μένουν', () => {
  it('✅ Α33.4 — δηλωμένο έργο ⇒ SUPERSEDED, και ο αναγνώστης συμφωνεί', async () => {
    seedPair({ projectId: 'proj_1' }, { projectId: 'proj_1' });

    const outcome = await supersede();

    expect(outcome).toMatchObject({ kind: 'transitioned', to: 'SUPERSEDED' });
    expect(readContainerState(stored(PREV)).phase).toBe('SUPERSEDED');
    expect(recordFileAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'cde_supersede' }));
  });

  it('✅ Α33.5 — έργο ΠΑΡΑΓΟΜΕΝΟ (ακίνητο → κτίριο → έργο) ⇒ φάσεις + σφράγιση projectId', async () => {
    const slot = { entityType: 'property', entityId: 'prop_1' };
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { id: 'prop_1', companyId: COMPANY, buildingId: 'bldg_1' });
    fake.seed(COLLECTIONS.BUILDINGS, 'bldg_1', { id: 'bldg_1', companyId: COMPANY, projectId: 'proj_9' });
    fake.seed(COLLECTIONS.PROJECTS, 'proj_9', { id: 'proj_9', companyId: COMPANY });
    fake.seed(COLLECTIONS.FILES, PREV, fileDoc(PREV, '2026-09-01T10:00:00.000Z', slot));
    fake.seed(COLLECTIONS.FILES, NEXT, fileDoc(NEXT, '2026-09-17T10:00:00.000Z', slot));

    const outcome = await supersede();

    expect(outcome).toMatchObject({ kind: 'transitioned', to: 'SUPERSEDED' });
    expect(stored(PREV)).toMatchObject({ cdeState: 'SUPERSEDED', projectId: 'proj_9' });
  });

  it('🔒 Α33.7 — ήδη σε φάση ΧΩΡΙΣ έργο ⇒ μένει σε φάσεις (ποτέ υποβιβασμός)', async () => {
    seedPair({
      cdeState: 'SHARED',
      cdeShare: { by: OWNER, at: '2026-09-02T10:00:00.000Z', revision: 0 },
    });

    const outcome = await supersede();

    expect(outcome).toMatchObject({ kind: 'transitioned', from: 'SHARED', to: 'SUPERSEDED' });
    expect(readContainerState(stored(PREV)).phase).toBe('SUPERSEDED');
  });
});

describe('Α33.9 — ο πίνακας καθεστώτων (καθαρός)', () => {
  it('μόνο η αντικατάσταση ζει και εκτός έργου', () => {
    const outside = regimeOfEntry({ outcome: 'none', why: 'entity-without-project' });
    expect(outside).toEqual({ kind: 'versions-only', why: 'entity-without-project' });

    const allowedOutside = (Object.keys(ACT_SPEC) as ContainerAct[]).filter(
      (act) => regimeRefusal(act, outside) === null,
    );
    expect(allowedOutside).toEqual(['supersede']);
  });

  it('δηλωμένο ή παραγόμενο έργο ⇒ cde, και κάθε πράξη επιτρέπεται', () => {
    for (const outcome of ['declared', 'derived'] as const) {
      const regime = regimeOfEntry({ outcome, projectId: 'proj_1' });
      expect(regime).toEqual({ kind: 'cde' });
      for (const act of Object.keys(ACT_SPEC) as ContainerAct[]) expect(regimeRefusal(act, regime)).toBeNull();
    }
  });
});
