/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ Α3γ (γραφέας)** — η νέα έκδοση κληρονομεί διαβάθμιση ΚΑΙ δηλώσεις (ADR-845 §7.17).
 * @related services/iso19650/succession-inheritance · services/iso19650/container-transitions ·
 *   lib/listings/declaration-succession
 * @module services/iso19650/__tests__/succession-inheritance-anchor
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ΤΙ ΚΛΕΙΔΩΝΕΙ
 * ════════════════════════════════════════════════════════════════════════════
 *   Κ1     δημόσια φωτογραφία + δικαίωμα ⇒ διάδοχος `public`, το ακίνητο δείχνει στη νέα έκδοση, `_v` +1,
 *          **τρεις** εγγραφές σε **μία** συναλλαγή, και τα δύο ίχνη
 *   Κ2-Κ2β μη δημόσιος προκάτοχος: οι δηλώσεις περνούν **χωρίς** δικαίωμα δημοσίευσης· η διαβάθμιση
 *          κληρονομείται όποια κι αν είναι (εμπιστευτικό δεν γίνεται αδιαβάθμητο)
 *   Κ3     ρητή διαβάθμιση του διαδόχου **νικά**
 *   Κ4     ακίνητο ξένου μισθωτή · ανύπαρκτο · που δεν αναφέρει το αρχείο ⇒ **δεν αγγίζεται**
 *   Κ5     άρνηση ⇒ **καμία** εγγραφή πουθενά, κανένα ίχνος κληρονομιάς
 *   Κ6     διάδοχος που **γεννιέται** στη συναλλαγή (προώθηση έκδοσης) ⇒ γεννιέται ήδη δημόσιος
 *   Κ7     προσωπικός χώρος ⇒ καμία κληρονομιά
 *
 * ⚠️ Ο γραφέας, η κρίση διαδοχής, ο κριτής ικανότητας και η καθαρή μεταφορά **δεν** γίνονται mock.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
}));

jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: jest.fn(async () => 'audit_test'),
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'entity_audit_test') },
}));

import { recordFileAudit } from '@/services/file-audit-admin.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { transitionContainer } from '../container-transitions';

const PREV = 'file_prev';
const NEXT = 'file_next';
const PROPERTY = 'prop_80';
const COMPANY = 'c_alpha';
const ADMIN = 'u_admin';
const ARCHITECT = 'u_architect';

/** Φωτογραφία ακινήτου — η θέση που μοιράζονται οι δύο εκδόσεις. */
const SLOT = {
  entityType: 'property',
  entityId: PROPERTY,
  domain: 'sales',
  category: 'photos',
  purpose: 'property-photo',
};

const SPOT = { floorplanFileId: 'file_plan', x: 0.4, y: 0.6, headingRad: 1, fovRad: 1.2 };

function fileDoc(id: string, createdAt: string, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id, companyId: COMPANY, projectId: 'proj_cde', createdBy: ARCHITECT, status: 'ready',
    lifecycleState: 'active', isDeleted: false, createdAt, ...SLOT, ...extra,
  };
}

function seedFiles(prev: Record<string, unknown> = {}, next: Record<string, unknown> | null = {}): void {
  fake.seed(COLLECTIONS.FILES, PREV, fileDoc(PREV, '2026-09-01T10:00:00.000Z', prev));
  if (next !== null) fake.seed(COLLECTIONS.FILES, NEXT, fileDoc(NEXT, '2026-09-17T10:00:00.000Z', next));
}

function seedProperty(extra: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, {
    id: PROPERTY,
    companyId: COMPANY,
    name: 'Διαμέρισμα 95 τ.μ.',
    _v: 4,
    publishedMediaOrder: [PREV, 'file_b'],
    publishedMediaFocalPoints: { [PREV]: { x: 0.2, y: 0.8 } },
    publishedPhotoCaptureSpots: { [PREV]: SPOT },
    ...extra,
  });
}

const file = (id: string): Record<string, unknown> => fake.getData(COLLECTIONS.FILES, id) ?? {};
const property = (): Record<string, unknown> => fake.getData(COLLECTIONS.PROPERTIES, PROPERTY) ?? {};

type Actor = Parameters<typeof transitionContainer>[0]['actor'];
/** Ο διαχειριστής εταιρείας: αντικαθιστά, τακτοποιεί εκδόσεις άλλων **και** δημοσιεύει. */
const admin = { uid: ADMIN, custody: { companyId: COMPANY }, globalRole: 'company_admin' } as Actor;
/** Ο αρχιτέκτονας: αντικαθιστά δικά του — **χωρίς** δικαίωμα δημοσίευσης. */
const architect = { uid: ARCHITECT, custody: { companyId: COMPANY }, globalRole: 'architect' } as Actor;

const supersede = (actor: Actor, successorBirth?: Record<string, unknown>) =>
  transitionContainer({
    fileId: PREV,
    act: 'supersede',
    actor,
    supersededByFileId: NEXT,
    ...(successorBirth === undefined ? {} : { successorBirth }),
  });

const inheritedTrace = () =>
  (recordFileAudit as jest.Mock).mock.calls
    .map(([line]) => line as { action: string; fileId: string; metadata?: Record<string, unknown> })
    .filter((line) => line.action === 'classify');

beforeEach(() => {
  fake = new FakeFirestore();
  jest.clearAllMocks();
});

describe('Α3γ — δημόσιο αρχείο: η αγγελία δείχνει τη νέα έκδοση, στην ίδια θέση', () => {
  it('✅ Κ1 — διάδοχος public · δηλώσεις στο νέο id · _v +1 · ΤΡΕΙΣ εγγραφές, ΜΙΑ συναλλαγή · δύο ίχνη', async () => {
    seedFiles({ classification: 'public' });
    seedProperty();
    const before = fake.writes;

    const outcome = await supersede(admin);

    expect(outcome).toMatchObject({ kind: 'transitioned', act: 'supersede' });
    expect(fake.writes - before).toBe(3);
    expect(file(PREV).lifecycleState).toBe('archived');
    expect(file(NEXT).classification).toBe('public');
    expect(property()).toMatchObject({
      _v: 5,
      updatedBy: ADMIN,
      publishedMediaOrder: [NEXT, 'file_b'],
      publishedMediaFocalPoints: { [NEXT]: { x: 0.2, y: 0.8 } },
      publishedPhotoCaptureSpots: { [NEXT]: SPOT },
    });
    expect(JSON.stringify(property().publishedMediaFocalPoints)).not.toContain(PREV);

    expect(inheritedTrace()).toEqual([
      expect.objectContaining({
        fileId: NEXT,
        companyId: COMPANY,
        metadata: { from: null, to: 'public', inheritedFrom: PREV },
      }),
    ]);
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: PROPERTY,
        companyId: COMPANY,
        performedBy: ADMIN,
        changes: expect.arrayContaining([{ field: 'publishedMediaOrder', oldValue: PREV, newValue: NEXT }]),
      }),
    );
  });

  it('🔴 Κ5 — χωρίς δικαίωμα δημοσίευσης ⇒ άρνηση, ΚΑΜΙΑ εγγραφή πουθενά, κανένα ίχνος κληρονομιάς', async () => {
    seedFiles({ classification: 'public' });
    seedProperty();
    const before = fake.writes;
    const propertyBefore = JSON.stringify(property());

    expect(await supersede(architect)).toMatchObject({ kind: 'refused', why: 'publication-not-capable' });

    expect(fake.writes).toBe(before);
    expect(JSON.stringify(property())).toBe(propertyBefore);
    expect(file(NEXT).classification).toBeUndefined();
    expect(inheritedTrace()).toEqual([]);
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('🍼 Κ6 — διάδοχος που ΓΕΝΝΙΕΤΑΙ στη συναλλαγή (προώθηση έκδοσης) γεννιέται ΗΔΗ δημόσιος', async () => {
    seedFiles({ classification: 'public' }, null);
    seedProperty();

    const outcome = await supersede(admin, fileDoc(NEXT, '2026-09-17T10:00:00.000Z', { createdBy: ADMIN }));

    expect(outcome).toMatchObject({ kind: 'transitioned' });
    expect(file(NEXT)).toMatchObject({ classification: 'public', status: 'ready' });
    expect(property().publishedMediaOrder).toEqual([NEXT, 'file_b']);
  });
});

describe('Α3γ — μη δημόσιο αρχείο: η καθημερινή δουλειά δεν ζητά δικαίωμα δημοσίευσης', () => {
  it('✅ Κ2 — αδιαβάθμητος προκάτοχος: οι δηλώσεις περνούν, διαβάθμιση ΔΕΝ γράφεται', async () => {
    seedFiles();
    seedProperty();

    expect(await supersede(architect)).toMatchObject({ kind: 'transitioned' });

    expect(file(NEXT).classification).toBeUndefined();
    expect(property().publishedMediaOrder).toEqual([NEXT, 'file_b']);
    expect(inheritedTrace()).toEqual([]);
  });

  it('🔒 Κ2β — ΕΜΠΙΣΤΕΥΤΙΚΟΣ προκάτοχος ⇒ ο διάδοχος μένει εμπιστευτικός (δεν γίνεται αδιαβάθμητος)', async () => {
    seedFiles({ classification: 'confidential' });

    expect(await supersede(architect)).toMatchObject({ kind: 'transitioned' });

    expect(file(NEXT).classification).toBe('confidential');
  });

  it('🔑 Κ3 — ρητή διαβάθμιση του διαδόχου ΝΙΚΑ: η κληρονομιά δεν την ξαναγράφει', async () => {
    seedFiles({ classification: 'public' }, { classification: 'internal' });
    seedProperty();

    expect(await supersede(admin)).toMatchObject({ kind: 'transitioned' });

    expect(file(NEXT).classification).toBe('internal');
    expect(inheritedTrace()).toEqual([]);
    // Οι δηλώσεις όμως ακολουθούν: αν ξαναγίνει δημόσιο, είναι στη θέση του.
    expect(property().publishedMediaOrder).toEqual([NEXT, 'file_b']);
  });
});

describe('Α3γ — το ακίνητο αγγίζεται ΜΟΝΟ όταν πρέπει', () => {
  it('🔒 Κ4 — ακίνητο ΞΕΝΟΥ μισθωτή ⇒ ανέγγιχτο (το `entityId` του αρχείου είναι ισχυρισμός)', async () => {
    seedFiles();
    seedProperty({ companyId: 'c_rival' });
    const propertyBefore = JSON.stringify(property());

    expect(await supersede(architect)).toMatchObject({ kind: 'transitioned' });

    expect(JSON.stringify(property())).toBe(propertyBefore);
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('✅ Κ4β — ανύπαρκτο ακίνητο ⇒ η διαδοχή γίνεται, ΜΙΑ εγγραφή όπως πάντα', async () => {
    seedFiles();
    const before = fake.writes;

    expect(await supersede(architect)).toMatchObject({ kind: 'transitioned' });

    expect(fake.writes - before).toBe(1);
  });

  it('✅ Κ4γ — ακίνητο που ΔΕΝ αναφέρει το αρχείο ⇒ δεν γράφεται (ούτε `_v`, ούτε ιστορικό)', async () => {
    seedFiles();
    seedProperty({ publishedMediaOrder: ['file_b'], publishedMediaFocalPoints: {}, publishedPhotoCaptureSpots: {} });

    expect(await supersede(architect)).toMatchObject({ kind: 'transitioned' });

    expect(property()._v).toBe(4);
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('🔑 Κ7 — προσωπικός χώρος ⇒ καμία κληρονομιά (δεν υπάρχει αγγελία γραφείου)', async () => {
    const owner = { userId: ARCHITECT };
    const personal = (id: string, createdAt: string) => ({
      id, userId: ARCHITECT, createdBy: ARCHITECT, status: 'ready', lifecycleState: 'active', isDeleted: false,
      createdAt, classification: 'public', ...SLOT,
    });
    fake.seed(COLLECTIONS.FILES_PERSONAL, PREV, personal(PREV, '2026-09-01T10:00:00.000Z'));
    fake.seed(COLLECTIONS.FILES_PERSONAL, NEXT, { ...personal(NEXT, '2026-09-17T10:00:00.000Z'), classification: undefined });
    seedProperty();

    const outcome = await supersede({ uid: ARCHITECT, custody: owner } as Actor);

    expect(outcome.kind).not.toBe('refused');
    expect(property()._v).toBe(4);
    expect(inheritedTrace()).toEqual([]);
  });
});
