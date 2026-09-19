/**
 * Α38.2 · Α38.3 — ADR-866 §2.10 Β2 · Β3 · Π3: πόσο ζει ένα toast, με ποιο θέμα, και ένα toast ανά ταυτότητα.
 *
 * 🔴 Ζωντανή επαλήθευση 2026-09-19: το «Αρχειοθετήθηκε · **Αναίρεση**» χανόταν σε 4″ (ίδια προεπιλογή με ένα απλό
 * «αποθηκεύτηκε») και ήταν **φωτεινό** μέσα στο σκοτεινό θέμα (`rgb(255,255,255)` μετρημένο στο DOM).
 *
 * Τρέχει ο **πραγματικός** `NotificationProvider`· κόβονται μόνο το sonner (για να δούμε τι του ζητείται), το
 * `next-themes` (για να ορίσουμε το θέμα) και το i18n.
 */

const toastMock = jest.fn();
const toasterProps: Array<Record<string, unknown>> = [];

jest.mock('sonner', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
  Toaster: (props: Record<string, unknown>) => { toasterProps.push(props); return null; },
}));
jest.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
jest.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/i18n/config', () => ({ __esModule: true, default: { exists: () => false, t: (key: string) => key } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import React from 'react';
import { act, render } from '@testing-library/react';
import { NotificationProvider, useNotifications } from '../NotificationProvider';
import { PERSISTENT_TOAST, resolveToastDuration, toasterThemeOf } from '../notification-policy';
import type { NotificationContextValue } from '@/types/notifications';

describe('Α38.2 — resolveToastDuration (καθαρό)', () => {
  it.each([
    ['ρητό 0 ⇒ μόνιμο', 0, false, PERSISTENT_TOAST],
    ['ρητή διάρκεια κερδίζει, ακόμη και με ενέργεια', 6000, true, 6000],
    ['ενέργεια χωρίς διάρκεια ⇒ μόνιμο (Material 3)', undefined, true, PERSISTENT_TOAST],
    ['χωρίς ενέργεια ⇒ προεπιλογή', undefined, false, 4000],
  ] as const)('%s', (_label, requested, hasAction, expected) => {
    expect(resolveToastDuration(requested, hasAction, 4000)).toBe(expected);
  });

  it('θέμα: dark/light αυτούσια · άγνωστο ⇒ system', () => {
    expect([toasterThemeOf('dark'), toasterThemeOf('light'), toasterThemeOf(undefined)]).toEqual(['dark', 'light', 'system']);
  });
});

function renderProvider(): () => NotificationContextValue {
  let api: NotificationContextValue | null = null;
  function Probe() { api = useNotifications(); return null; }
  render(<NotificationProvider><Probe /></NotificationProvider>);
  return () => {
    if (!api) throw new Error('provider not mounted');
    return api;
  };
}

function lastToastOptions(): { duration?: number; id?: string } {
  const call = toastMock.mock.calls[toastMock.mock.calls.length - 1] as [string, { duration?: number; id?: string }];
  return call[1];
}

describe('Α38.2 — ο provider: toast με ενέργεια ΜΕΝΕΙ · ρητή ταυτότητα ⇒ αντικατάσταση', () => {
  beforeEach(() => { toastMock.mockClear(); toasterProps.length = 0; });

  it('«Αναίρεση» χωρίς διάρκεια ⇒ μόνιμο· απλό μήνυμα ⇒ 4000 ms', () => {
    const api = renderProvider();
    act(() => { api().success('archived', { actions: [{ label: 'undo', onClick: jest.fn() }] }); });
    expect(lastToastOptions().duration).toBe(PERSISTENT_TOAST);
    act(() => { api().success('saved'); });
    expect(lastToastOptions().duration).toBe(4000);
  });

  it('ίδιο μήνυμα με ρητό id δύο φορές ⇒ ΔΥΟ κλήσεις (ίδιο id, αντικατάσταση) — χωρίς id ο περιοριστής κόβει τη 2η', () => {
    const api = renderProvider();
    act(() => { api().success('archived', { id: 'dossier-lifecycle-pdos_1' }); });
    act(() => { api().success('archived', { id: 'dossier-lifecycle-pdos_1' }); });
    expect(toastMock.mock.calls.map(([, options]) => (options as { id?: string }).id))
      .toEqual(['dossier-lifecycle-pdos_1', 'dossier-lifecycle-pdos_1']);
    toastMock.mockClear();
    act(() => { api().success('plain'); });
    act(() => { api().success('plain'); });
    expect(toastMock).toHaveBeenCalledTimes(1);
  });
});

describe('Α38.3 — το Toaster ακολουθεί το θέμα της εφαρμογής', () => {
  it('σκοτεινό θέμα ⇒ theme="dark"', () => {
    toasterProps.length = 0;
    renderProvider();
    expect(toasterProps[toasterProps.length - 1]?.theme).toBe('dark');
  });
});
