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
  BOUNDARIES,
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


// ---------------------------------------------------------------------------
// Ν — Η ΔΕΥΤΕΡΗ ΓΡΑΜΜΗ ΤΟΥ ΠΙΝΑΚΑ (ADR-842 §7.6.12 / §8 #11)
// ---------------------------------------------------------------------------
//
// 🔴 **ΓΡΑΜΜΗ ΠΙΝΑΚΑ ΧΩΡΙΣ ΑΓΚΥΡΑ ΕΙΝΑΙ ΔΗΛΩΣΗ, ΟΧΙ ΠΥΛΗ.** Η γενίκευση σε πίνακα
// κρύβει ένα καινούριο είδος αστοχίας: η μηχανή να δουλεύει τέλεια για την **πρώτη**
// γραμμή και η δεύτερη να είναι διακοσμητική — πράσινο επειδή δεν εκτελείται. Οι
// άγκυρες παρακάτω ΕΚΤΕΛΟΥΝ τη μηχανή με τη δεύτερη γραμμή.

describe('Ν — ο πίνακας των συνόρων', () => {
  const OWNER = BOUNDARIES.find((b) => b.typeName === 'OwnerProperty');

  it('Ν0 — ο πίνακας δηλώνει και τα δύο σύνορα, χωρίς διπλότυπα', () => {
    expect(BOUNDARIES.length).toBeGreaterThanOrEqual(2);
    expect(OWNER).toBeDefined();

    const names = BOUNDARIES.map((b) => b.typeName);
    expect(new Set(names).size).toBe(names.length);

    const homes = BOUNDARIES.map((b) => b.custodian);
    expect(new Set(homes).size).toBe(homes.length);
  });

  it('🔴 Ν1 — «as OwnerProperty» σε ΝΕΟ αρχείο ⇒ ΚΟΚΚΙΝΟ', () => {
    write(OWNER.custodian, 'export function ownerPropertyFromDocument(raw, id) { return null; }');
    write('src/services/mandate/x.ts', 'const p = snap.data() as OwnerProperty;');

    const files = collectSourceFiles(path.join(root, 'src'), root);
    const k1 = measureK1(files, root, OWNER);

    expect(k1).toHaveLength(1);
    expect(k1[0].file).toBe('src/services/mandate/x.ts');
  });

  it('🔴 Ν2 (ΤΟ ΣΗΜΑΝΤΙΚΟ) — σύνορο ΧΩΡΙΣ καταναλωτές ⇒ το Κ2 το πιάνει', () => {
    // Χωρίς αυτό, μια γραμμή θα ήταν «πράσινη επειδή κανείς δεν διαβάζει» — και με
    // δύο γραμμές η σιωπή της μιας θα κρυβόταν πίσω από την υγεία της άλλης.
    write(OWNER.custodian, 'export function ownerPropertyFromDocument(raw, id) { return null; }');

    const files = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK2(files, root, OWNER)).toHaveLength(0);

    write(
      'src/services/mandate/reader.ts',
      `import { ownerPropertyFromDocument } from '@/lib/owner-property/${OWNER.module}';\n` +
        'export const x = ownerPropertyFromDocument;'
    );
    const after = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK2(after, root, OWNER)).toEqual(['src/services/mandate/reader.ts']);
  });

  it('Ν3 — τα δύο σύνορα ΔΕΝ μπερδεύονται: ο ισχυρισμός του ενός δεν κοκκινίζει τον άλλο', () => {
    write(OWNER.custodian, 'export function ownerPropertyFromDocument(raw, id) { return null; }');
    write('src/services/mandate/x.ts', 'const p = snap.data() as OwnerProperty;');

    const files = collectSourceFiles(path.join(root, 'src'), root);

    expect(measureK1(files, root, OWNER)).toHaveLength(1);
    expect(measureK1(files, root, BOUNDARIES[0])).toHaveLength(0);
  });

  it('Ν4 — το ίδιο το σύνορο του ιδιώτη ΕΠΙΤΡΕΠΕΤΑΙ να ισχυρίζεται', () => {
    write(
      OWNER.custodian,
      'export function ownerPropertyFromDocument(raw, id) { return raw as OwnerProperty; }'
    );

    const files = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK1(files, root, OWNER)).toHaveLength(0);
  });

  it('🔴 Ν5 — ΚΑΘΕ γραμμή του πίνακα δείχνει σε σύνορο που ΥΠΑΡΧΕΙ στον δίσκο', () => {
    // Ο πραγματικός δίσκος, όχι το μίνι-repo: μια γραμμή που δείχνει σε ανύπαρκτο
    // αρχείο θα έκανε την πύλη να κοκκινίζει για λάθος λόγο — ή, χειρότερα, κάποιος
    // θα την έσβηνε αντί να τη διορθώσει.
    const repo = path.resolve(__dirname, '..', '..');
    for (const boundary of BOUNDARIES) {
      expect(fs.existsSync(path.join(repo, boundary.custodian))).toBe(true);
      expect(boundary.custodian).toContain(boundary.module);
      expect(boundary.remedy).not.toHaveLength(0);
      expect(boundary.adr).toMatch(/^ADR-\d+/);
    }
  });
});
