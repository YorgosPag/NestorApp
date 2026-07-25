/**
 * Anchor — ProjectLandownersTab submit gate (Ε-15 regression guard).
 *
 * MEASURED DEFECT (browser, 2/2): with zero landowners the «Αποθήκευση» button
 * was enabled, the click reached the DOM, and `handleSave` returned on its first
 * line — no request, no toast, no error. A bartex-only change was silently lost.
 *
 * ROOT: the button's `disabled` expression and `handleSave`'s guard were derived
 * SEPARATELY (`!(canSave && isDirty) && owners.length > 0` vs `!canSave`), and
 * `canSave` used `isOwnersValid`, which rejects `[]` — even though this tab
 * renders `OwnersList` with `allowEmpty`.
 *
 * These tests pin the INVARIANT, not the implementation:
 *   the button is enabled  ⇔  clicking it performs a save.
 *
 * @module components/projects/tabs/__tests__/project-landowners-save-gate
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { PropertyOwnerEntry } from '@/types/ownership-table';

// ── Mocks ────────────────────────────────────────────────────────────────────
// Only the save gateway is asserted on; everything else is stubbed so the test
// stays hermetic and fast.

const mockUpdateProjectWithPolicy = jest.fn();

jest.mock('@/services/projects/project-mutation-gateway', () => ({
  updateProjectWithPolicy: (...args: unknown[]) => mockUpdateProjectWithPolicy(...args),
}));

jest.mock('@/hooks/useGuardedLandownersSave', () => ({
  // Pass-through: the impact-preview guard is NOT what this anchor is about.
  useGuardedLandownersSave: () => ({
    ImpactDialog: null,
    runSaveOperation: (_req: unknown, action: () => Promise<void>) => action(),
  }),
}));

jest.mock('@/hooks/useLandownerUnlinkGuard', () => ({
  useLandownerUnlinkGuard: () => ({
    checkBeforeRemove: jest.fn(),
    resetCheck: jest.fn(),
  }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: '', md: '' }),
}));

jest.mock('@/hooks/useTypography', () => ({
  useTypography: () => ({ body: { sm: '' }, heading: { md: '' }, label: { sm: '' } }),
}));

jest.mock('@/design-system/color-bridge', () => ({
  COLOR_BRIDGE: { text: { muted: '' } },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.ComponentProps<'label'>) => (
    <label {...props}>{children}</label>
  ),
}));

jest.mock('@/components/shared/owners/LandownerRemovalDialog', () => ({
  LandownerRemovalDialog: () => null,
}));

// OwnersList is the SSoT list component; here it only has to report how many
// owners it was handed, so the gate can be exercised for empty / non-empty.
jest.mock('@/components/shared/owners/OwnersList', () => ({
  OwnersList: ({ owners }: { owners: PropertyOwnerEntry[] }) => (
    <div data-testid="owners-list">{owners.length}</div>
  ),
}));

import { ProjectLandownersTab } from '@/components/projects/tabs/ProjectLandownersTab';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj_test_0001';

function renderTab(projectOverrides: Record<string, unknown> = {}) {
  return render(
    <ProjectLandownersTab
      project={{ id: PROJECT_ID, name: 'test project', ...projectOverrides }}
    />,
  );
}

/** The one button rendered by the tab footer. */
function saveButton(): HTMLButtonElement {
  return screen.getByRole('button') as HTMLButtonElement;
}

/** The bartex percentage field. */
function bartexInput(): HTMLInputElement {
  return screen.getByRole('spinbutton') as HTMLInputElement;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateProjectWithPolicy.mockResolvedValue({ success: true });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ProjectLandownersTab — submit gate', () => {
  describe('bartex-only save with ZERO landowners (the Ε-15 defect)', () => {
    it('enables the button once the bartex percentage changes', () => {
      renderTab({ landowners: null, bartexPercentage: null });
      expect(screen.getByTestId('owners-list')).toHaveTextContent('0');

      fireEvent.change(bartexInput(), { target: { value: '32.5' } });

      expect(saveButton()).toBeEnabled();
    });

    it('actually persists the bartex percentage when clicked', async () => {
      renderTab({ landowners: null, bartexPercentage: null });

      fireEvent.change(bartexInput(), { target: { value: '32.5' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(mockUpdateProjectWithPolicy).toHaveBeenCalledTimes(1));
      expect(mockUpdateProjectWithPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: PROJECT_ID,
          updates: expect.objectContaining({ bartexPercentage: 32.5, landowners: null }),
        }),
      );
    });
  });

  describe('the affordance never lies', () => {
    it('disables the button when there is nothing to save', () => {
      renderTab({ landowners: null, bartexPercentage: null });
      // Before the fix this button was ENABLED while announcing "no changes".
      expect(saveButton()).toBeDisabled();
    });

    it('does not save when clicked with no changes', async () => {
      renderTab({ landowners: null, bartexPercentage: null });

      fireEvent.click(saveButton());

      await Promise.resolve();
      expect(mockUpdateProjectWithPolicy).not.toHaveBeenCalled();
    });

    it('keeps the button disabled while a landowner has no contact selected', () => {
      renderTab({
        landowners: [{ contactId: '', name: '', landOwnershipPct: 100, allocatedShares: 1000 }],
        bartexPercentage: null,
      });

      fireEvent.change(bartexInput(), { target: { value: '10' } });

      // An incomplete owner row must still block the save — the fix relaxes the
      // EMPTY case only, not validation as a whole.
      expect(saveButton()).toBeDisabled();
    });
  });

  describe('existing behaviour still holds', () => {
    it('saves a fully specified landowner', async () => {
      renderTab({
        landowners: [
          { contactId: 'c1', name: 'Owner One', landOwnershipPct: 100, allocatedShares: 1000 },
        ],
        bartexPercentage: 10,
      });

      fireEvent.change(bartexInput(), { target: { value: '25' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(mockUpdateProjectWithPolicy).toHaveBeenCalledTimes(1));
      expect(mockUpdateProjectWithPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          updates: expect.objectContaining({
            bartexPercentage: 25,
            landownerContactIds: ['c1'],
          }),
        }),
      );
    });
  });
});
