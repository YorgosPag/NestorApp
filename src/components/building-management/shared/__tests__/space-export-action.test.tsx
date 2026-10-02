/**
 * Η εξαγωγή των καρτελών κτιρίου (ADR-898 Φ4β): **κανένα κουμπί που δεν κάνει τίποτα** (χωρίς ενέργεια ⇒ κανένα κουμπί),
 * **ποτέ σιωπηλό κλικ** (busy ⇒ δεν ξαναπατιέται · αποτυχία ⇒ λόγος στην οθόνη).
 */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';

import { BuildingSpaceFilterBar } from '../BuildingSpaceFilterBar';
import { SpaceExportButton } from '../SpaceExportButton';
import { useExportAction } from '../useExportAction';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-5 w-5', numeric: { xs: 12, sm: 16, md: 20 } }),
}));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ text: { muted: 'muted' }, bg: { primary: 'bg' } }),
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const FILTER = { value: 'all' as const, onChange: () => undefined, options: [], allLabel: 'all' };

function drawBar(exportAction?: { status: 'idle' | 'busy' | 'failed'; trigger: () => void }) {
  render(
    <BuildingSpaceFilterBar
      searchPlaceholder="search"
      searchTerm=""
      onSearchChange={() => undefined}
      typeFilter={FILTER}
      statusFilter={FILTER}
      exportAction={exportAction}
    />,
  );
}

function Harness({ run }: { readonly run: () => Promise<void> }) {
  return <SpaceExportButton action={useExportAction(run)} />;
}

describe('BuildingSpaceFilterBar — κουμπί εξαγωγής', () => {
  it('χωρίς `exportAction` ⇒ ΚΑΝΕΝΑ κουμπί (ως τις 2026-10-02 ήταν ετικέτα χωρίς `onClick`)', () => {
    drawBar();
    expect(screen.queryByRole('button', { name: 'spaceExport.button' })).toBeNull();
  });

  it('με `exportAction` ⇒ το κλικ καλεί την εξαγωγή', () => {
    const trigger = jest.fn();
    drawBar({ status: 'idle', trigger });
    fireEvent.click(screen.getByRole('button', { name: 'spaceExport.button' }));
    expect(trigger).toHaveBeenCalledTimes(1);
  });
});

describe('useExportAction + SpaceExportButton', () => {
  it('όσο γράφεται το αρχείο: «Εξαγωγή…», απενεργό — δεύτερο κλικ ΔΕΝ βγάζει δεύτερο αρχείο', async () => {
    let finish: () => void = () => undefined;
    const run = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<Harness run={run} />);
    fireEvent.click(screen.getByRole('button', { name: 'spaceExport.button' }));
    const busy = screen.getByRole('button', { name: 'spaceExport.busy' });
    expect(busy).toHaveProperty('disabled', true);
    fireEvent.click(busy);
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(screen.getByRole('button', { name: 'spaceExport.button' })).toHaveProperty('disabled', false);
  });

  it('αποτυχία ⇒ λόγος στην οθόνη (`role="alert"`), και το κουμπί ξαναδοκιμάζεται', async () => {
    const run = jest.fn(() => Promise.reject(new Error('quota')));
    render(<Harness run={run} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'spaceExport.button' }));
    });
    expect(screen.getByRole('alert').textContent).toBe('spaceExport.failed');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'spaceExport.button' }));
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('δύο `trigger` στη σειρά (π.χ. Enter + κλικ πριν ξαναζωγραφιστεί) ⇒ ΕΝΑ αρχείο — φρένο και πέρα από το `disabled`', async () => {
    let finish: () => void = () => undefined;
    const run = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useExportAction(run));
    act(() => {
      result.current.trigger();
      result.current.trigger();
    });
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });
});

