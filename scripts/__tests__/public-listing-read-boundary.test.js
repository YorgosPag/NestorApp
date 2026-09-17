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

  it('🔴 Ν5 — ΚΑΘΕ γραμμή του πίνακα δείχνει σε σύνορο που ΥΠΑΡΧΕΙ στον δίσκο (όλες)', () => {
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

// ---------------------------------------------------------------------------
// Ξ — Η ΤΕΤΑΡΤΗ ΓΡΑΜΜΗ: Η ΖΗΤΗΣΗ (ADR-864 Α15)
// ---------------------------------------------------------------------------
//
// 🔴 **ΤΗ ΓΡΑΜΜΗ ΤΗ ΓΕΝΝΗΣΕ ΤΥΦΛΟ ΣΗΜΕΙΟ ΑΥΤΗΣ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΠΥΛΗΣ.** Το Κ1 ψάχνει
// κατά λέξη `as <TypeName>`· η μηχανή ανάγνωσης των «δικών μου» έγραφε **`as T`** —
// γενικό, άρα **αόρατο**. Η πύλη ήταν πράσινη επειδή δεν έβλεπε την πόρτα, όχι επειδή
// ήταν κλειστή: το σχήμα «0 = κανείς δεν κοίταξε», μέσα στην πύλη που το κυνηγά.
//
// ⚠️ **Το γενικό ΔΕΝ το φυλάει αυτή η ομάδα** — το φυλάει ο **τύπος**
// (`OwnedCollectionSpec<T>` με υποχρεωτικό `fromDocument`). Εδώ φυλάγεται το
// **υπόλοιπο** της κλάσης: ωμό `as PropertyDemand` οπουδήποτε αλλού στο repo.

describe('Ξ — η γραμμή της ζήτησης ΕΚΤΕΛΕΙΤΑΙ', () => {
  const DEMAND = BOUNDARIES.find((b) => b.typeName === 'PropertyDemand');

  it('Ξ0 — ο πίνακας τη δηλώνει, με θεματοφύλακα που υπάρχει', () => {
    expect(DEMAND).toBeDefined();
    const repo = path.resolve(__dirname, '..', '..');
    expect(fs.existsSync(path.join(repo, DEMAND.custodian))).toBe(true);
  });

  it('🔴 Ξ1 — «as PropertyDemand» σε ΝΕΟ αρχείο ⇒ ΚΟΚΚΙΝΟ', () => {
    write(DEMAND.custodian, 'export function propertyDemandFromDocument(raw, id) { return null; }');
    write('src/services/demand/x.ts', 'const d = snap.data() as PropertyDemand;');

    const files = collectSourceFiles(path.join(root, 'src'), root);
    const k1 = measureK1(files, root, DEMAND);

    expect(k1).toHaveLength(1);
    expect(k1[0].file).toBe('src/services/demand/x.ts');
  });

  it('🔴 Ξ2 (ΤΟ ΣΗΜΑΝΤΙΚΟ) — σύνορο ΧΩΡΙΣ καταναλωτές ⇒ το Κ2 το πιάνει', () => {
    write(DEMAND.custodian, 'export function propertyDemandFromDocument(raw, id) { return null; }');

    const files = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK2(files, root, DEMAND)).toHaveLength(0);

    write(
      'src/services/demand/reader.ts',
      `import { propertyDemandFromDocument } from '@/lib/demand/${DEMAND.module}';\n` +
        'export const x = propertyDemandFromDocument;'
    );
    const after = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK2(after, root, DEMAND)).toEqual(['src/services/demand/reader.ts']);
  });

  it('Ξ3 — δεν μπερδεύεται με τις άλλες τρεις γραμμές', () => {
    write(DEMAND.custodian, 'export function propertyDemandFromDocument(raw, id) { return null; }');
    write('src/services/demand/x.ts', 'const d = snap.data() as PropertyDemand;');

    const files = collectSourceFiles(path.join(root, 'src'), root);

    expect(measureK1(files, root, DEMAND)).toHaveLength(1);
    for (const other of BOUNDARIES.filter((b) => b.typeName !== 'PropertyDemand')) {
      expect(measureK1(files, root, other)).toHaveLength(0);
    }
  });

  it('Ξ4 — το ίδιο το σύνορο ΕΠΙΤΡΕΠΕΤΑΙ να ισχυρίζεται', () => {
    write(
      DEMAND.custodian,
      'export function readStoredDemand(raw, id) { return raw as PropertyDemand; }'
    );

    const files = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK1(files, root, DEMAND)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Ο — Η ΠΕΜΠΤΗ ΓΡΑΜΜΗ: ΤΟ ΔΟΧΕΙΟ (ADR-862 Φ0 Β1)
// ---------------------------------------------------------------------------
//
// 🔴 **Η ΠΡΩΤΗ ΓΡΑΜΜΗ ΠΟΥ ΦΥΛΑΕΙ ΟΡΑΤΟΤΗΤΑ, ΟΧΙ ΟΘΟΝΗ.** Στα τέσσερα προηγούμενα
// σύνορα, πεδίο που λείπει βγάζει λευκή σελίδα. Εδώ βγάζει **λάθος κοινό**:
// `cdeState: undefined` διαβασμένο ως `'PUBLISHED'` δείχνει ημιτελή μελέτη στο
// **συνεργείο**.

describe('Ο — η γραμμή του δοχείου ΕΚΤΕΛΕΙΤΑΙ', () => {
  const FILE = BOUNDARIES.find((b) => b.typeName === 'FileRecord');
  const HOME = 'export function readFileRecord(raw, id) { return null; }';

  it('Ο0 — ο πίνακας τη δηλώνει, με θεματοφύλακα που υπάρχει, και η έκπτωσή της είναι ΓΡΑΜΜΕΝΗ', () => {
    expect(FILE).toBeDefined();
    // 🔑 Η στενότερη εμβέλεια του Κριτηρίου 2 **δηλώνεται** στον πίνακα. Αν κάποιος
    //    τη σβήσει «για ομοιομορφία», η γραμμή θα αρχίσει να καταγγέλλει κατασκευές
    //    — και αυτή η άγκυρα το λέει πριν το μάθει ο άνθρωπος από ψευδώς θετικό.
    expect(FILE.claims).toBe('document');
    const repo = path.resolve(__dirname, '..', '..');
    expect(fs.existsSync(path.join(repo, FILE.custodian))).toBe(true);
  });

  it('🔴 Ο1 — ωμό «.data() as FileRecord» ⇒ ΚΟΚΚΙΝΟ', () => {
    write(FILE.custodian, HOME);
    write('src/services/versions.ts', 'const current = snap.data() as FileRecord;');

    const files = collectSourceFiles(path.join(root, 'src'), root);
    const k1 = measureK1(files, root, FILE);

    expect(k1).toHaveLength(1);
    expect(k1[0].file).toBe('src/services/versions.ts');
  });

  it('🔴 Ο2 — «as unknown as FileRecord» πάνω σε ΑΝΑΓΝΩΣΗ ΔΕΝ ξεφεύγει', () => {
    // Η έκπτωση του Κριτηρίου 2 αφορά **κατασκευή**, όχι το `unknown` ως τέτοιο.
    write(FILE.custodian, HOME);
    write('src/services/sneaky.ts', 'const current = snap.data() as unknown as FileRecord;');

    const files = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK1(files, root, FILE)).toHaveLength(1);
  });

  it('🔴 Ο3 (ΤΟ ΣΗΜΑΝΤΙΚΟ) — σύνορο ΧΩΡΙΣ καταναλωτές ⇒ το Κ2 το πιάνει', () => {
    write(FILE.custodian, HOME);

    const files = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK2(files, root, FILE)).toHaveLength(0);

    write(
      'src/services/reader.ts',
      `import { readFileRecord } from '@/lib/files/${FILE.module}';\n` +
        'export const x = readFileRecord;'
    );
    const after = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK2(after, root, FILE)).toEqual(['src/services/reader.ts']);
  });

  it('Ο4 — το σπίτι ΕΠΙΤΡΕΠΕΤΑΙ να ισχυρίζεται', () => {
    write(FILE.custodian, `${HOME}\nconst r = raw as FileRecord;`);

    const files = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK1(files, root, FILE)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Π — Η ΕΚΤΗ ΓΡΑΜΜΗ: Η ΟΜΑΔΑ **ΕΙΝΑΙ** ΕΞΟΥΣΙΟΔΟΤΗΣΗ (ADR-862 Φ0 Β7)
// ---------------------------------------------------------------------------
//
// 🔑 Η γραμμή μπήκε με **Κ1 = 0 χωρίς καμία εργασία**. Αυτό δεν την κάνει
// διακοσμητική — την κάνει **κλείδωμα**: ωμό `as ProjectMember` υπόσχεται
// `PermissionId[]` για πίνακα που ήρθε από τη βάση χωρίς έλεγχο, δηλαδή
// **εξουσιοδότηση που κανείς δεν υπέγραψε**. Από εδώ και πέρα κοκκινίζει στο `git add`.

describe('Π — η γραμμή του μέλους ΕΚΤΕΛΕΙΤΑΙ', () => {
  const MEMBER = BOUNDARIES.find((b) => b.typeName === 'ProjectMember');
  const HOME = 'export function readProjectMember(q) { return null; }';

  it('Π0 — ο πίνακας τη δηλώνει, με θεματοφύλακα που υπάρχει', () => {
    expect(MEMBER).toBeDefined();
    const repo = path.resolve(__dirname, '..', '..');
    expect(fs.existsSync(path.join(repo, MEMBER.custodian))).toBe(true);
  });

  it('🔴 Π1 — «as ProjectMember» σε ΝΕΟ αρχείο ⇒ ΚΟΚΚΙΝΟ', () => {
    write(MEMBER.custodian, HOME);
    write('src/lib/auth/lookups.ts', 'const m = memberSnap.data() as ProjectMember;');

    const files = collectSourceFiles(path.join(root, 'src'), root);
    const k1 = measureK1(files, root, MEMBER);

    expect(k1).toHaveLength(1);
    expect(k1[0].file).toBe('src/lib/auth/lookups.ts');
  });

  it('🔴 Π2 (ΤΟ ΣΗΜΑΝΤΙΚΟ) — σύνορο ΧΩΡΙΣ καταναλωτές ⇒ το Κ2 το πιάνει', () => {
    write(MEMBER.custodian, HOME);

    const files = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK2(files, root, MEMBER)).toHaveLength(0);

    write(
      'src/lib/auth/permissions/resource-lookups.ts',
      `import { readProjectMember } from '@/lib/auth/${MEMBER.module}';\n` +
        'export const x = readProjectMember;'
    );
    const after = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK2(after, root, MEMBER)).toEqual(['src/lib/auth/permissions/resource-lookups.ts']);
  });

  it('Π3 — η ΚΑΤΑΣΚΕΥΗ ΔΕΝ εξαιρείται εδώ: η γραμμή ΔΕΝ δηλώνει «claims»', () => {
    // 🔴 Η απόδειξη ότι η έκπτωση του `FileRecord` είναι **ανά γραμμή**, όχι καθολική
    //    χαλάρωση της μηχανής.
    expect(MEMBER.claims).toBeUndefined();
    write(MEMBER.custodian, HOME);
    write('src/lib/auth/built.ts', "const m = { uid: 'u' } as unknown as ProjectMember;");

    const files = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK1(files, root, MEMBER)).toHaveLength(1);
  });

  it('Π4 — το σπίτι ΕΠΙΤΡΕΠΕΤΑΙ να ισχυρίζεται', () => {
    write(MEMBER.custodian, `${HOME}\nconst m = raw as ProjectMember;`);

    const files = collectSourceFiles(path.join(root, 'src'), root);
    expect(measureK1(files, root, MEMBER)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Ρ — Η ΜΗΧΑΝΗ: ΤΙ **ΕΙΝΑΙ** ΙΣΧΥΡΙΣΜΟΣ ΓΙΑ ΕΓΓΡΑΦΟ ΚΑΙ ΤΙ **ΔΕΝ** ΕΙΝΑΙ
// ---------------------------------------------------------------------------
//
// 🔴 **Η ΣΗΜΑΝΤΙΚΟΤΕΡΗ ΟΜΑΔΑ ΤΟΥ Β9.** Η μηχανή του Κ1 άλλαξε από **κείμενο** σε
// **AST** — δηλαδή άλλαξε ο κριτής που φυλάει **ήδη τέσσερα** σύνορα. Χωρίς αυτές τις
// άγκυρες, η αλλαγή θα ήταν ισχυρισμός ακρίβειας που κανείς δεν μέτρησε.
//
// Η αιτία, μετρημένη 2026-09-16: `\bas FileRecord\b` καταγγέλλει **6** αρχεία, εκ των
// οποίων **ΕΝΑ** ισχυρίζεται «αυτό το αποθηκευμένο έγγραφο ΕΙΝΑΙ FileRecord».
// **83% ψευδώς θετικά** — οκτώ φορές πάνω από τον πήχη ≤10% για μπλοκάρουσα πύλη.

describe('Ρ — η μηχανή AST ξεχωρίζει τον ισχυρισμό από την έκφραση τύπου', () => {
  const FILE = BOUNDARIES.find((b) => b.typeName === 'FileRecord');
  const LISTING = BOUNDARIES[0];
  const HOME = 'export function readFileRecord(raw, id) { return null; }';

  const scan = () => collectSourceFiles(path.join(root, 'src'), root);

  beforeEach(() => {
    write(FILE.custodian, HOME);
  });

  it('🔴 Ρ1 (ΚΡΙΤΗΡΙΟ 1) — «X[]» · «X[\'f\']» · «X & {…}» ΔΕΝ είναι ισχυρισμοί εγγράφου', () => {
    // Και τα τρία υπάρχουν **σήμερα** στην παραγωγή (`useEntityFiles.ts:168,443` ·
    // `company-file-tree-builders.tsx:140`) και είναι **σωστός κώδικας**: εκφράσεις
    // τύπου ΓΙΑ το FileRecord, ποτέ ισχυρισμός για αποθηκευμένο έγγραφο.
    write(
      'src/components/shapes.ts',
      [
        'const empty = [] as FileRecord[];',
        "const s = raw.status as FileRecord['status'];",
        'const wide = file as FileRecord & { entityLabel?: string };',
      ].join('\n')
    );

    expect(measureK1(scan(), root, FILE)).toEqual([]);
  });

  it('🔴 Ρ2 — αλλά «.data() as X» και «.data() as unknown as X» ΚΟΚΚΙΝΙΖΟΥΝ', () => {
    write('src/services/a.ts', 'const one = snap.data() as FileRecord;');
    write('src/services/b.ts', 'const two = snap.data() as unknown as FileRecord;');

    expect(measureK1(scan(), root, FILE).map((h) => h.file).sort()).toEqual([
      'src/services/a.ts',
      'src/services/b.ts',
    ]);
  });

  it('🔴 Ρ3 (ΚΡΙΤΗΡΙΟ 2) — ΙΔΙΟ κείμενο, ΔΥΟ γραμμές, ΔΥΟ αποτελέσματα', () => {
    // 🔑 Η απόδειξη ότι το `claims: 'document'` είναι **δηλωμένη έκπτωση ανά γραμμή**
    //    και όχι χαλάρωση της μηχανής: η ίδια ακριβώς σύνταξη σιωπά στη γραμμή που
    //    τη δηλώνει και κοκκινίζει σε αυτή που δεν τη δηλώνει.
    write('src/services/built-file.ts', "const f = { id: 'x' } as unknown as FileRecord;");
    write('src/services/built-listing.ts', "const l = { id: 'x' } as unknown as PublicListing;");

    const files = scan();
    expect(measureK1(files, root, FILE)).toEqual([]);
    expect(measureK1(files, root, LISTING)).toHaveLength(1);
  });

  it('🔴 Ρ4 — σχόλιο δεν είναι ισχυρισμός, ΧΩΡΙΣ «stripComments»', () => {
    // Το `stripComments()` **διαγράφηκε**: στο AST τα σχόλια είναι δομικά αόρατα.
    write('src/services/doc.ts', '/** μην γράψεις: data() as FileRecord */\nexport const x = 1;');
    write('src/services/line.ts', '// απαγορεύεται το as FileRecord εδώ\nexport const y = 2;');

    expect(measureK1(scan(), root, FILE)).toEqual([]);
  });

  it('🔴 Ρ5 — ο αριθμός γραμμής είναι ΑΚΡΙΒΗΣ, χωρίς τη «διπλή ανάγνωση»', () => {
    // Η παλιά μηχανή έκρινε στο απογυμνωμένο κείμενο και μετρούσε γραμμή στο αρχικό —
    // δύο αναγνώσεις για να μη δείχνει ο δείκτης 72 γραμμές πιο πάνω. Το AST δίνει τη
    // θέση **εξ ορισμού**.
    write(
      'src/services/offset.ts',
      ['/**', ' * μεγάλη', ' * κεφαλίδα', ' * as FileRecord (σχόλιο!)', ' */', '', 'const f = snap.data() as FileRecord;'].join('\n')
    );

    expect(measureK1(scan(), root, FILE)).toEqual([{ file: 'src/services/offset.ts', line: 7 }]);
  });

  it('🔴 Ρ6 — σε «.tsx» το JSX ΔΕΝ μπερδεύει τον αναλυτή', () => {
    // ⚠️ Χωρίς `ts.ScriptKind.TSX` ο αναλυτής διαβάζει το `<section>` ως **ισχυρισμό
    //    τύπου** και το δέντρο βγαίνει άλλο — δηλαδή η πύλη θα έκρινε κώδικα που δεν
    //    υπάρχει. Το ~40% του `src/` είναι `.tsx`.
    write(
      'src/components/Card.tsx',
      [
        'export function Card({ raw }) {',
        '  return <section className="card">{(raw as FileRecord).id}</section>;',
        '}',
      ].join('\n')
    );

    expect(measureK1(scan(), root, FILE)).toEqual([{ file: 'src/components/Card.tsx', line: 2 }]);
  });

  it('🔴 Ρ7 — ΤΟ Κ2 ΜΕΤΡΑ ΔΗΛΩΣΕΙΣ: σχολιασμένη εισαγωγή ΟΧΙ, πολυγραμμική ΝΑΙ', () => {
    // 🔑 Το παλιό Κ2 ήταν regex κειμένου. Μια **σχολιασμένη** εισαγωγή μετρούσε ως
    //    καταναλωτής — δηλαδή ο ίδιος ο παρονομαστής («τον ζητά κανείς;») μπορούσε να
    //    είναι πράσινος επειδή κάποιος **έσβησε** τη χρήση και άφησε τη γραμμή.
    write(
      'src/services/commented.ts',
      `// import { readFileRecord } from '@/lib/files/${FILE.module}';\nexport const x = 1;`
    );
    expect(measureK2(scan(), root, FILE)).toEqual([]);

    // …και η **πολυγραμμική** εισαγωγή μετρά — υπάρχει στην παραγωγή
    // (`services/iso19650/container-transition-policy.ts`).
    write(
      'src/services/multiline.ts',
      [
        'import {',
        '  readFileRecord,',
        '  containerFactsOf,',
        `} from '@/lib/files/${FILE.module}';`,
        'export const y = readFileRecord;',
      ].join('\n')
    );
    expect(measureK2(scan(), root, FILE)).toEqual(['src/services/multiline.ts']);
  });
});
