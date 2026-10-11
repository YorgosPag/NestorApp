/**
 * Άγκυρα — η φόρμα έργου γράφει στη βάση ΜΟΝΟ με ρητή «Αποθήκευση» (ADR-248 §2.5 · ADR-912 Εύρημα 8).
 *
 * ΜΕΤΡΗΜΕΝΟ ΕΛΑΤΤΩΜΑ: `useAutosave` (debounce 2 s) πάνω στην ΕΝΕΡΓΗ εγγραφή, δίπλα σε «Αποθήκευση/Ακύρωση» ⇒ η «Ακύρωση»
 * δεν ακύρωνε, και ο έλεγχος επιπτώσεων παρακαμπτόταν για ό,τι δεν παρακολουθούσε.
 *
 * Καρφώνεται η ΑΝΑΛΛΟΙΩΤΗ: όσο γράφει ο άνθρωπος — και όταν φεύγει — δεν γίνεται ΚΑΜΙΑ εγγραφή· η «Αποθήκευση» περνά
 * από τον έλεγχο επιπτώσεων και γράφει μία φορά.
 *
 * @module components/projects/general-tab/__tests__/general-project-tab-explicit-save
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

const mockUpdateProjectWithPolicy = jest.fn();
const mockRunExistingProjectUpdate = jest.fn();

jest.mock('@/services/projects/project-mutation-gateway', () => ({
  updateProjectWithPolicy: (...args: unknown[]) => mockUpdateProjectWithPolicy(...args),
}));

jest.mock('@/hooks/useGuardedProjectMutation', () => ({
  useGuardedProjectMutation: () => ({
    ImpactDialog: null,
    runExistingProjectUpdate: (payload: unknown, action: () => Promise<void>) =>
      mockRunExistingProjectUpdate(payload, action),
  }),
}));
jest.mock('@/hooks/impact-guard/guard-result', () => ({ outcomeOrThrow: (outcome: unknown) => outcome }));

jest.mock('../../GeneralProjectHeader', () => ({ GeneralProjectHeader: () => null }));
jest.mock('../../PermitsTab', () => ({ PermitsTab: () => null }));

// Η κάρτα πεδίων χρειάζεται μόνο να ΑΛΛΑΞΕΙ ένα πεδίο, όπως θα έκανε ένα πλήκτρο.
jest.mock('../../BasicProjectInfoTab', () => ({
  BasicProjectInfoTab: ({ setData }: {
    setData: (update: (prev: { name: string }) => { name: string }) => void;
  }) => (
    <button type="button" onClick={() => setData((prev) => ({ ...prev, name: `${prev.name}!` }))}>
      type-in-name
    </button>
  ),
}));

jest.mock('@/hooks/useEntityLink', () => ({
  useEntityLink: () => ({
    linkedId: 'cont_1',
    setLinkedId: jest.fn(),
    getPayload: () => ({}),
    reset: jest.fn(),
    options: [],
    optionsLoading: false,
    linkCardKey: 'link',
    linkCardProps: {},
  }),
}));

jest.mock('@/components/navigation/config', () => ({
  NAVIGATION_ENTITIES: { company: { icon: () => null, color: '' } },
}));
jest.mock('@/components/shared/EntityLinkCard', () => ({ EntityLinkCard: () => null }));
jest.mock('@/components/shared/PolicyErrorBanner', () => ({ PolicyErrorBanner: () => null }));
jest.mock('@/services/companies.service', () => ({ getAllCompaniesForSelect: jest.fn(async () => []) }));
jest.mock('@/hooks/useProjectCreate', () => ({ useProjectCreate: () => ({ createProject: jest.fn() }) }));
jest.mock('@/hooks/useCompanyId', () => ({ useCompanyId: () => ({ companyId: 'comp_1' }) }));
jest.mock('@/hooks/useSpacingTokens', () => ({
  useSpacingTokens: () => ({ spaceBetween: { md: '' }, margin: { top: { md: '' } } }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/design-system', () => ({}));

import { GeneralProjectTab } from '../GeneralProjectTab';

type ProjectProp = React.ComponentProps<typeof GeneralProjectTab>['project'];

const PROJECT = {
  id: 'proj_1',
  name: 'Έργο Α',
  title: '',
  status: 'planning',
  companyName: 'Εταιρεία',
  companyId: 'comp_1',
  linkedCompanyId: 'cont_1',
  _v: 7,
} as unknown as ProjectProp;

/** Πολύ περισσότερο από κάθε debounce που υπήρξε (2 s) — ό,τι θα έγραφε «σε λίγο», θα είχε γράψει. */
const LONG_AFTER_ANY_DEBOUNCE_MS = 60_000;

function renderEditing() {
  let save: (() => void) | undefined;
  const onSetEditing = jest.fn();
  const view = render(
    <GeneralProjectTab
      project={PROJECT}
      isEditing
      onSetEditing={onSetEditing}
      registerSaveCallback={(saveFn) => { save = saveFn; }}
    />,
  );
  return { ...view, onSetEditing, save: () => save?.() };
}

describe('GeneralProjectTab — ρητή αποθήκευση (ADR-248 §2.5)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUpdateProjectWithPolicy.mockReset();
    mockUpdateProjectWithPolicy.mockResolvedValue({ success: true, _v: 8 });
    mockRunExistingProjectUpdate.mockReset();
    mockRunExistingProjectUpdate.mockImplementation(async (_payload: unknown, action: () => Promise<void>) => {
      await action();
      return { kind: 'done' };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Ε1 — αλλαγή πεδίου και πέρασμα χρόνου ΔΕΝ γράφουν στη βάση', () => {
    renderEditing();

    fireEvent.click(screen.getByText('type-in-name'));
    act(() => { jest.advanceTimersByTime(LONG_AFTER_ANY_DEBOUNCE_MS); });

    expect(mockUpdateProjectWithPolicy).not.toHaveBeenCalled();
    expect(mockRunExistingProjectUpdate).not.toHaveBeenCalled();
  });

  it('Ε2 — η αποχώρηση με αλλαγές ΔΕΝ γράφει (κανένα «flush on unmount»)', () => {
    const { unmount } = renderEditing();

    fireEvent.click(screen.getByText('type-in-name'));
    unmount();
    act(() => { jest.advanceTimersByTime(LONG_AFTER_ANY_DEBOUNCE_MS); });

    expect(mockUpdateProjectWithPolicy).not.toHaveBeenCalled();
  });

  it('Ε3 — η «Αποθήκευση» περνά από τον έλεγχο επιπτώσεων και γράφει ΜΙΑ φορά, με την έκδοση που φορτώθηκε', async () => {
    const { save, onSetEditing } = renderEditing();

    fireEvent.click(screen.getByText('type-in-name'));
    await act(async () => { await save(); });

    expect(mockRunExistingProjectUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateProjectWithPolicy).toHaveBeenCalledTimes(1);
    expect(mockUpdateProjectWithPolicy).toHaveBeenCalledWith({
      projectId: 'proj_1',
      updates: expect.objectContaining({ name: 'Έργο Α!', _v: 7 }),
    });
    expect(onSetEditing).toHaveBeenCalledWith(false);
  });
});
