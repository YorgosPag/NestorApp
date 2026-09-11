/**
 * @fileoverview **Τα modes της σελίδας ενεργειών email** — φρουρός + πλήρεις πίνακες (ADR-850).
 * @related auth/components/auth-action-modes.ts
 *
 * 🔴 Η σοβαρή άγκυρα είναι η **Μ3**: κάθε κλειδί των πινάκων **υπάρχει και στις δύο
 * γλώσσες**. Ένα mode με τίτλο που δεν μεταφράστηκε θα έβγαζε **ωμό κλειδί** στη σελίδα
 * όπου ο άνθρωπος φτάνει από email — χωρίς άλλη πληροφορία.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ACTION_PENDING_KEYS,
  ACTION_SUCCESS_KEYS,
  ACTION_TITLE_KEYS,
  AUTH_ACTION_MODES,
  parseAuthActionMode,
} from '../auth-action-modes';

const LOCALES_DIR = join(__dirname, '..', '..', '..', 'i18n', 'locales');

function readAuthLocale(language: 'el' | 'en'): Record<string, unknown> {
  return JSON.parse(readFileSync(join(LOCALES_DIR, language, 'auth.json'), 'utf8')) as Record<string, unknown>;
}

function resolveKey(root: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (
    typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined
  ), root);
}

describe('Μ — το λεξιλόγιο των modes', () => {
  it('Μ1 — τα τέσσερα της Firebase, ΜΑΖΙ με το `verifyAndChangeEmail` που λείπει από την τεκμηρίωσή της', () => {
    expect([...AUTH_ACTION_MODES]).toEqual([
      'verifyEmail', 'resetPassword', 'recoverEmail', 'verifyAndChangeEmail',
    ]);
  });

  it('🔑 Μ2 — φρουρός, όχι cast: άγνωστο ή κενό ⇒ `null`', () => {
    expect(parseAuthActionMode('verifyAndChangeEmail')).toBe('verifyAndChangeEmail');
    expect(parseAuthActionMode('signIn')).toBeNull();
    expect(parseAuthActionMode(null)).toBeNull();
  });

  it.each(['el', 'en'] as const)('🔴 Μ3 — «%s»: ΚΑΘΕ κλειδί των πινάκων υπάρχει ως κείμενο', (language) => {
    const locale = readAuthLocale(language);
    for (const table of [ACTION_TITLE_KEYS, ACTION_SUCCESS_KEYS, ACTION_PENDING_KEYS]) {
      for (const mode of AUTH_ACTION_MODES) {
        expect(typeof resolveKey(locale, table[mode])).toBe('string');
      }
    }
  });
});
