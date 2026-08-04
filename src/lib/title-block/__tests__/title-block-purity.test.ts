/**
 * @fileoverview Ο Λ2 είναι ΚΑΘΑΡΟΣ — αποδεικνύεται από το γράφημα εισαγωγών (ADR-745 §5.3).
 *
 * ⚠️ **Αυτή η άγκυρα ΔΕΝ αρκεί μόνη της και δεν το κρύβει.** Αποδεικνύει ότι ο Λ2 *δεν μπορεί*
 * να φτάσει σε Firestore· **δεν** λέει τίποτα για τον Host και την παλέτα, που είναι ακριβώς τα
 * αρχεία που **θα** έχουν πρόσβαση. Ο κίνδυνος εκεί είναι πραγματικός: το `ContactSearchManager`
 * κατεβάζει ήδη επαφές μέσα από `useEffect` **χωρίς κανένα κλικ**, και μια γραμμή που «προ-
 * εφαρμόζει» μια βέβαιη πρόταση θα άφηνε αυτό εδώ **πράσινο**. Ο φύλακας του κλικ είναι ο
 * κατάσκοπος εγγραφής (`title-block-apply`), όχι αυτό το αρχείο.
 *
 * Η αξία του είναι άλλη και συγκεκριμένη: κρατά το **ταίριασμα** δοκιμάσιμο χωρίς I/O. Τη μέρα
 * που κάποιος «απλοποιήσει» τον resolver καλώντας απευθείας τη βάση, ο Λ2 παύει να είναι
 * αποδείξιμος και το κόστος εμφανίζεται μήνες αργότερα.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../..');
const ENTRY = path.join(SRC, 'lib/title-block/title-block-proposals.ts');

/** Ο,τιδήποτε αγγίζει βάση, δίκτυο ή React — τίποτα από αυτά δεν επιτρέπεται στον Λ2. */
const FORBIDDEN = /(^|\/)(firebase|firestore|react|next)($|\/|-)/i;

/**
 * Μόνο εισαγωγές **τιμών**.
 *
 * Το `import type { Timestamp } from 'firebase/firestore'` **σβήνεται στη μεταγλώττιση** — δεν
 * υπάρχει στο τελικό πακέτο και δεν εκτελεί τίποτα. Μετρώντας το, η άγκυρα θα κατηγορούσε το
 * `types/ownership-table.ts` για εξάρτηση που **δεν υπάρχει**, και η μόνη διέξοδος θα ήταν να
 * χαλαρώσει ο κανόνας — δηλαδή ένα ψευδώς θετικό θα σκότωνε τον φύλακα.
 */
const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)[^'"]*?from\s*['"]([^'"]+)['"]/g;

function resolveSpecifier(specifier: string, from: string): string | null {
  const base = specifier.startsWith('@/')
    ? path.join(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (!base) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Όλα τα module που φτάνει ο Λ2, **μεταβατικά**, μαζί με τα ονόματα των εξαρτήσεων. */
function walkGraph(entry: string): { files: Set<string>; specifiers: Set<string> } {
  const files = new Set<string>();
  const specifiers = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT)) {
      const specifier = match[1];
      specifiers.add(specifier);
      const resolved = resolveSpecifier(specifier, file);
      if (resolved) queue.push(resolved);
    }
  }
  return { files, specifiers };
}

describe('Λ2 — καθαρότητα του γραφήματος εισαγωγών', () => {
  const graph = walkGraph(ENTRY);

  it('το γράφημα δεν είναι κενό — αλλιώς το test θα περνούσε χωρίς να κοιτάξει τίποτα', () => {
    expect(graph.files.size).toBeGreaterThan(5);
    expect([...graph.files].some((f) => f.includes('resolve-people'))).toBe(true);
    expect([...graph.files].some((f) => f.includes('greek-person-name'))).toBe(true);
  });

  it('🔴 ΚΑΜΙΑ εξάρτηση σε Firestore, δίκτυο ή React — μεταβατικά', () => {
    const offenders = [...graph.specifiers].filter((s) => FORBIDDEN.test(s));
    expect(offenders).toEqual([]);
  });

  it('🔴 καμία κλήση εγγραφής δεν υπάρχει καν ως κείμενο στα αρχεία του Λ2', () => {
    const writes = /\b(setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction)\b/;
    const guilty = [...graph.files]
      .filter((f) => f.includes(`${path.sep}title-block${path.sep}`))
      .filter((f) => writes.test(fs.readFileSync(f, 'utf8')));
    expect(guilty).toEqual([]);
  });
});
