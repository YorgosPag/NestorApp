/**
 * ADR-367 §2.7 — ποια πρόταση λέει η κεφαλίδα για τις αλλαγές του ανθρώπου.
 *
 * Το σφάλμα που ΔΕΝ επιτρέπεται: «Όλες οι αλλαγές αποθηκεύτηκαν» ενώ κάτι εκκρεμεί, ή ενώ δεν
 * υπάρχει σύνδεση. Το «saved» ανήκει ΜΟΝΟ στη μετάβαση «εκκρεμούσε → έφυγε».
 */

jest.mock('@/lib/firebase', () => ({ __esModule: true, db: {}, default: {} }));
jest.mock('@/hooks/useConnectivity', () => ({ useConnectivity: () => true }));

import { deriveSaveStatus, type SaveStatus } from '../useSaveStatus';

const ALL: SaveStatus[] = ['idle', 'saving', 'saved', 'offline', 'offline-pending'];

describe('deriveSaveStatus', () => {
  it.each(ALL)('εκκρεμεί + σύνδεση → saving (από %s)', (previous) => {
    expect(deriveSaveStatus({ pending: true, connected: true }, previous)).toBe('saving');
  });

  it.each(ALL)('εκκρεμεί + ΧΩΡΙΣ σύνδεση → offline-pending (από %s)', (previous) => {
    expect(deriveSaveStatus({ pending: true, connected: false }, previous)).toBe('offline-pending');
  });

  it.each(ALL)('τίποτα σε αναμονή + ΧΩΡΙΣ σύνδεση → offline, ΠΟΤΕ saved (από %s)', (previous) => {
    expect(deriveSaveStatus({ pending: false, connected: false }, previous)).toBe('offline');
  });

  it.each<SaveStatus>(['saving', 'offline-pending', 'saved'])(
    'μόλις άδειασε η ουρά με σύνδεση → saved (από %s)',
    (previous) => {
      expect(deriveSaveStatus({ pending: false, connected: true }, previous)).toBe('saved');
    },
  );

  it.each<SaveStatus>(['idle', 'offline'])(
    'τίποτα δεν εκκρεμούσε → idle, όχι ψεύτικο «αποθηκεύτηκαν» (από %s)',
    (previous) => {
      expect(deriveSaveStatus({ pending: false, connected: true }, previous)).toBe('idle');
    },
  );
});
