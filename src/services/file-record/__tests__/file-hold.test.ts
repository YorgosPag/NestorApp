/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α36 του ADR-864 §19** — ένας κριτής δέσμευσης αρχείου, και οι διαδρομές διαγραφής τον ρωτούν.
 *
 * 🔴 Περιστατικό (μετρημένο 2026-09-17): το `gdpr-delete` έγραφε `data.hold.type !== 'none'` ενώ το `hold` είναι
 * **string** ⇒ `'none'.type` = `undefined` ≠ `'none'` ⇒ **κάθε** αρχείο με ρητό `hold: 'none'` κρινόταν «σε δέσμευση»
 * και **δεν σβηνόταν ποτέ** — υπερ-διατήρηση προσωπικών δεδομένων μέσα στη διαδρομή του δικαιώματος διαγραφής.
 *
 * | Άγκυρα | Μετάλλαξη που πιάνει |
 * |---|---|
 * | `none` / απουσία ⇒ **όχι** δέσμευση · `legal` ⇒ δέσμευση · μελλοντική διατήρηση ⇒ δέσμευση | επαναφορά `.hold.type` |
 * | οι διαδρομές διαγραφής **δεν** ξαναγράφουν τον έλεγχο τοπικά | inline `data.hold` σε route |
 */

import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('@/lib/firebaseAdmin', () => ({}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { isFileHeld } = require('../file-purge-helpers') as typeof import('../file-purge-helpers');
/* eslint-enable @typescript-eslint/no-require-imports */

describe('🏆 Α36 — ο κριτής δέσμευσης', () => {
  it('🔴 `hold: none` ή χωρίς hold ⇒ ΔΕΝ δεσμεύεται (το περιστατικό του gdpr-delete)', () => {
    expect(isFileHeld({ hold: 'none' })).toBe(false);
    expect(isFileHeld({})).toBe(false);
  });

  it('🔑 παρονομαστής: νομική δέσμευση ή μελλοντική διατήρηση ⇒ δεσμεύεται', () => {
    expect(isFileHeld({ hold: 'legal' })).toBe(true);
    expect(isFileHeld({ retentionUntil: '2999-01-01T00:00:00.000Z' })).toBe(true);
    expect(isFileHeld({ retentionUntil: '2000-01-01T00:00:00.000Z' })).toBe(false);
  });

  it.each([
    'src/app/api/files/gdpr-delete/route.ts',
    'src/app/api/files/purge/route.ts',
  ])('🔴 %s ρωτά τον ΕΝΑ κριτή — κανένας τοπικός έλεγχος `data.hold`', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    expect(source).toContain('isFileHeld(data)');
    expect(source).not.toMatch(/data\.hold\b/);
  });
});
