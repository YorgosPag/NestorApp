/**
 * 🔴 ADR-833 Φάση 2 — **Η ΠΑΛΙΑ ΜΟΡΦΗ ΕΧΕΙ ΑΚΡΙΒΩΣ ΕΝΑΝ ΓΝΩΣΤΗ.**
 *
 * ## Γιατί αυτό είναι άγκυρα και όχι καλλωπισμός
 * Η επιλογή του §5.2 ήταν *«καμία συμβατότητα με πεδίο-καθρέφτη»*: το `model` **δεν** μένει στην
 * οντότητα σαν αντίγραφο του ενεργού φύλλου. Το τίμημα είναι ότι **κάποιος** πρέπει να ξέρει την
 * παλιά μορφή — και η **μόνη** εγγύηση ότι το κόστος δεν πολλαπλασιάζεται είναι να μετρηθεί.
 *
 * Χωρίς αυτόν τον έλεγχο, η επόμενη φορά που κάποιος χρειάζεται «το μοντέλο μιας παλιάς
 * οντότητας» θα εισάγει το `PreWorksheetsTableEntity` και θα το διαβάσει **απευθείας** — και θα
 * δουλέψει. Δύο μήνες μετά, οι απευθείας αναγνώστες θα είναι πέντε, κανείς δεν θα περνά από τη
 * μνήμη του `resolveWorksheets`, και το πεδίο που «έφυγε» θα έχει **περισσότερους** αναγνώστες
 * από πριν. Η κλάση είναι μετρημένη στο ίδιο έργο: το `.ssot-discover` (N.12) υπάρχει επειδή
 * ακριβώς αυτό συνέβη με άλλα πεδία.
 *
 * ➜ **Αν κοκκινίσει επειδή πρόσθεσες εισαγωγέα**: μη σβήσεις το test. Ρώτα πρώτα *«γιατί δεν
 * ρωτάω το `bim/table/table-worksheet-resolve.ts`;»* — εκείνο απαντά **και** για τις δύο μορφές,
 * με μνήμη, χωρίς να ξέρει ο καλών ότι υπάρχει παλιά μορφή.
 *
 * 🔬 Μεταλλάξεις που το κάνουν κόκκινο:
 *   Μ8  δεύτερος μη-test εισαγωγέας του `types/table-entity-legacy`
 *   Μ9  ο μοναδικός εισαγωγέας αλλάζει (π.χ. μετακομίζει η λογική) χωρίς ενημέρωση εδώ
 *
 * @see ../table-worksheet-resolve.ts — η ΜΙΑ πύλη
 * @see ../../../types/table-entity-legacy.ts — η ΜΙΑ κατοικία
 */

import { describe, it, expect } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SUBAPP_ROOT = join(__dirname, '..', '..', '..');

/**
 * Ο **ΚΛΕΙΣΤΟΣ** κατάλογος. Μία γραμμή, ένας λόγος — και ο λόγος δεν είναι «το χρειάζεται»:
 * είναι ότι αυτό το module **ΕΙΝΑΙ** η πύλη.
 */
const ALLOWED_IMPORTERS: Readonly<Record<string, string>> = {
  'bim/table/table-worksheet-resolve.ts':
    'Η ΜΙΑ πύλη: αναβαθμίζει τεμπέλικα, απομνημονεύει, και απαντά για ΚΑΙ ΤΙΣ ΔΥΟ μορφές. '
    + 'Κάθε άλλος ρωτάει αυτό, και δεν χρειάζεται να ξέρει ότι υπάρχει παλιά μορφή.',
};

/**
 * Το ίδιο το αρχείο ορισμού — ούτε επιτρέπεται ούτε απαγορεύεται, δεν είναι εισαγωγέας. Και το
 * κοινό fixture των tests, που **οφείλει** να παράγει την παλιά μορφή: χωρίς δείγμα παλιών
 * δεδομένων, ο μηχανισμός συμβατότητας θα ήταν ισχυρισμός. (Ο σαρωτής αγνοεί ήδη τα `__tests__`.)
 */
const DEFINITION_FILE = 'types/table-entity-legacy.ts';

/** Εισάγει ο **πηγαίος κώδικας** —όχι τα σχόλια— από το module της παλιάς μορφής; */
function importsLegacyModule(source: string): boolean {
  const code = source
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return '';
      const inline = line.indexOf('//');
      return inline >= 0 ? line.slice(0, inline) : line;
    })
    .join('\n');
  return /from\s+'[^']*table-entity-legacy'/.test(code);
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectSourceFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('ADR-833 §5.2 — το `PreWorksheetsTableEntity` είναι ΚΛΕΙΣΤΟ σύνολο εισαγωγέων', () => {
  const files = collectSourceFiles(SUBAPP_ROOT);
  const importers = files
    .filter((f) => importsLegacyModule(readFileSync(f, 'utf8')))
    .map((f) => relative(SUBAPP_ROOT, f).split(sep).join('/'))
    .filter((f) => f !== DEFINITION_FILE)
    .sort();

  it('η σάρωση ΟΝΤΩΣ βλέπει κώδικα (αλλιώς το πράσινο σημαίνει «κανείς δεν κοίταξε»)', () => {
    // Το ίδιο μάθημα με τα «0 παραβιάσεις» του N.11/N.12: μέτρα πρώτα το **ΟΡΓΑΝΟ**. Ένα
    // χαλασμένο regex ή λάθος ρίζα δίνει κενό σύνολο — και κενό ⊆ allowlist περνά αθόρυβα.
    expect(files.length).toBeGreaterThan(1000);
    expect(importers.length).toBeGreaterThan(0);
    expect(importsLegacyModule("import { x } from './types/table-entity-legacy';")).toBe(true);
    expect(importsLegacyModule(" * @see types/table-entity-legacy.ts — η ΜΙΑ κατοικία")).toBe(false);
    expect(importsLegacyModule("// import { x } from '../table-entity-legacy';")).toBe(false);
    expect(importsLegacyModule("import { y } from './table-entity';")).toBe(false);
  });

  it('Μ8/Μ9: κανένας εισαγωγέας εκτός του δηλωμένου καταλόγου', () => {
    expect(importers).toEqual(Object.keys(ALLOWED_IMPORTERS).sort());
  });

  it('…και ο μοναδικός εισαγωγέας ΟΝΤΩΣ αναβαθμίζει (ΠΑΡΟΥΣΙΑ, όχι απουσία)', () => {
    // Ονομαστικά: αν κάποιος σβήσει την αναβάθμιση εντελώς, η **απουσία** από τη λίστα θα
    // φαινόταν σωστή και ο κατάλογος θα ήταν άδειος-και-πράσινος. Εδώ ζητείται παρουσία.
    const gate = readFileSync(join(SUBAPP_ROOT, 'bim/table/table-worksheet-resolve.ts'), 'utf8');
    expect(/\bupgradePreWorksheetsTable\s*\(/.test(gate)).toBe(true);
    expect(/\breadPreWorksheetsTable\s*\(/.test(gate)).toBe(true);
  });

  it('🔴 κανένα module δεν διαβάζει το πεδίο της παλιάς μορφής απευθείας πια', () => {
    // Ο **δεύτερος** δρόμος προς το ίδιο σφάλμα: δεν χρειάζεται να εισάγεις τον τύπο της παλιάς
    // μορφής για να διαβάσεις το πεδίο της — αρκεί ένα `as` και ένα `.model`. Ο έλεγχος αγνοεί
    // σχόλια (η τεκμηρίωση **οφείλει** να ονομάζει το πεδίο που έφυγε).
    const offenders = files
      .map((f) => [relative(SUBAPP_ROOT, f).split(sep).join('/'), readFileSync(f, 'utf8')] as const)
      .filter(([rel]) => rel !== DEFINITION_FILE)
      .filter(([, source]) => {
        const code = source
          .split('\n')
          .map((line) => {
            const trimmed = line.trimStart();
            if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return '';
            const inline = line.indexOf('//');
            return inline >= 0 ? line.slice(0, inline) : line;
          })
          .join('\n');
        return /\b(entity|live)\??\.(model|binding)\b/.test(code);
      })
      .map(([rel]) => rel);
    expect(offenders).toEqual([]);
  });
});
