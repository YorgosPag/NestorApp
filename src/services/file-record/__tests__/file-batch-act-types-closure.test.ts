/**
 * @jest-environment node
 *
 * =============================================================================
 * 🧵 ΑΓΚΥΡΑ — ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ ΣΥΡΜΑΤΟΣ ΔΕΝ ΣΕΡΝΕΙ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ (ADR-744 · ADR-920 §14.12)
 * =============================================================================
 *
 * Το `file-batch-act.types.ts` το διαβάζει ο **πελάτης** (`file-mutation-gateway`). Ως τις 2026-11-24 έκανε
 * `import type` από το `listing-media-refresh` (`server-only`), και ο περιπατητής του κελύφους (CHECK 3.34), που ακολουθεί
 * και τις εισαγωγές τύπου, έφτανε από την οθόνη των προσφορών ως το `lib/geo/greek-grid`.
 *
 * | # | ερώτημα | μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Κ1 | υπάρχει πληθυσμός να φυλαχτεί; | η άγκυρα πράσινη επειδή δεν βρήκε εισαγωγές να κρίνει |
 * | Κ2 | φτάνει η κλειστότητα του συμβολαίου σε module με `import 'server-only'`; | επιστροφή του `import type` στη μηχανή |
 * | Κ3 | είναι το φύλλο των εκβάσεων πράγματι φύλλο; | εισαγωγή (και τύπου) μέσα στο `listing-publish-outcome.types` |
 *
 * ⚠️ Ακολουθεί **κάθε** `import` / `export … from` — και τα `import type`: αυτό ακριβώς κάνει ο περιπατητής που ξεγελάστηκε.
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

const SRC = join(__dirname, '..', '..', '..');
const ROOT = join(SRC, 'services', 'file-record', 'file-batch-act.types.ts');
const OUTCOME_LEAF = join(SRC, 'services', 'listings', 'listing-publish-outcome.types.ts');

/** `import … from 'x'` · `export … from 'x'` (και πολύγραμμα) · σκέτο `import 'x'`. Ποτέ literal μέσα σε δήλωση τύπου. */
const SPECIFIER = /(?:^|\n)\s*(?:(?:import|export)\s[^;'"]*?\bfrom\s*|import\s*)['"]([^'"]+)['"]/g;
const SERVER_ONLY = /(?:^|\n)\s*import\s+['"]server-only['"]/;

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*/g, '$1 ');
}

function specifiersOf(file: string): string[] {
  const text = withoutComments(readFileSync(file, 'utf8'));
  const found: string[] = [];
  SPECIFIER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SPECIFIER.exec(text)) !== null) found.push(match[1]);
  return found;
}

/** Το αρχείο του δικού μας δέντρου στο οποίο λύνει ένας specifier — `null` για πακέτα. */
function resolveLocal(specifier: string, from: string): string | null {
  const base = specifier.startsWith('@/') ? join(SRC, specifier.slice(2))
    : specifier.startsWith('.') ? join(dirname(from), specifier) : null;
  if (base === null) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function closureOf(root: string): string[] {
  const seen = new Set<string>([root]);
  const queue = [root];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    for (const specifier of specifiersOf(file)) {
      const target = resolveLocal(specifier, file);
      if (target !== null && !seen.has(target)) { seen.add(target); queue.push(target); }
    }
  }
  return [...seen];
}

const relative = (file: string) => file.slice(SRC.length + 1).replace(/\\/g, '/');

describe('το συμβόλαιο της δέσμης αρχείων — κλειστότητα εισαγωγών', () => {
  const closure = closureOf(ROOT);

  it('Κ1 — υπάρχει πληθυσμός: το συμβόλαιο εισάγει το φύλλο των εκβάσεων', () => {
    expect(closure.map(relative)).toContain(relative(OUTCOME_LEAF));
  });

  it('Κ2 — 🔴 κανένα module της κλειστότητας δεν είναι `server-only`', () => {
    const guilty = closure.filter((file) => SERVER_ONLY.test(withoutComments(readFileSync(file, 'utf8')))).map(relative);
    expect(guilty).toEqual([]);
  });

  it('Κ3 — το φύλλο των εκβάσεων δεν εισάγει τίποτα, ούτε τύπο', () => {
    expect(specifiersOf(OUTCOME_LEAF)).toEqual([]);
  });

  it('ο ανιχνευτής βλέπει `import type` και `server-only` (αλλιώς το Κ2 είναι πράσινο επειδή δεν κοίταξε)', () => {
    expect(specifiersOf(ROOT)).toContain('@/services/listings/listing-publish-outcome.types');
    expect(SERVER_ONLY.test(readFileSync(join(SRC, 'services', 'listings', 'listing-media-refresh.ts'), 'utf8'))).toBe(true);
  });
});
