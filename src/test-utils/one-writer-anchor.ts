/**
 * @fileoverview **Άγκυρα «ένας γραφέας»** — ο κοινός σαρωτής για πεδία που οι κανόνες κλείνουν στον πελάτη αλλά το Admin SDK
 *   **δεν** βλέπει (ADR-915 Φ3 `documentFacts` · ADR-916 Φ-Δ.4 `handoverDecision`).
 * @module test-utils/one-writer-anchor
 *
 * Οι κανόνες κλείνουν τον **πελάτη**. Ένας δεύτερος γραφέας στον διακομιστή θα περνούσε κάθε κανόνα. Εδώ ζει το **ένα**
 * «γράφει αυτό το κείμενο το πεδίο μέσα σε όρισμα κλήσης γραφής;» — κάθε άγκυρα δίνει μόνο το πεδίο και τον γραφέα της.
 *
 * ⚠️ **Δηλωμένο όριο**: πιάνει τα κυριολεκτικά (`πεδίο:` · `[ΣΤΑΘΕΡΑ]:`)· ένα κλειδί χτισμένο σε μεταβλητή μένει αόρατο.
 */

import { execFileSync } from 'child_process';
import { join } from 'path';

export const REPO_ROOT = join(__dirname, '..', '..');

/** Κλήσεις γραφής Firestore και το κοντινό τους φορτίο. */
const WRITE_CALL = /\b(?:update|set|create|updateDoc|setDoc)\s*\(/g;
const WINDOW = 400;

/** Το μοτίβο κλειδιού για ένα πεδίο: `πεδίο:` ή `[ΣΤΑΘΕΡΑ]:`. */
export function writeKeyPattern(field: string, constantName: string): RegExp {
  return new RegExp(String.raw`(?:\b${field}\s*:|\[\s*${constantName}\s*\]\s*:)`);
}

/** Γράφει αυτό το κείμενο το πεδίο μέσα σε όρισμα κλήσης γραφής; */
export function writesKeyIn(source: string, key: RegExp): boolean {
  for (const match of source.matchAll(WRITE_CALL)) {
    const start = (match.index ?? 0) + match[0].length;
    if (key.test(source.slice(start, start + WINDOW))) return true;
  }
  return false;
}

/** Μόνο τα αρχεία κώδικα που **αναφέρουν** κάποιον όρο — `git grep` (tracked + untracked), χωρίς τα tests. */
export function codeSourcesMentioning(terms: readonly string[]): string[] {
  const out = execFileSync('git', ['grep', '-l', '--untracked', ...terms.flatMap((term) => ['-e', term]), '--', 'src'], {
    cwd: REPO_ROOT, encoding: 'utf8',
  });
  return out.split('\n').filter((file) => /\.tsx?$/.test(file) && !/__tests__|\.test\.|\.spec\.|test-utils\//.test(file));
}
