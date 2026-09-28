/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΚΡΙΤΗΣ ΤΩΝ ΚΑΤΟΨΕΩΝ ΤΗΣ ΠΕΡΙΗΓΗΣΗΣ** (ADR-884 Φ2στ-β · §4.13 · §12 Δ7.1).
 *
 * - **Κ** — ο κριτής: κάτοψη ΑΥΤΟΥ του ακινήτου, ίδιος κάτοχος, έτοιμη εικόνα· καθεμία από τις αρνήσεις χωριστά.
 * - **Λ** — η λίστα της οθόνης βγαίνει από τον ΙΔΙΟ κριτή: ό,τι απορρίπτει ο γραφέας δεν εμφανίζεται ποτέ.
 */

jest.mock('server-only', () => ({}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createMockFirestore } from '@/test-utils/mock-firestore';
import type { SpatialTour } from '@/types/spatial-tour';

import { listTourPlanFiles, tourPlanFileOf } from '../tour-plan-files';

const AGENCY = 'comp_agency';
const TOUR: Pick<SpatialTour, 'custody' | 'subject'> = { custody: { companyId: AGENCY }, subject: { kind: 'company-property', id: 'prop_1' } };

function planFile(overrides: Record<string, unknown> = {}) {
  return {
    companyId: AGENCY, entityType: 'property', entityId: 'prop_1', category: 'floorplans', domain: 'sales', status: 'ready',
    contentType: 'image/png', storagePath: 'companies/comp_agency/plan.png', displayName: 'Ισόγειο', originalFilename: 'plan.png',
    ext: 'png', createdAt: '2026-09-01T10:00:00.000Z', createdBy: 'boris', levelFloorId: 'floor_0',
    thumbnailUrl: 'https://thumb/plan.png', ...overrides,
  };
}

describe('Κ — ο κριτής', () => {
  it('κάτοψη-εικόνα αυτού του ακινήτου, του ίδιου κατόχου ⇒ δεκτή', () => {
    expect(tourPlanFileOf(planFile(), 'f1', TOUR)?.id).toBe('f1');
  });

  it.each([
    ['άλλο ακίνητο', { entityId: 'prop_2' }],
    ['άλλη κατηγορία', { category: 'photos' }],
    ['άλλος κάτοχος', { companyId: 'comp_other' }],
    ['PDF (όχι εικόνα ακόμη)', { contentType: 'application/pdf' }],
    ['DXF', { contentType: 'application/dxf' }],
    ['όχι έτοιμο', { status: 'pending' }],
    ['σβησμένο', { isDeleted: true }],
    ['ακίνητο ιδιώτη αντί εταιρικού', { entityType: 'owner_property' }],
  ])('%s ⇒ απόρριψη', (_why, overrides) => {
    expect(tourPlanFileOf(planFile(overrides), 'f1', TOUR)).toBeNull();
  });

  it('έγγραφο που δεν είναι αρχείο ⇒ απόρριψη', () => {
    expect(tourPlanFileOf(null, 'f1', TOUR)).toBeNull();
    expect(tourPlanFileOf({ companyId: AGENCY }, 'f1', TOUR)).toBeNull();
  });
});

describe('Λ — η λίστα της οθόνης', () => {
  it('μόνο ό,τι περνά τον κριτή, με όνομα, προεπισκόπηση και όροφο', async () => {
    const kit = createMockFirestore();
    kit.seedCollection(COLLECTIONS.FILES, {
      f_ok: planFile(),
      f_pdf: planFile({ contentType: 'application/pdf' }),
      f_other: planFile({ entityId: 'prop_2' }),
      f_foreign: planFile({ companyId: 'comp_other' }),
    });
    const plans = await listTourPlanFiles(kit.instance as unknown as Firestore, TOUR);
    expect(plans).toEqual([{ fileId: 'f_ok', name: 'Ισόγειο', previewUrl: 'https://thumb/plan.png', levelFloorId: 'floor_0' }]);
  });
});
