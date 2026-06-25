// ============================================================================
// BIM SCHEDULE HOST — mount-gate tests
// HANDOFF_2026-06-25_selection-cascade-and-always-mounted-dialogs §3 #1 (Root B).
//
// The host owns the ribbon EventBus listener (always mounted) but must NOT run
// the O(n) scene scan / lookups while the dialog is closed — that body lives in
// BimScheduleContent, which mounts only when dialogProps.open === true.
// ============================================================================

import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { BimScheduleHost } from '../BimScheduleHost';

// ── Controllable dialog-open state ──────────────────────────────────────────
let mockOpen = false;
const openDialog = jest.fn();

jest.mock('../../hooks/useBimScheduleExport', () => ({
  useBimScheduleExport: () => ({
    openDialog,
    pendingRegionPick: false,
    dialogProps: { open: mockOpen, onOpenChange: jest.fn() },
    onRegionPickCommit: jest.fn(),
    onRegionPickCancel: jest.fn(),
  }),
}));

// Heavy body markers — must be invoked ONLY when the dialog is open.
const useCurrentSceneModel = jest.fn(() => null);
jest.mock('../../ui/text-toolbar/hooks/useCurrentSceneModel', () => ({
  useCurrentSceneModel: () => useCurrentSceneModel(),
}));

const useBimScheduleLookups = jest.fn(() => ({
  lookups: {}, availableFloors: [], availableCategories: [], availableBuildings: [],
}));
jest.mock('../../hooks/data/useBimScheduleLookups', () => ({
  useBimScheduleLookups: (...args: unknown[]) => useBimScheduleLookups(...args),
}));

jest.mock('../../ui/components/bim-schedule/BimScheduleDialog', () => ({
  BimScheduleDialog: () => <div data-testid="bim-schedule-dialog" />,
}));

// EventBus.on returns an unsubscribe fn; record subscriptions.
const ebOn = jest.fn(() => jest.fn());
jest.mock('../../systems/events/EventBus', () => ({
  EventBus: { on: (...args: unknown[]) => ebOn(...args) },
}));

afterEach(() => {
  cleanup();
  mockOpen = false;
  jest.clearAllMocks();
});

describe('BimScheduleHost — mount gate (closed = no heavy body)', () => {
  it('renders nothing and skips the scene scan while closed', () => {
    mockOpen = false;
    const { container, queryByTestId } = render(<BimScheduleHost selectionIds={[]} />);

    expect(container).toBeEmptyDOMElement();
    expect(queryByTestId('bim-schedule-dialog')).toBeNull();
    expect(useCurrentSceneModel).not.toHaveBeenCalled();
    expect(useBimScheduleLookups).not.toHaveBeenCalled();
  });

  it('still subscribes to the ribbon open event while closed (listener stays mounted)', () => {
    mockOpen = false;
    render(<BimScheduleHost selectionIds={[]} />);

    expect(ebOn).toHaveBeenCalledWith('bim:schedule-dialog-requested', openDialog);
  });

  it('mounts the dialog + runs the scene scan once open', () => {
    mockOpen = true;
    const { getByTestId } = render(<BimScheduleHost selectionIds={[]} />);

    expect(getByTestId('bim-schedule-dialog')).toBeInTheDocument();
    expect(useCurrentSceneModel).toHaveBeenCalled();
    expect(useBimScheduleLookups).toHaveBeenCalled();
  });
});
