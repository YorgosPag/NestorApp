/**
 * ADR-901 §14.8 — άγκυρα Α38: ΕΝΑΣ γραφέας σημάτων, και ΚΑΘΕ γραφέας της υπόθεσης τον ρωτά.
 *
 * Οι κανόνες κλείνουν τον **πελάτη** (`create/update/delete: if false`) — **όχι** το Admin SDK. Ένας δεύτερος γραφέας
 * σημάτων στον server θα μπορούσε να σημάνει όψη **έξω** από το ακροατήριο (διαρροή χρονισμού), και ένας γραφέας
 * της υπόθεσης που «ξέχασε» το σήμα αφήνει την οθόνη μπαγιάτικη μέχρι το F5 — το σύμπτωμα του Π5.
 * (Ο γραφέας συμμετοχών είναι φραγμένος **δομικά**: το σήμα είναι υποχρεωτική παράμετρος — δεν μεταγλωττίζεται χωρίς.)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(process.cwd(), 'src');
const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : files(full);
  return /\.(ts|tsx)$/.test(name) ? [full] : [];
});
const rel = (f: string) => relative(process.cwd(), f).replace(/\\/g, '/');
const ALL = files(SRC);
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/**
 * Η ΜΙΑ πηγή (`.view-signal-authority.json`) — την ίδια διαβάζει η πύλη pre-commit CHECK 3.99 (AST). Η άγκυρα μένει
 * ως δεύτερο, ανεξάρτητο **μέσο** μέτρησης (κείμενο αντί για AST) πάνω στην ίδια δήλωση — όχι ως δεύτερη λίστα.
 */
interface CaseWriterSpec {
  readonly calls: readonly string[];
  readonly min: number;
  readonly why: string;
}
interface ViewSignalAuthority {
  readonly writer: string;
  readonly clientRef: string;
  readonly caseWriters: Readonly<Record<string, CaseWriterSpec>>;
}
const REGISTRY = JSON.parse(read('.view-signal-authority.json')) as ViewSignalAuthority;
const WRITER = REGISTRY.writer;
const CLIENT_REF = REGISTRY.clientRef;
const callPattern = (spec: CaseWriterSpec) => new RegExp(spec.calls.map((name) => `\\b${name}\\(`).join('|'), 'g');

describe('Α38 — ο ΕΝΑΣ γραφέας σημάτων όψεων', () => {
  it('η συλλογή σημάτων ονομάζεται ΜΟΝΟ από τον γραφέα και την (μόνο-ανάγνωσης) αναφορά του client', () => {
    const users = ALL.filter((f) => readFileSync(f, 'utf8').includes('COLLECTIONS.CONVEYANCE_VIEW_SIGNALS')).map(rel).sort();
    expect(users).toEqual([CLIENT_REF, WRITER].sort());
  });

  it('η αναφορά του client ΔΕΝ γράφει ποτέ', () => {
    // Κλήσεις, όχι λέξεις: η κεφαλίδα του αρχείου ΟΝΟΜΑΖΕΙ το `setDoc` για να το απαγορεύσει.
    expect(read(CLIENT_REF)).not.toMatch(/\b(setDoc|updateDoc|deleteDoc|addDoc|writeBatch|runTransaction)\(/);
  });

  it('το έγγραφο σήματος γράφεται ΜΟΝΟ από τη `signalViewsInTx` (μία γραφή, merge + increment)', () => {
    const writes = read(WRITER).match(/\btx\.(set|update|create|delete)\(/g) ?? [];
    expect(writes).toEqual(['tx.set(']);
  });
});

describe('Α38 — ΚΑΘΕ γραφέας της υπόθεσης σημαίνει τις όψεις της', () => {
  it.each(Object.entries(REGISTRY.caseWriters))('%s', (path, spec) => {
    const calls = read(path).match(callPattern(spec))?.length ?? 0;
    expect({ path, calls: Math.min(calls, spec.min) }).toEqual({ path, calls: spec.min });
  });
});
