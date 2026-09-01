/**
 * Άγκυρες του **CHECK 3.74** (ADR-839 §8) — το σύνορο ανάγνωσης της δημόσιας προβολής.
 *
 * 🔴 **Η πύλη ΕΚΤΕΛΕΙΤΑΙ σε μίνι-repo, δεν περιγράφεται.** Το μάθημα του CHECK 3.54
 * («άγκυρα χωρίς εκτελεστή είναι σχόλιο») ισχύει διπλά για μια πύλη που γεννήθηκε
 * επειδή **καμία** άγκυρα δεν μπορούσε να δει το αρχικό σφάλμα.
 *
 * Οι ομάδες: **Μ** = μεταλλάξεις (μπορεί να κοκκινίσει;) · **Κ** = συμβόλαιο.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  measureK1,
  measureK2,
  collectSourceFiles,
  CUSTODIAN,
  CUSTODIAN_MODULE,
} = require('../check-public-listing-read-boundary');

// ---------------------------------------------------------------------------

let root;

/** Γράφει αρχείο στο μίνι-repo, φτιάχνοντας τους φακέλους που λείπουν. */
function write(rel, source) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, source, 'utf8');
}

/** Τρέχει την πύλη πάνω στο μίνι-repo και επιστρέφει και τα δύο κριτήρια. */
function run() {
  const files = collectSourceFiles(path.join(root, 'src'), root);
  return { k1: measureK1(files, root), consumers: measureK2(files, root), files };
}

const CUSTODIAN_SOURCE = `export function publicListingFromDocument(raw, id) { return null; }`;
const IMPORT_LINE = `import { publicListingFromDocument } from '@/lib/listings/${CUSTODIAN_MODULE}';`;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adr839-'));
  write(CUSTODIAN, CUSTODIAN_SOURCE);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------

describe('Μ — η πύλη ΜΠΟΡΕΙ να κοκκινίσει', () => {
  it('🔴 Μ0 (ο παρονομαστής) — καθαρό δέντρο ⇒ ΠΡΑΣΙΝΟ', () => {
    write('src/services/reader.ts', `${IMPORT_LINE}\nexport const x = publicListingFromDocument;`);

    const { k1, consumers } = run();
    expect(k1).toEqual([]);
    expect(consumers).toHaveLength(1);
  });

  it('🔴 Μ1 — «as PublicListing» σε ΝΕΟ αρχείο ⇒ ΚΟΚΚΙΝΟ', () => {
    write('src/services/reader.ts', `${IMPORT_LINE}\nexport const x = 1;`);
    write('src/services/sneaky.ts', `const l = snap.data() as PublicListing;\n`);

    expect(run().k1.map((hit) => hit.file)).toEqual(['src/services/sneaky.ts']);
  });

  it('🔴 Μ2 — «as unknown as PublicListing» ΔΕΝ ξεφεύγει', () => {
    write('src/services/reader.ts', `${IMPORT_LINE}\nexport const x = 1;`);
    write('src/services/sneaky.ts', `const l = snap.data() as unknown as PublicListing;\n`);

    expect(run().k1).toHaveLength(1);
  });

  it('🔴 Μ3 (ΤΟ ΣΗΜΑΝΤΙΚΟ) — αν σβηστεί ο ΤΕΛΕΥΤΑΙΟΣ καταναλωτής ⇒ ΚΟΚΚΙΝΟ', () => {
    // Χωρίς αυτό, «διορθώνεις» ένα κόκκινο Κ1 σβήνοντας τη μετάφραση, και η πύλη
    // γίνεται πράσινη με μηδέν προστασία — το σχήμα «0 = κανείς δεν κοίταξε».
    write('src/services/reader.ts', `export const x = 1;`);

    const { k1, consumers } = run();
    expect(k1).toEqual([]);
    expect(consumers).toHaveLength(0); // ⇒ το main() επιστρέφει 1
  });
});

describe('Κ — το συμβόλαιο: πού ΔΕΝ κοκκινίζει, και γιατί', () => {
  beforeEach(() => {
    write('src/services/reader.ts', `${IMPORT_LINE}\nexport const x = 1;`);
  });

  it('το ίδιο το σύνορο ΕΠΙΤΡΕΠΕΤΑΙ να ισχυρίζεται — είναι το σπίτι του', () => {
    write(CUSTODIAN, `${CUSTODIAN_SOURCE}\nconst l = raw as PublicListing;`);
    expect(run().k1).toEqual([]);
  });

  it('🔶 οι άγκυρες κατασκευάζουν fixtures ⇒ δηλωμένη εξαίρεση', () => {
    write('src/lib/x/__tests__/a.test.ts', `const l = {} as PublicListing;`);
    write('src/lib/x/b.spec.ts', `const l = {} as PublicListing;`);
    expect(run().k1).toEqual([]);
  });

  it('🔴 «as PublicListing» μέσα σε ΣΧΟΛΙΟ δεν είναι ισχυρισμός', () => {
    write('src/services/documented.ts', `/** μην γράψεις: data() as PublicListing */\nexport const x = 1;`);
    write('src/services/line.ts', `// απαγορεύεται το as PublicListing εδώ\nexport const y = 2;`);
    expect(run().k1).toEqual([]);
  });

  it('🔴 ΑΛΛΟΣ τύπος με ίδιο πρόθεμα ΔΕΝ πιάνεται (όριο λέξης)', () => {
    write('src/services/other.ts', `const l = raw as PublicListingLookup;`);
    expect(run().k1).toEqual([]);
  });

  it('ο αριθμός γραμμής δείχνει στο ΑΡΧΙΚΟ κείμενο, όχι στο απογυμνωμένο', () => {
    write(
      'src/services/offset.ts',
      ['/**', ' * μεγάλη', ' * κεφαλίδα', ' */', '', 'const l = snap.data() as PublicListing;'].join(
        '\n'
      )
    );
    expect(run().k1[0].line).toBe(6);
  });
});
