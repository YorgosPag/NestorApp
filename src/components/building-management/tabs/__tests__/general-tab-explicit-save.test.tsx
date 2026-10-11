/**
 * Άγκυρα — η φόρμα κτιρίου γράφει στη βάση ΜΟΝΟ με ρητή «Αποθήκευση» (ADR-248 §2.5 · ADR-912 Εύρημα 8).
 *
 * ΜΕΤΡΗΜΕΝΟ ΕΛΑΤΤΩΜΑ (browser, 390px): η φόρμα είχε `useAutoSave` με debounce 2 s πάνω στην ΕΝΕΡΓΗ εγγραφή. Ο διάλογος
 * «οι αλλαγές που δεν αποθηκεύσατε θα χαθούν» έλεγε ψέματα (είχαν ήδη γραφτεί) και η «Ακύρωση» επανέφερε μόνο την οθόνη.
 *
 * Καρφώνεται η ΑΝΑΛΛΟΙΩΤΗ, όχι η υλοποίηση: όσο γράφει ο άνθρωπος — και όταν φεύγει — δεν γίνεται ΚΑΜΙΑ εγγραφή.
 *
 * @module components/building-management/tabs/__tests__/general-tab-explicit-save
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

const mockUpdateBuildingWithPolicy = jest.fn();

jest.mock('@/services/building/building-mutation-gateway', () => ({
  updateBuildingWithPolicy: (...args: unknown[]) => mockUpdateBuildingWithPolicy(...args),
  createBuildingWithCodeRetry: jest.fn(),
}));

jest.mock('../GeneralTabContent/Header', () => ({ Header: () => null }));

// Η κάρτα πεδίων χρειάζεται μόνο να ΑΛΛΑΞΕΙ ένα πεδίο, όπως θα έκανε ένα πλήκτρο.
jest.mock('../GeneralTabContent/BasicInfoCard', () => ({
  BasicInfoCard: ({ formData, updateField }: {
    formData: { name: string };
    updateField: (field: string, value: string) => void;
  }) => (
    <button type="button" onClick={() => updateField('name', `${formData.name}!`)}>type-in-name</button>
  ),
}));

jest.mock('../../building-services', () => ({
  getProjectsList: jest.fn(async () => []),
  getBuildingCodesByProject: jest.fn(async () => []),
}));

jest.mock('../hooks/useProjectQuickCreate', () => ({
  useProjectQuickCreate: () => ({
    projectsCount: 1,
    fetchFailed: false,
    showSheet: false,
    setShowSheet: jest.fn(),
    handleProjectCreated: jest.fn(),
  }),
}));

jest.mock('@/hooks/useEntityLink', () => ({
  useEntityLink: () => ({
    linkedId: 'proj_1',
    setLinkedId: jest.fn(),
    getPayload: () => ({}),
    linkCardKey: 'link',
    linkCardProps: {},
  }),
}));

jest.mock('@/components/navigation/config', () => ({
  NAVIGATION_ENTITIES: { project: { icon: () => null, color: '' } },
}));
jest.mock('@/components/shared/EntityLinkCard', () => ({ EntityLinkCard: () => null }));
jest.mock('@/components/shared/empty-states/NoProjectsEmptyState', () => ({ NoProjectsEmptyState: () => null }));
jest.mock('@/components/projects/dialogs/ProjectQuickCreateSheet', () => ({ ProjectQuickCreateSheet: () => null }));
jest.mock('@/components/shared/PolicyErrorBanner', () => ({ PolicyErrorBanner: () => null }));
jest.mock('@/services/realtime', () => ({ RealtimeService: { dispatchBuildingProjectLinked: jest.fn() } }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useCompanyId', () => ({ useCompanyId: () => ({ companyId: 'comp_1' }) }));
jest.mock('@/hooks/notifications/useBuildingNotifications', () => ({
  useBuildingNotifications: () => ({ created: jest.fn(), updated: jest.fn() }),
}));
jest.mock('@/lib/design-system', () => ({}));

import { GeneralTabContent } from '../GeneralTabContent';

type BuildingProp = React.ComponentProps<typeof GeneralTabContent>['building'];

const BUILDING = {
  id: 'bldg_1',
  name: 'Κτίριο Α',
  code: 'Κτήριο Α',
  description: '',
  address: '',
  city: '',
  projectId: 'proj_1',
  companyId: 'comp_1',
  _v: 3,
} as unknown as BuildingProp;

/** Πολύ περισσότερο από κάθε debounce που υπήρξε (2 s) — ό,τι θα έγραφε «σε λίγο», θα είχε γράψει. */
const LONG_AFTER_ANY_DEBOUNCE_MS = 60_000;

function renderEditing() {
  const onSaveRef: React.MutableRefObject<(() => Promise<boolean>) | null> = { current: null };
  const onEditingChange = jest.fn();
  const view = render(
    <GeneralTabContent building={BUILDING} isEditing onEditingChange={onEditingChange} onSaveRef={onSaveRef} />,
  );
  return { ...view, onSaveRef, onEditingChange };
}

describe('GeneralTabContent — ρητή αποθήκευση (ADR-248 §2.5)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUpdateBuildingWithPolicy.mockReset();
    mockUpdateBuildingWithPolicy.mockResolvedValue({ success: true, _v: 4 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Ε1 — αλλαγή πεδίου και πέρασμα χρόνου ΔΕΝ γράφουν στη βάση', () => {
    renderEditing();

    fireEvent.click(screen.getByText('type-in-name'));
    act(() => { jest.advanceTimersByTime(LONG_AFTER_ANY_DEBOUNCE_MS); });

    expect(mockUpdateBuildingWithPolicy).not.toHaveBeenCalled();
  });

  it('Ε2 — η αποχώρηση με αλλαγές ΔΕΝ γράφει (κανένα «flush on unmount»)', () => {
    const { unmount } = renderEditing();

    fireEvent.click(screen.getByText('type-in-name'));
    unmount();
    act(() => { jest.advanceTimersByTime(LONG_AFTER_ANY_DEBOUNCE_MS); });

    expect(mockUpdateBuildingWithPolicy).not.toHaveBeenCalled();
  });

  it('Ε3 — η «Αποθήκευση» γράφει ΜΙΑ φορά, ό,τι κρατά η φόρμα, με την έκδοση που φορτώθηκε', async () => {
    const { onSaveRef, onEditingChange } = renderEditing();

    fireEvent.click(screen.getByText('type-in-name'));
    let saved: boolean | undefined;
    await act(async () => { saved = await onSaveRef.current?.(); });

    expect(saved).toBe(true);
    expect(mockUpdateBuildingWithPolicy).toHaveBeenCalledTimes(1);
    expect(mockUpdateBuildingWithPolicy).toHaveBeenCalledWith({
      buildingId: 'bldg_1',
      updates: expect.objectContaining({ name: 'Κτίριο Α!', _v: 3 }),
    });
    expect(onEditingChange).toHaveBeenCalledWith(false);
  });

  it('Ε4 — αποτυχία αποθήκευσης: μένει σε επεξεργασία και επιστρέφει false', async () => {
    mockUpdateBuildingWithPolicy.mockResolvedValue({ success: false, error: 'boom' });
    const { onSaveRef, onEditingChange } = renderEditing();

    fireEvent.click(screen.getByText('type-in-name'));
    let saved: boolean | undefined;
    await act(async () => { saved = await onSaveRef.current?.(); });

    expect(saved).toBe(false);
    expect(onEditingChange).not.toHaveBeenCalledWith(false);
  });
});
