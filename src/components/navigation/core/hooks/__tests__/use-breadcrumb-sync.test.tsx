/**
 * ADR-898 §21.6 Ε7 — **το breadcrumb ακολουθεί τον γονέα**. Θέση που άλλαζε κτίριο κρατούσε ίδια ταυτότητα και όνομα,
 * και η χειρόγραφη λίστα εξαρτήσεων του `useBreadcrumbSync` δεν είχε το `buildingId` ⇒ έμενε το ΠΑΛΙΟ κτίριο.
 */

import { renderHook } from '@testing-library/react';

import { breadcrumbEntityKey, useBreadcrumbSync, type BreadcrumbEntity } from '../useBreadcrumbSync';

const syncBreadcrumb = jest.fn();
const NAVIGATION = {
  projects: [
    { id: 'prj_1', name: 'ΕΡΓΟ Α', companyId: 'comp_1', linkedCompanyId: null, company: 'Εταιρεία' },
    { id: 'prj_2', name: 'ΕΡΓΟ Β', companyId: 'comp_1', linkedCompanyId: null, company: 'Εταιρεία' },
  ],
  companies: [],
  syncBreadcrumb,
};
jest.mock('../../NavigationContext', () => ({ useNavigation: () => NAVIGATION }));
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: jest.fn() } }));

const BUILDINGS = [
  { id: 'bld_A', name: 'Κτήριο Α', projectId: 'prj_1' },
  { id: 'bld_B', name: 'ΔΟΚΙΜΗ Κτήριο Β', projectId: 'prj_1' },
  { id: 'bld_Z', name: 'Κτήριο Ζ', projectId: 'prj_2' },
];

function space(buildingId: string | undefined, projectId = 'prj_1'): BreadcrumbEntity {
  return { type: 'space', id: 'park_1', name: 'Θ', spaceType: 'parking', buildingId, projectId };
}

const lastBuilding = () => syncBreadcrumb.mock.calls.at(-1)?.[0].building;

beforeEach(() => syncBreadcrumb.mockClear());

describe('useBreadcrumbSync — χώρος', () => {
  it('🔴 ίδια θέση, ίδιο όνομα, ΑΛΛΟ κτίριο ⇒ το breadcrumb δείχνει το νέο κτίριο', () => {
    const { rerender } = renderHook(({ entity }: { entity: BreadcrumbEntity }) => useBreadcrumbSync(entity, { buildings: BUILDINGS }), {
      initialProps: { entity: space('bld_B') },
    });
    expect(lastBuilding()).toEqual({ id: 'bld_B', name: 'ΔΟΚΙΜΗ Κτήριο Β' });

    rerender({ entity: space('bld_A') });
    expect(lastBuilding()).toEqual({ id: 'bld_A', name: 'Κτήριο Α' });
  });

  it('νέο αντικείμενο με ΙΔΙΟ περιεχόμενο (inline σε κάθε render) ⇒ καμία δεύτερη εγγραφή', () => {
    const { rerender } = renderHook(({ entity }: { entity: BreadcrumbEntity }) => useBreadcrumbSync(entity, { buildings: BUILDINGS }), {
      initialProps: { entity: space('bld_A') },
    });
    rerender({ entity: space('bld_A') });
    expect(syncBreadcrumb).toHaveBeenCalledTimes(1);
  });
});

describe('useBreadcrumbSync — κτίριο', () => {
  it('ίδιο κτίριο, ΑΛΛΟ έργο ⇒ το breadcrumb δείχνει το νέο έργο', () => {
    const building = (projectId: string): BreadcrumbEntity => ({ type: 'building', id: 'bld_A', name: 'Κτήριο Α', projectId });
    const { rerender } = renderHook(({ entity }: { entity: BreadcrumbEntity }) => useBreadcrumbSync(entity), {
      initialProps: { entity: building('prj_1') },
    });
    rerender({ entity: building('prj_2') });
    expect(syncBreadcrumb.mock.calls.at(-1)?.[0].project).toEqual({ id: 'prj_2', name: 'ΕΡΓΟ Β' });
  });
});

describe('breadcrumbEntityKey', () => {
  it('κάθε πεδίο που εμφανίζεται αλλάζει το κλειδί· ίδιο περιεχόμενο ⇒ ίδιο κλειδί· καμία οντότητα ⇒ null', () => {
    expect(breadcrumbEntityKey(space('bld_A'))).toBe(breadcrumbEntityKey(space('bld_A')));
    expect(breadcrumbEntityKey(space('bld_A'))).not.toBe(breadcrumbEntityKey(space('bld_B')));
    expect(breadcrumbEntityKey(space('bld_A', 'prj_1'))).not.toBe(breadcrumbEntityKey(space('bld_A', 'prj_2')));
    expect(breadcrumbEntityKey(null)).toBeNull();
  });
});
