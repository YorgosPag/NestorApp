/**
 * @jest-environment node
 *
 * @fileoverview **Η ΔΗΜΟΣΙΕΥΣΗ ΕΙΝΑΙ Η ΟΝΟΜΑΣΤΙΚΗ ΔΗΛΩΣΗ** — ADR-909 Α8.
 * @related services/listings/floorplan-declaration.service
 *
 * 🔑 Η συναλλαγή είναι ψεύτικη, η **κρίση** όχι: τι γράφεται, πότε **δεν** γράφεται τίποτα, και ότι η
 * γραμμή ιστορικού ακολουθεί **μόνο** πραγματική γραφή.
 */

jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => ({
  FieldValue: { serverTimestamp: () => 'ts' },
}));

const recordChange = jest.fn(async (_params: Record<string, unknown>): Promise<string | null> => 'audit_1');
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (params: Record<string, unknown>) => recordChange(params) },
}));

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';
import {
  declarePublishedFloorplan,
  declaredFloorplansOf,
  floorplanDeclarationHasRoom,
} from '../floorplan-declaration.service';

const REQUEST = { propertyId: 'prop_1', companyId: 'comp_alfa', fileId: 'file_new', performedBy: 'user_1' };

const update = jest.fn((_ref: unknown, _data: Record<string, unknown>) => undefined);

/** Βάση με **ένα** ακίνητο· `null` ⇒ δεν υπάρχει, `'boom'` ⇒ η συναλλαγή σκάει. */
function dbWith(property: Record<string, unknown> | null | 'boom'): AdminFirestore {
  const ref = { id: REQUEST.propertyId };
  return {
    collection: () => ({ doc: () => ref }),
    runTransaction: async (body: (transaction: unknown) => Promise<unknown>) => {
      if (property === 'boom') throw new Error('aborted');
      return body({ get: async () => ({ data: () => property ?? undefined }), update });
    },
  } as unknown as AdminFirestore;
}

function full(): string[] {
  return Array.from({ length: PUBLISHED_MEDIA_LIMIT }, (_, index) => `file_${index}`);
}

describe('ADR-909 Α8 — η δήλωση της παραγόμενης κάτοψης', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Δ1 — πρώτη δημοσίευση: προστίθεται ΣΤΟ ΤΕΛΟΣ, με τη σφραγίδα έκδοσης του ακινήτου', async () => {
    const db = dbWith({ companyId: 'comp_alfa', name: 'Διαμέρισμα 95 τ.μ.', _v: 7, publishedFloorplans: ['file_manual'] });

    await expect(declarePublishedFloorplan(db, REQUEST)).resolves.toBe('declared');

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][1]).toMatchObject({
      publishedFloorplans: ['file_manual', 'file_new'], _v: 8, updatedBy: 'user_1',
    });
  });

  it('Δ2 — η γραμμή ιστορικού γράφεται στο ΑΚΙΝΗΤΟ, με πριν και μετά', async () => {
    await declarePublishedFloorplan(dbWith({ companyId: 'comp_alfa', name: 'Α1', publishedFloorplans: ['file_manual'] }), REQUEST);

    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'property', entityId: 'prop_1', entityName: 'Α1', action: 'updated',
      performedBy: 'user_1', companyId: 'comp_alfa',
      changes: [{ field: 'publishedFloorplans', oldValue: 'file_manual', newValue: 'file_manual, file_new' }],
    }));
  });

  it('🔑 Δ3 — ιδεμποτικό: ήδη δηλωμένη ⇒ ΚΑΜΙΑ γραφή, ΚΑΜΙΑ γραμμή ιστορικού', async () => {
    const db = dbWith({ companyId: 'comp_alfa', publishedFloorplans: ['file_new'] });

    await expect(declarePublishedFloorplan(db, REQUEST)).resolves.toBe('already');

    expect(update).not.toHaveBeenCalled();
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('⛔ Δ4 — γεμάτη δήλωση ⇒ `full`, τίποτα δεν γράφεται', async () => {
    await expect(declarePublishedFloorplan(dbWith({ companyId: 'comp_alfa', publishedFloorplans: full() }), REQUEST))
      .resolves.toBe('full');

    expect(update).not.toHaveBeenCalled();
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('🔒 Δ5 — ακίνητο ΞΕΝΟΥ μισθωτή ή ανύπαρκτο ⇒ `failed`, ποτέ γραφή', async () => {
    await expect(declarePublishedFloorplan(dbWith({ companyId: 'comp_ΑΛΛΗ' }), REQUEST)).resolves.toBe('failed');
    await expect(declarePublishedFloorplan(dbWith(null), REQUEST)).resolves.toBe('failed');

    expect(update).not.toHaveBeenCalled();
  });

  it('Δ6 — δεν πετά ΠΟΤΕ: συναλλαγή που σκάει ⇒ `failed`', async () => {
    await expect(declarePublishedFloorplan(dbWith('boom'), REQUEST)).resolves.toBe('failed');
  });

  it('Δ7 — δήλωση που δεν διαβάζεται (άκυρο πεδίο στον δίσκο) μετρά ως «καμία»', async () => {
    expect(declaredFloorplansOf({ publishedFloorplans: 'file_a' })).toEqual([]);
    expect(declaredFloorplansOf({})).toEqual([]);
  });

  it('Δ8 — χωρά; ελεύθερη θέση, ή ΔΗΛΩΜΕΝΟΣ προκάτοχος που δίνει τη δική του', () => {
    expect(floorplanDeclarationHasRoom(['a'], [])).toBe(true);
    expect(floorplanDeclarationHasRoom(full(), [])).toBe(false);
    expect(floorplanDeclarationHasRoom(full(), ['file_0'])).toBe(true);
    // Προκάτοχος που ΔΕΝ είναι δηλωμένος δεν ελευθερώνει τίποτα.
    expect(floorplanDeclarationHasRoom(full(), ['file_not_declared'])).toBe(false);
  });
});
