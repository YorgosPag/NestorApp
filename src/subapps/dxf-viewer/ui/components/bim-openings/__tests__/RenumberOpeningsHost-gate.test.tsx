// ============================================================================
// RENUMBER OPENINGS HOST — mount-gate tests
// HANDOFF_2026-06-25_selection-cascade-and-always-mounted-dialogs §3 #1 (Root B).
//
// The host owns the ribbon EventBus listener + Firestore row load (always
// mounted) but must NOT build the i18n prefix map / confirm wiring while the
// dialog is closed — that body lives in RenumberOpeningsContent, which mounts
// only after the ribbon event flips `open` to true.
// ============================================================================

import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { RenumberOpeningsHost } from '../RenumberOpeningsHost';

// Inner-body marker: useTranslation must be invoked ONLY when the dialog mounts.
const useTranslation = jest.fn(() => ({ t: (k: string) => k }));
jest.mock('react-i18next', () => ({ useTranslation: () => useTranslation() }));

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(),
  query: jest.fn(), where: jest.fn(),
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { companyId: 'company-1', uid: 'user-1' } }),
}));

jest.mock('../../../../systems/levels', () => ({
  useLevels: () => ({
    levels: [], currentLevelId: null, getLevelScene: jest.fn(), setLevelScene: jest.fn(),
  }),
}));

const ebOn = jest.fn(() => jest.fn());
jest.mock('../../../../systems/events/EventBus', () => ({
  EventBus: { on: (...args: unknown[]) => ebOn(...args) },
}));

jest.mock('../../../../core/commands', () => ({ getGlobalCommandHistory: jest.fn() }));
jest.mock('../../../../core/commands/entity-commands/RenumberOpeningsCommand', () => ({
  RenumberOpeningsCommand: jest.fn(),
}));
jest.mock('../../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: jest.fn(),
}));

jest.mock('../RenumberOpeningsDialog', () => ({
  RenumberOpeningsDialog: () => <div data-testid="renumber-openings-dialog" />,
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('RenumberOpeningsHost — mount gate (closed = no heavy body)', () => {
  it('renders nothing and skips the i18n body while closed', () => {
    const { container, queryByTestId } = render(
      <RenumberOpeningsHost projectId="p1" floorplanId="f1" />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(queryByTestId('renumber-openings-dialog')).toBeNull();
    expect(useTranslation).not.toHaveBeenCalled();
  });

  it('still subscribes to the ribbon open event while closed (listener stays mounted)', () => {
    render(<RenumberOpeningsHost projectId="p1" floorplanId="f1" />);

    expect(ebOn).toHaveBeenCalledWith('bim:opening-renumber-requested', expect.any(Function));
  });

  it('renders null when scope is missing (no company/project/floorplan)', () => {
    const { container } = render(
      <RenumberOpeningsHost projectId={null} floorplanId={null} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(useTranslation).not.toHaveBeenCalled();
  });
});
