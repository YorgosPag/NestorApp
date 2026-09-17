/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ Α20** — η πέμπτη πράξη: «νέα έκδοση ⇒ η παλιά ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ» (ADR-862 Φ0 Β10).
 * @related services/iso19650/container-succession-policy · services/iso19650/container-transitions ·
 *   lib/files/succession-identity · lib/files/file-record-read
 * @module services/iso19650/__tests__/container-supersession-anchor
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ΤΙ ΚΛΕΙΔΩΝΕΙ
 * ════════════════════════════════════════════════════════════════════════════
 *   Α20.1-9   κάθε **ονομασμένη** άρνηση της κρίσης διαδοχής — μία ανά έλεγχο, ώστε η αφαίρεση
 *             **οποιουδήποτε** ελέγχου να κοκκινίζει ακριβώς μία γραμμή
 *   Α20.10-13 ο **γραφέας**: ΜΙΑ εγγραφή · SUPERSEDED + **αρχείο** · **ποτέ** κάδος/`purgeAt` ·
 *             ο **πραγματικός** αναγνώστης συμφωνεί (αλλιώς: αόρατο αρχείο)
 *   Α20.14-17 η **εξουσία**: μελετητής που ανέβασε τον διάδοχο ✅ · μελετητής που δεν τον ανέβασε ⛔ ·
 *             συντονιστής για λογαριασμό άλλου ✅ · ρόλος ανάγνωσης ⛔ (`not-capable`)
 *
 * ⚠️ Ο αναγνώστης (`file-record-read`) **δεν** γίνεται mock — ίδιο δόγμα με την άγκυρα Α17.
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
import { judgeSuccession, type SuccessionQuery } from '../container-succession-policy';

const PREV = 'file_prev';
const NEXT = 'file_next';
const COMPANY = 'c_alpha';
const ARCHITECT = 'u_architect';
const OTHER = 'u_other';

/** Η θέση που μοιράζονται οι δύο εκδόσεις — ίδια με τις δύο ζωντανές κατόψεις (2026-09-17). */
const SLOT = {
  entityType: 'property',
  entityId: 'prop_80',
  domain: 'construction',
  category: 'floorplans',
  purpose: 'property-floorplan',
};

function predecessorDoc(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    // ADR-862 §5.3.7 — `projectId` ⇒ καθεστώς `cde`· η διαδοχή ΕΚΤΟΣ έργου κλειδώνεται στην Α33.
    id: PREV, companyId: COMPANY, projectId: 'proj_cde', createdBy: ARCHITECT, status: 'ready', lifecycleState: 'active',
    isDeleted: false, createdAt: '2026-09-01T10:00:00.000Z', ...SLOT, ...extra,
  };
}

function successorDoc(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: NEXT, companyId: COMPANY, createdBy: ARCHITECT, status: 'ready', lifecycleState: 'active',
    isDeleted: false, createdAt: '2026-09-17T10:00:00.000Z', ...SLOT, ...extra,
  };
}

function query(overrides: Partial<SuccessionQuery> = {}): SuccessionQuery {
  return {
    predecessor: predecessorDoc(),
    successor: successorDoc(),
    predecessorId: PREV,
    successorId: NEXT,
    actorUid: ARCHITECT,
    actorCustody: { companyId: COMPANY },
    actsForOthers: false,
    ...overrides,
  };
}

const refusedWith = (why: string) => ({ ok: false, outcome: 'refused', why });

// ============================================================================
// Α20.1-9 — Η ΚΡΙΣΗ: μία άρνηση ανά έλεγχο
// ============================================================================

describe('Α20 — η κρίση διαδοχής (καθαρή)', () => {
  it('✅ Α20.0 — ίδια θέση · ίδιος μισθωτής · έτοιμος, νεότερος, δικός μου διάδοχος ⇒ αποδεικνύεται', () => {
    expect(judgeSuccession(query())).toEqual({ ok: true, successorId: NEXT });
  });

  it('🔴 Α20.1 — χωρίς διάδοχο ⇒ successor-missing', () => {
    expect(judgeSuccession(query({ successorId: undefined }))).toEqual(refusedWith('successor-missing'));
  });

  it('♻️ Α20.2 — ο εαυτός του ⇒ noop self-succession', () => {
    expect(judgeSuccession(query({ successorId: PREV }))).toEqual({ ok: false, outcome: 'noop', why: 'self-succession' });
  });

  it('🔴 Α20.3 — προκάτοχος ήδη στον κάδο ⇒ predecessor-not-active (δεν «ξαναζωντανεύει» σε αρχείο)', () => {
    const trashed = predecessorDoc({ lifecycleState: 'trashed', isDeleted: true });
    expect(judgeSuccession(query({ predecessor: trashed }))).toEqual(refusedWith('predecessor-not-active'));
  });

  it('🔴 Α20.4 — διάδοχος ανύπαρκτος ή ΞΕΝΟΥ μισθωτή ⇒ το ΙΔΙΟ successor-not-found (κανένα μαντείο)', () => {
    expect(judgeSuccession(query({ successor: null }))).toEqual(refusedWith('successor-not-found'));
    expect(judgeSuccession(query({ successor: successorDoc({ companyId: 'c_beta' }) }))).toEqual(
      refusedWith('successor-not-found'),
    );
  });

  it('🔴 Α20.5 — διάδοχος pending / διαγραμμένος ⇒ successor-not-ready', () => {
    expect(judgeSuccession(query({ successor: successorDoc({ status: 'pending' }) }))).toEqual(
      refusedWith('successor-not-ready'),
    );
    expect(judgeSuccession(query({ successor: successorDoc({ isDeleted: true }) }))).toEqual(
      refusedWith('successor-not-ready'),
    );
  });

  it('🔴 Α20.6 — ατοποθέτητο αρχείο («standalone») ⇒ identity-absent — «δεν ξέρω» ≠ «ίδιο»', () => {
    const unplaced = { entityType: 'floor', entityId: 'standalone' };
    expect(
      judgeSuccession(query({ predecessor: predecessorDoc(unplaced), successor: successorDoc(unplaced) })),
    ).toEqual(refusedWith('identity-absent'));
  });

  it('🔴 Α20.7 — άλλη θέση (άλλος σκοπός) ⇒ identity-mismatch', () => {
    expect(judgeSuccession(query({ successor: successorDoc({ purpose: 'building-floorplan' }) }))).toEqual(
      refusedWith('identity-mismatch'),
    );
  });

  it('🔴 Α20.8 — «διάδοχος» παλαιότερος ⇒ successor-not-newer', () => {
    expect(
      judgeSuccession(query({ successor: successorDoc({ createdAt: '2026-08-01T10:00:00.000Z' }) })),
    ).toEqual(refusedWith('successor-not-newer'));
  });

  it('🔴 Α20.9 — ο διάδοχος είναι ΑΛΛΟΥ, χωρίς εξουσία συντονιστή ⇒ not-successor-author', () => {
    expect(judgeSuccession(query({ actorUid: OTHER }))).toEqual(refusedWith('not-successor-author'));
    expect(judgeSuccession(query({ actorUid: OTHER, actsForOthers: true }))).toEqual({ ok: true, successorId: NEXT });
  });

  it('🔑 Α20.9β — η ρητή ταυτότητα δημοσίευσης ΝΙΚΑ τη θέση (μοντέλα)', () => {
    const model = { publicationIdentity: 'model/measured/active-floor/as-built' };
    expect(
      judgeSuccession(query({
        predecessor: predecessorDoc(model),
        successor: successorDoc({ ...model, purpose: 'άλλος' }),
      })),
    ).toEqual({ ok: true, successorId: NEXT });
  });
});

// ============================================================================
// Α20.10-17 — Ο ΓΡΑΦΕΑΣ, πάνω σε δίσκο, με τον ΠΡΑΓΜΑΤΙΚΟ αναγνώστη
// ============================================================================

function seedPair(prev: Record<string, unknown> = {}, next: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.FILES, PREV, predecessorDoc(prev));
  fake.seed(COLLECTIONS.FILES, NEXT, successorDoc(next));
}

function stored(id: string): Record<string, unknown> {
  return fake.all<Record<string, unknown>>(COLLECTIONS.FILES).find((doc) => doc.id === id) ?? {};
}

const architect = { uid: ARCHITECT, custody: { companyId: COMPANY }, globalRole: 'architect' as const };
const supersede = (actor: { uid: string; custody: { companyId: string }; globalRole: string }) =>
  transitionContainer({
    fileId: PREV,
    act: 'supersede',
    actor: actor as typeof architect,
    supersededByFileId: NEXT,
  });

beforeEach(() => {
  fake = new FakeFirestore();
  jest.clearAllMocks();
});

describe('Α20 — ο γραφέας: αρχείο, ποτέ κάδος', () => {
  it('✅ Α20.10 — SUPERSEDED + archived, ο ΠΡΑΓΜΑΤΙΚΟΣ αναγνώστης συμφωνεί', async () => {
    seedPair();

    const outcome = await supersede(architect);

    expect(outcome).toMatchObject({ kind: 'transitioned', act: 'supersede', to: 'SUPERSEDED' });
    const doc = stored(PREV);
    expect(doc.cdeState).toBe('SUPERSEDED');
    expect(doc.lifecycleState).toBe('archived');
    expect(doc.supersededByFileId).toBe(NEXT);
    expect(doc.cdeSupersession).toMatchObject({ by: ARCHITECT, supersededByFileId: NEXT });
    expect(readContainerState(doc)).toEqual({ phase: 'SUPERSEDED', teamId: null });
  });

  it('🔴 Α20.11 — ΠΟΤΕ κάδος: χωρίς isDeleted, χωρίς purgeAt ⇒ δομικά εκτός οριστικής διαγραφής', async () => {
    seedPair();
    await supersede(architect);

    const doc = stored(PREV);
    expect(doc.isDeleted).toBe(false);
    expect(doc.purgeAt).toBeUndefined();
  });

  it('🔑 Α20.12 — ΑΤΟΜΙΚΟΤΗΤΑ + ο διάδοχος ανέγγιχτος', async () => {
    seedPair();
    const before = fake.writes;
    const successorBefore = JSON.stringify(stored(NEXT));

    await supersede(architect);

    expect(fake.writes - before).toBe(1);
    expect(JSON.stringify(stored(NEXT))).toBe(successorBefore);
  });

  it('♻️ Α20.13 — δεύτερη φορά ⇒ noop, καμία γραφή· ίχνος με ΔΙΑΚΡΙΤΗ ενέργεια', async () => {
    seedPair();
    await supersede(architect);
    const afterFirst = fake.writes;

    expect(await supersede(architect)).toMatchObject({ kind: 'noop', why: 'already-in-state' });
    expect(fake.writes).toBe(afterFirst);
    expect(recordFileAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cde_supersede', metadata: expect.objectContaining({ supersededByFileId: NEXT }) }),
    );
  });
});

describe('Α20 — η εξουσία: όποιος ανεβάζει, όχι μόνο ο συντονιστής', () => {
  it('✅ Α20.14 — ΜΕΛΕΤΗΤΗΣ (όχι συντονιστής) που ανέβασε τον διάδοχο ⇒ επιτρέπεται', async () => {
    seedPair();
    expect(await supersede(architect)).toMatchObject({ kind: 'transitioned' });
  });

  it('🔴 Α20.15 — μελετητής που ΔΕΝ ανέβασε τον διάδοχο ⇒ not-successor-author, καμία γραφή', async () => {
    seedPair({}, { createdBy: OTHER });
    const before = fake.writes;

    expect(await supersede(architect)).toMatchObject({ kind: 'refused', why: 'not-successor-author' });
    expect(fake.writes).toBe(before);
  });

  it('✅ Α20.16 — ΣΥΝΤΟΝΙΣΤΗΣ τακτοποιεί έκδοση άλλου', async () => {
    seedPair({}, { createdBy: OTHER });
    const coordinator = { uid: 'u_pm', custody: { companyId: COMPANY }, globalRole: 'company_admin' };

    expect(await supersede(coordinator)).toMatchObject({ kind: 'transitioned' });
  });

  it('🔴 Α20.17 — ρόλος ανάγνωσης ⇒ not-capable, ΠΡΙΝ κάθε ανάγνωση', async () => {
    seedPair({ createdBy: 'u_viewer' }, { createdBy: 'u_viewer' });
    const viewer = { uid: 'u_viewer', custody: { companyId: COMPANY }, globalRole: 'viewer' };

    expect(await supersede(viewer)).toMatchObject({ kind: 'refused', why: 'not-capable' });
  });
});

describe('Α20 — ο θεματοφύλακας διαβάζει την πράξη αντικατάστασης', () => {
  it('✅ Α20.18 — SUPERSEDED με πράξη `cdeSupersession` (χωρίς απόσυρση) ⇒ αναγνώσιμο', () => {
    const state = readContainerState({
      cdeState: 'SUPERSEDED',
      cdeSupersession: { by: ARCHITECT, at: '2026-09-17T10:00:00.000Z', revision: 0, supersededByFileId: NEXT },
    });
    expect(state).toEqual({ phase: 'SUPERSEDED', teamId: null });
  });

  it('🔴 Α20.19 — πράξη αντικατάστασης ΧΩΡΙΣ διάδοχο δεν είναι απόδειξη ⇒ unreadable', () => {
    const state = readContainerState({
      cdeState: 'SUPERSEDED',
      cdeSupersession: { by: ARCHITECT, at: '2026-09-17T10:00:00.000Z', revision: 0 },
    });
    expect(state).toEqual({ phase: 'unreadable', why: 'superseded-without-evidence' });
  });
});
