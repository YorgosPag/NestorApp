/**
 * @fileoverview **ΕΡΓΟ ΠΟΥ ΔΕΝ ΑΠΟΘΗΚΕΥΤΗΚΕ ΑΚΟΜΗ** — οι διευθύνσεις του ζουν στο πρόχειρο («Fill then Create»).
 * @related components/projects/tabs/locations/useProjectLocations · components/projects/draft/useProjectDraftAddresses
 *
 * 🔴 **Περιστατικό 2026-10-04 (παραγωγή)**: η καρτέλα «Διευθύνσεις» σε νέο έργο έστελνε
 * `PATCH /api/projects/__new__` ⇒ 500 ⇒ η διεύθυνση **χανόταν**, τρεις φορές στη σειρά.
 * Το βάρος εδώ πέφτει στο **τι ΔΕΝ φεύγει προς τον διακομιστή** και στο **πού καταλήγει**.
 */

import { useRef } from 'react';
import { renderHook, act } from '@testing-library/react';
import type { Project } from '@/types/project';
import type { ProjectAddress } from '@/types/project/addresses';
import { DRAFT_ENTITY_ID } from '@/lib/draft-entity-id';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import { useProjectDraftAddresses } from '@/components/projects/draft/useProjectDraftAddresses';
import { useProjectLocations } from '../useProjectLocations';

jest.mock('@/hooks/notifications/useProjectNotifications', () => {
  const address = {
    cityRequired: jest.fn(),
    added: jest.fn(),
    updated: jest.fn(),
    deleted: jest.fn(),
    cleared: jest.fn(),
    primaryUpdated: jest.fn(),
    saveError: jest.fn(),
    updateError: jest.fn(),
    deleteError: jest.fn(),
    clearError: jest.fn(),
    soleAddressMustBePrimary: jest.fn(),
  };
  return { useProjectNotifications: () => ({ address }) };
});

jest.mock('@/services/projects/project-mutation-gateway', () => ({
  updateProjectWithPolicy: jest.fn().mockResolvedValue({ success: true }),
}));

const address = (id: string, isPrimary: boolean): ProjectAddress => ({
  id,
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Ελευθέριο Κορδελιό',
  postalCode: '56334',
  country: 'Greece',
  type: isPrimary ? 'site' : 'other',
  isPrimary,
});

const projectWithId = (id: string, addresses?: ProjectAddress[]) =>
  ({ id, ...(addresses ? { addresses } : {}) }) as unknown as Project;

/** Ό,τι κάνει το `ProjectDetails`: ένα πρόχειρο, δοσμένο στην καρτέλα. */
function renderLocations(initialProject: Project) {
  return renderHook(
    ({ project }: { project: Project }) => {
      const draft = useProjectDraftAddresses(project.id);
      return { draft, loc: useProjectLocations(project, draft) };
    },
    { initialProps: { project: initialProject } },
  );
}

beforeEach(() => {
  jest.mocked(updateProjectWithPolicy).mockClear();
});

describe('useProjectLocations — πρόχειρο έργο («Fill then Create»)', () => {
  it('🔴 καμία πράξη ΔΕΝ φεύγει προς τον διακομιστή — γράφεται στο πρόχειρο', async () => {
    const draftProject = projectWithId(DRAFT_ENTITY_ID);
    // Το πρόχειρο στήνεται ΠΡΙΝ ανέβει η καρτέλα — όπως το βρίσκει μετά από αλλαγή καρτέλας.
    const { result } = renderHook(() => {
      const draft = useProjectDraftAddresses(DRAFT_ENTITY_ID);
      const seeded = useRef(false);
      if (!seeded.current) {
        draft.set([address('a-1', true), address('a-2', false)]);
        seeded.current = true;
      }
      return { draft, loc: useProjectLocations(draftProject, draft) };
    });

    expect(result.current.loc.isDraft).toBe(true);
    expect(result.current.loc.localAddresses).toHaveLength(2);

    // Η πράξη «όρισε κύρια» περνά από το ίδιο `persistAddresses` με κάθε άλλη.
    await act(async () => {
      await result.current.loc.handleSetPrimary(1);
    });

    expect(updateProjectWithPolicy).not.toHaveBeenCalled();
    expect(result.current.draft.get().map((a) => a.isPrimary)).toEqual([false, true]);
    expect(result.current.loc.localAddresses.map((a) => a.isPrimary)).toEqual([false, true]);
  });

  it('🔴 μετά τη δημιουργία η καρτέλα ΔΕΝ αδειάζει — υιοθετεί ό,τι έγραψε ο διακομιστής', () => {
    const { result, rerender } = renderLocations(projectWithId(DRAFT_ENTITY_ID));

    const written = [{ ...address('a-1', true), coordinates: { lat: 40.66, lng: 22.89 } }];
    // Η «Γενικά»: δημιουργία πέτυχε ⇒ το πρόχειρο περνά στην πραγματική ταυτότητα.
    act(() => result.current.draft.commit('proj_real', written));
    // Η σελίδα αντικαθιστά το πρόχειρο με το πραγματικό έργο — η σύνοψη ΔΕΝ έχει διευθύνσεις.
    rerender({ project: projectWithId('proj_real') });

    expect(result.current.loc.isDraft).toBe(false);
    expect(result.current.loc.localAddresses).toEqual(written);
  });

  it('🔴 το πρόχειρο ΔΕΝ διαρρέει σε άλλο έργο', () => {
    const { result, rerender } = renderLocations(projectWithId(DRAFT_ENTITY_ID));
    act(() => result.current.draft.commit('proj_real', [address('a-1', true)]));
    rerender({ project: projectWithId('proj_real') });

    const other = [address('b-1', true)];
    rerender({ project: projectWithId('proj_other', other) });

    expect(result.current.loc.localAddresses).toEqual(other);
    expect(result.current.draft.belongsTo('proj_real')).toBe(false);
    expect(result.current.draft.get()).toEqual([]);
  });

  it('🔴 «Άκυρο» και ξανά «Νέο» ⇒ καθαρό πρόχειρο', () => {
    const { result, rerender } = renderLocations(projectWithId(DRAFT_ENTITY_ID));
    act(() => result.current.draft.set([address('a-1', true)]));

    rerender({ project: projectWithId('proj_existing', []) });
    rerender({ project: projectWithId(DRAFT_ENTITY_ID) });

    expect(result.current.draft.get()).toEqual([]);
    expect(result.current.loc.localAddresses).toEqual([]);
  });

  it('⚓ μάρτυρας: αποθηκευμένο έργο εξακολουθεί να γράφει στον διακομιστή', async () => {
    const stored = [address('a-1', true), address('a-2', false)];
    const { result } = renderLocations(projectWithId('proj_stored', stored));

    await act(async () => {
      await result.current.loc.handleSetPrimary(1);
    });

    expect(updateProjectWithPolicy).toHaveBeenCalledTimes(1);
    expect(jest.mocked(updateProjectWithPolicy).mock.calls[0][0].projectId).toBe('proj_stored');
  });
});
