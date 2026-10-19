/**
 * @jest-environment node
 *
 * ⚓ **Μονάδα μεγέθους panel** — στην `react-resizable-panels@4` ο σκέτος αριθμός είναι **pixels**, όχι ποσοστό
 * (`dist/react-resizable-panels.d.ts`: «Numeric values are assumed to be pixels»).
 *
 * 🔴 Μετρημένο 2026-10-19 (Διαχείριση Αρχείων, 2400px): `defaultSize={40} minSize={15}` / `{60} {25}` γράφτηκαν ως
 *   ποσοστά της v2/v3. Οι αρχικές στήλες έβγαιναν σωστές **κατά τύχη** (η βιβλιοθήκη κλιμακώνει αναλογικά 40+60 px), αλλά
 *   τα όρια ήταν 15px και 25px ⇒ Home ⇒ λίστα **15px**, End ⇒ προεπισκόπηση **25px**. Ίδιο λάθος σε `FilesPreviewSplit`
 *   και `ReconciliationPageContent`.
 *
 * Κανόνας: ποσοστό ⇒ `"40%"`· pixels ⇒ **ονομασμένη** σταθερά (`minSize={STAGE_MIN_WIDTH}`) ή αριθμός > 100. Ένα
 *   γυμνό `{40}` είναι αμφίσημο για τον αναγνώστη — και ήταν λάθος σε 3 από 3 σελίδες.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(__dirname, '..', '..', '..');
const SIZE_PROP = /\b(defaultSize|minSize|maxSize)=\{\s*(?:[^}]*\?\s*)?(\d+(?:\.\d+)?)\b/g;

function* tsxFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* tsxFiles(path);
    else if (name.endsWith('.tsx')) yield path;
  }
}

function ambiguousSizes(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(SIZE_PROP)) {
    const value = Number(match[2]);
    if (value > 0 && value <= 100) found.push(match[0]);
  }
  return found;
}

describe('panel size units (react-resizable-panels v4)', () => {
  it('ο φρουρός πιάνει το γυμνό ποσοστό — και αφήνει ό,τι είναι σαφές', () => {
    expect(ambiguousSizes('<ResizablePanel defaultSize={40} minSize={15}>')).toHaveLength(2);
    expect(ambiguousSizes('<ResizablePanel defaultSize={docked ? 45 : 100}>')).toHaveLength(1);
    expect(ambiguousSizes('<ResizablePanel defaultSize="40%" minSize={STAGE_MIN_WIDTH} maxSize={880} collapsedSize={0}>'))
      .toHaveLength(0);
  });

  it('κανένα αρχείο του src/ δεν δίνει μέγεθος panel ως γυμνό αριθμό ≤ 100', () => {
    const offenders = [...tsxFiles(SRC)].flatMap((file) =>
      ambiguousSizes(readFileSync(file, 'utf8')).map((hit) => `${relative(SRC, file)}: ${hit}`),
    );
    expect(offenders).toEqual([]);
  }, 60_000);
});
