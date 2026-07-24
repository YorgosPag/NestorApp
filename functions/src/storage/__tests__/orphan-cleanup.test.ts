/**
 * ADR-694 Α1 — ο **αρχιτεκτονικός** έλεγχος: το real-time μονοπάτι (`onStorageFinalize`)
 * δεν επιτρέπεται να διαγράψει αρχείο, ποτέ, για κανέναν λόγο.
 *
 * Γιατί source-level guard και όχι μόνο behavioural test: η προηγούμενη έκδοση ήταν
 * *σωστά γραμμένη* — απλώς απαντούσε σε λάθος ερώτηση, και το λάθος ήταν **μία γραμμή**
 * (`await bucket.file(filePath).delete()`). Ένα behavioural test θα το έπιανε μόνο αν
 * κάποιος θυμόταν να γράψει το σενάριο. Αυτό εδώ το πιάνει ό,τι κι αν συμβεί, γιατί
 * κλειδώνει την **ιδιότητα**: σε αυτό το αρχείο δεν υπάρχει δρόμος προς διαγραφή Storage.
 *
 * Ο μόνος επιτρεπτός destructive δρόμος ζει στο `orphan-sweeper.ts`, με 4 φράγματα.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const CLEANUP_SOURCE = readFileSync(join(__dirname, '..', 'orphan-cleanup.ts'), 'utf8');

/** Οι κώδικες που διαγράφουν αντικείμενο Storage μέσω Admin SDK. */
const STORAGE_DELETE_PATTERNS: readonly RegExp[] = [
  /bucket\s*\(\s*\)\s*\.\s*file\s*\(/,
  /\.\s*file\s*\([^)]*\)\s*\.\s*delete\s*\(/,
  /admin\s*\.\s*storage\s*\(/,
];

describe('orphan-cleanup — μηδέν διαγραφή Storage στο real-time μονοπάτι (ADR-694 Α1)', () => {
  it.each(STORAGE_DELETE_PATTERNS.map((p) => [p.source, p] as const))(
    '🔴 ΔΕΝ περιέχει δρόμο διαγραφής Storage: /%s/',
    (_label, pattern) => {
      // Αφαιρούμε τα σχόλια: το header ΠΕΡΙΓΡΑΦΕΙ την παλιά συμπεριφορά, δεν την εκτελεί.
      const code = CLEANUP_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(pattern);
    },
  );

  it('δεν εισάγει καν το storage handle του Admin SDK', () => {
    const code = CLEANUP_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/const\s+storage\s*=/);
  });

  it('περνά από το custody SSoT — δεν ξανα-υλοποιεί ownership λογική', () => {
    expect(CLEANUP_SOURCE).toMatch(/from\s+'\.\/storage-path-custody'/);
  });
});

describe('candidateDocId — σταθερό, idempotent, έγκυρο ως Firestore doc id', () => {
  // Το import γίνεται εδώ ώστε τα mocks να είναι ενεργά πριν αποτιμηθεί το module scope.
  const load = (): typeof import('../orphan-cleanup') => {
    jest.doMock('firebase-functions', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      runWith: () => ({ storage: { object: () => ({ onFinalize: (f: unknown) => f }) } }),
    }));
    jest.doMock('firebase-admin', () => ({ firestore: () => ({}) }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('../orphan-cleanup');
  };

  const PATH = 'companies/c1/bim-material-textures/bmat_34929e3b/albedo.jpg';

  it('ποτέ δεν παράγει «/» (απαγορευμένο σε doc id)', () => {
    expect(load().candidateDocId(PATH)).not.toContain('/');
  });

  it('ίδιο path → ίδιο id (idempotent — το re-upload ενημερώνει, δεν πολλαπλασιάζει)', () => {
    const { candidateDocId } = load();
    expect(candidateDocId(PATH)).toBe(candidateDocId(PATH));
  });

  it('διαφορετικά paths → διαφορετικά ids', () => {
    const { candidateDocId } = load();
    expect(candidateDocId(PATH)).not.toBe(candidateDocId(`${PATH}x`));
  });

  it('τα δύο κανάλια του ΙΔΙΟΥ υλικού είναι ξεχωριστοί υποψήφιοι', () => {
    const { candidateDocId } = load();
    const albedo = 'companies/c1/bim-material-textures/bmat_1/albedo.jpg';
    const normal = 'companies/c1/bim-material-textures/bmat_1/normal.png';
    expect(candidateDocId(albedo)).not.toBe(candidateDocId(normal));
  });
});
