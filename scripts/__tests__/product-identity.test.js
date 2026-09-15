/**
 * ΑΓΚΥΡΕΣ — CHECK 3.81 / ADR-857 Φ8: πύλη ταυτότητας προϊόντος.
 *
 * ⚠️ ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ, ΟΧΙ ΣΤΗΝ ΠΥΛΗ: μίνι-repo χτισμένο από τα
 * ΠΡΑΓΜΑΤΙΚΑ αρχεία του δέντρου, σε προσωρινό φάκελο **έξω από το κοινό working
 * tree** — μία γραμμή αλλαγή τη φορά. Fixture γραμμένο στο χέρι θα αποδείκνυε ότι η
 * πύλη διαβάζει σωστά ό,τι της έγραψα, όχι ότι διαβάζει σωστά τον κώδικα που τρέχει.
 *
 * 🔴 ΓΙΑΤΙ ΕΞΩ ΑΠΟ ΤΟ ΔΕΝΤΡΟ, ΚΑΙ ΕΙΝΑΙ ΚΑΝΟΝΑΣ ΤΟΥ ΕΡΓΟΥ: το δέντρο μοιράζεται με
 * άλλους πράκτορες που έχουν εντολή να κάνουν commit. Μετάλλαξη που δεν επαναφέρεται
 * (Ctrl-C, timeout) δεν είναι «χαλασμένο τοπικό αντίγραφο» — είναι **μετάλλαξη
 * δοκιμής που φεύγει στην παραγωγή**.
 *
 * ⚠️ Ο μεταλλάκτης ΟΥΡΛΙΑΖΕΙ αν η μετάλλαξη δεν άλλαξε τίποτα (`./_mutate`): «RED»
 * πάνω σε μετάλλαξη που δεν εφαρμόστηκε αποδεικνύει ΤΙΠΟΤΑ.
 *
 * @jest-environment node
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const gate = require('../check-product-identity');
const { STATES } = require('../lib/product-identity/scan');
const { mutateText } = require('./_mutate');

const REPO = path.resolve(__dirname, '..', '..');
const CONFIG = path.join(REPO, '.product-identity.json');

/** Τα αρχεία που συμμετέχουν, με τις ΠΡΑΓΜΑΤΙΚΕΣ διαδρομές τους. */
const ROOT_FILE = 'src/constants/product-identity.ts';
const CODE_FILES = [
  ROOT_FILE,
  'src/config/firebase-auth-config.ts',          // δηλωμένο, κλάση Ε
  'src/app/layout.tsx',                          // καθαρό — ΚΑΙ έχει σχόλιο με παλιές γραφές
];
const LOCALE_FILES = [
  // δηλωμένο, κλάση Γ — ήταν το `el/auth.json` (κλάση Β) μέχρι 2026-09-15: με απόφαση Giorgio το
  // υποσέλιδο γράφει πλέον «Nestor App» και η δήλωσή του σβήστηκε (ADR-861 Φ1)
  'src/i18n/locales/el/contacts-core.json',
  'src/i18n/locales/el/onboarding.json',         // κανονική γραφή μέσα σε πρόταση
];

/**
 * Μίνι-repo από τα πραγματικά αρχεία, με το μητρώο **φιλτραρισμένο** στα αρχεία που
 * αντιγράφηκαν.
 *
 * 🔑 ΤΟ ΦΙΛΤΡΟ ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΟ, ΚΑΙ ΤΟ ΕΧΕΙ ΠΛΗΡΩΣΕΙ ΑΛΛΗ ΠΥΛΗ: το αντίστοιχο
 * `domain-vocabulary.test.js` αντέγραφε ΟΛΟΚΛΗΡΟ το μητρώο αλλά μόνο μερικά αρχεία,
 * και με το δεύτερο λεξιλόγιο άρχισε να αναφέρει 8 μπλοκάρουσες για ρίζα που υπάρχει
 * στο δέντρο και δεν αντιγράφηκε εκεί — δηλαδή tests κόκκινα για τον λόγο που ο
 * έλεγχός τους λέει ότι αποκλείει.
 */
function miniRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prodid-'));
  for (const rel of [...CODE_FILES, ...LOCALE_FILES]) {
    const src = path.join(REPO, rel);
    if (!fs.existsSync(src)) throw new Error(`ΦΡΟΥΡΟΣ: λείπει το πραγματικό αρχείο ${rel}`);
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const copied = new Set([...CODE_FILES, ...LOCALE_FILES]);
  const kept = cfg.declarations.filter((d) => copied.has(d.file));
  if (kept.length < 2) {
    throw new Error(`ΦΡΟΥΡΟΣ: το φιλτραρισμένο μητρώο έχει ${kept.length} δηλώσεις — `
      + 'μετονομάστηκαν ή διαγράφηκαν αρχεία; Το μίνι-repo θα δοκίμαζε κενό μητρώο.');
  }
  fs.writeFileSync(path.join(root, '.product-identity.json'),
    JSON.stringify({ ...cfg, declarations: kept }, null, 2));
  return root;
}

let tmpRoot;

const absOf = (root, list) => list.map((r) => path.join(root, r).replace(/\\/g, '/'));

function run(root, extra = {}) {
  return gate.measure({
    root,
    codeFiles: absOf(root, CODE_FILES),
    localeFiles: absOf(root, LOCALE_FILES),
    configPath: path.join(root, '.product-identity.json'),
    ...extra,
  });
}

/** Μεταλλάσσει ΜΙΑ φορά, μέσα στο μίνι-repo, και ουρλιάζει αν δεν άλλαξε τίποτα. */
function mutate(root, rel, from, to, options = {}) {
  const p = path.join(root, rel);
  fs.writeFileSync(p, mutateText(fs.readFileSync(p, 'utf8'), from, to, { ...options, label: rel }));
}

function mutateConfig(root, fn) {
  const p = path.join(root, '.product-identity.json');
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const before = JSON.stringify(cfg);
  fn(cfg);
  if (JSON.stringify(cfg) === before) throw new Error('ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ: το μητρώο δεν άλλαξε');
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
}

const blocking = (result) => result.findings.filter((f) => gate.BLOCKING.includes(f.state));
const states = (result) => blocking(result).map((f) => f.state);

beforeEach(() => { tmpRoot = miniRepo(); });
afterEach(() => { fs.rmSync(tmpRoot, { recursive: true, force: true }); });

describe('CHECK 3.81 — Μ0: το καθαρό δέντρο', () => {
  it('Μ0α ΠΑΡΟΝΟΜΑΣΤΗΣ — η πύλη ΚΟΙΤΑΖΕΙ: βρίσκει ρίζα, γραφές και δηλωμένα', () => {
    const r = run(tmpRoot);
    expect(r.tally[STATES.ROOT]).toBe(1);
    expect(r.spellings.length).toBeGreaterThanOrEqual(4);
    expect(r.tally[STATES.DECLARED]).toBeGreaterThan(0);
  });

  it('Μ0β — καμία μπλοκάρουσα παραβίαση σε καθαρό μίνι-repo', () => {
    expect(blocking(run(tmpRoot))).toEqual([]);
  });

  it('Μ0γ — το ΠΡΑΓΜΑΤΙΚΟ δέντρο είναι πράσινο (όχι μόνο το μίνι-repo)', () => {
    expect(blocking(gate.measure())).toEqual([]);
  });

  it('Μ0δ ΠΑΡΟΝΟΜΑΣΤΗΣ — το πραγματικό δέντρο ΕΞΕΤΑΖΕΙ χιλιάδες αρχεία, όχι δεκάδες', () => {
    expect(gate.measure().examined).toBeGreaterThan(1000);
  });
});

describe('CHECK 3.81 — Κ1: αδήλωτη γραφή, σε ΚΑΘΕ μορφή που κουβαλά κείμενο', () => {
  it('Μ1 — ωμό string literal ⇒ undeclared-writing', () => {
    mutate(tmpRoot, 'src/app/layout.tsx', 'variable: "--font-sans",',
      'variable: "--font-sans", brand: "Nestor Construct",');
    expect(states(run(tmpRoot))).toContain(STATES.UNDECLARED_WRITING);
  });

  /**
   * 🔴 Η ΚΛΑΣΗ ΠΟΥ Η ΧΕΙΡΩΝΑΚΤΙΚΗ ΑΠΟΓΡΑΦΗ ΔΕΝ ΕΒΛΕΠΕ. Το grep έψαχνε γραφές μέσα
   * σε **quoted literals** και βρήκε 15· η πύλη βρήκε 36. Η διαφορά ήταν κυρίως
   * JSXText — `<strong>Nestor Construct</strong>` σε **δύο δημόσιες σελίδες**.
   * Είναι το ίδιο τυφλό σημείο που δηλώνει ο N.11 για τον `no-hardcoded-strings`.
   */
  it('Μ2 — ωμό JSXText ⇒ undeclared-writing (η κλάση που έχασε η απογραφή)', () => {
    mutate(tmpRoot, 'src/app/layout.tsx', '<TourRenderer />', '<span>Nestor Construct</span>');
    expect(states(run(tmpRoot))).toContain(STATES.UNDECLARED_WRITING);
  });

  it('Μ3 — γραφή μέσα σε template literal ⇒ undeclared-writing', () => {
    mutate(tmpRoot, 'src/app/layout.tsx', 'variable: "--font-sans",',
      'variable: `--font-sans ΝΕΣΤΩΡ`,');
    expect(states(run(tmpRoot))).toContain(STATES.UNDECLARED_WRITING);
  });

  /**
   * Οι ΠΕΝΤΕ γραφές του κλειστού συνόλου — και μία **επινοημένη**: το `NestorApp`.
   *
   * 🔴 **ΔΕΝ ΕΙΝΑΙ ΥΠΟΘΕΤΙΚΗ — ΓΕΝΝΗΘΗΚΕ ΚΑΙ ΑΝΑΙΡΕΘΗΚΕ ΤΗΝ ΙΔΙΑ ΜΕΡΑ** (ADR-857 §7 #15):
   * μια βοηθητική `productFilenameToken()` στη ρίζα την έβγαλε σε **όνομα αρχείου που
   * κατεβάζει ο πελάτης**, και την έπιασε σουίτα που **καμία λίστα επαλήθευσης δεν έτρεχε**.
   * Μένει εδώ ως άγκυρα ακριβώς επειδή συνέβη. Η επινοημένη πιάνεται επειδή
   * περιέχει το `Nestor`: το σύνολο είναι κλειστό, αλλά το ταίριασμα είναι
   * **υποσυμβολοσειράς**, άρα καμία παραλλαγή δεν γλιστρά.
   */
  it.each([
    ['ΝΕΣΤΩΡ'], ['Nestor Construct'], ['Nestor Pagonis'], ['Nestor App'], ['NestorApp'],
  ])('Μ4 — η γραφή «%s» ΚΟΚΚΙΝΙΖΕΙ όπου δεν είναι δηλωμένη', (spelling) => {
    mutate(tmpRoot, 'src/app/layout.tsx', 'variable: "--font-sans",',
      `variable: "--font-sans", brand: "${spelling}",`);
    expect(states(run(tmpRoot))).toContain(STATES.UNDECLARED_WRITING);
  });

  it('Μ5 — αν σβηστεί η δήλωση, η ΥΠΑΡΧΟΥΣΑ γραφή γίνεται αμέσως εύρημα', () => {
    mutateConfig(tmpRoot, (cfg) => {
      cfg.declarations = cfg.declarations.filter((d) => d.file !== 'src/config/firebase-auth-config.ts');
    });
    const found = blocking(run(tmpRoot));
    expect(found.map((f) => f.state)).toContain(STATES.UNDECLARED_WRITING);
    expect(found.some((f) => f.file.includes('firebase-auth-config'))).toBe(true);
  });
});

describe('CHECK 3.81 — Κ2/Κ3: το κλειστό σύνολο δηλώσεων', () => {
  it('Μ6 — δήλωση για αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ ⇒ orphan-declaration', () => {
    mutateConfig(tmpRoot, (cfg) => {
      cfg.declarations.push({
        file: 'src/does/not/exist.ts', spellings: ['Nestor'], class: 'Δ',
        reason: 'λόγος αρκετά μακρύς ώστε να περάσει άνετα το κατώφλι των σαράντα χαρακτήρων',
      });
    });
    expect(states(run(tmpRoot))).toContain(STATES.ORPHAN_DECLARATION);
  });

  it('Μ7 — δήλωση για γραφή που ΕΦΥΓΕ από το αρχείο ⇒ orphan-declaration', () => {
    mutateConfig(tmpRoot, (cfg) => {
      const d = cfg.declarations.find((x) => x.file === 'src/config/firebase-auth-config.ts');
      d.spellings = ['Nestor Construct'];   // υπάρχει στο σύνολο, ΟΧΙ σε αυτό το αρχείο
    });
    expect(states(run(tmpRoot))).toContain(STATES.ORPHAN_DECLARATION);
  });

  /**
   * 🔴 ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΕΚΑΝΕ Ο ΙΔΙΟΣ Ο ΣΥΓΓΡΑΦΕΑΣ ΤΟΥ ΜΗΤΡΩΟΥ, ΚΑΙ ΤΟ ΒΡΗΚΕ Η ΠΡΩΤΗ
   * ΕΚΤΕΛΕΣΗ: δηλώθηκαν `NestorPagonisApp` / `NestorAec` — ονόματα όπως τα βλέπει
   * ο άνθρωπος, που όμως ΔΕΝ ανήκουν στο κλειστό σύνολο της ρίζας. Αποτέλεσμα:
   * 11 ορφανές + 11 αδήλωτες για ΤΑ ΙΔΙΑ σημεία.
   */
  it('Μ8 — δηλωμένη γραφή ΕΚΤΟΣ του κλειστού συνόλου ⇒ orphan ΜΕ ΕΞΗΓΗΣΗ', () => {
    mutateConfig(tmpRoot, (cfg) => {
      cfg.declarations.find((x) => x.file === 'src/config/firebase-auth-config.ts')
        .spellings = ['NestorPagonisApp'];
    });
    const found = blocking(run(tmpRoot));
    expect(found.map((f) => f.state)).toContain(STATES.ORPHAN_DECLARATION);
    expect(found.map((f) => f.detail).join(' ')).toContain('ΕΚΤΟΣ του κλειστού συνόλου');
  });

  it('Μ9 — δήλωση χωρίς επαρκή λόγο ⇒ reasonless-declaration', () => {
    mutateConfig(tmpRoot, (cfg) => {
      cfg.declarations.find((x) => x.file === 'src/config/firebase-auth-config.ts').reason = 'γιατί ναι';
    });
    expect(states(run(tmpRoot))).toContain(STATES.REASONLESS_DECLARATION);
  });
});

describe('CHECK 3.81 — Κ4: η ρίζα', () => {
  it('Μ10 — η ρίζα χάνει το PRODUCT_NAME ⇒ root-drift, ποτέ σιωπηλό «καθαρό»', () => {
    mutate(tmpRoot, ROOT_FILE, 'export const PRODUCT_NAME', 'export const PRODUCT_NAME_RENAMED');
    expect(states(run(tmpRoot))).toContain(STATES.ROOT_DRIFT);
  });

  it('Μ11 — οι παλιές γραφές αδειάζουν ⇒ root-drift (φρουρός χωρίς πληθυσμό)', () => {
    mutate(tmpRoot, ROOT_FILE, 'KNOWN_PAST_SPELLINGS: readonly string[] = [',
      'KNOWN_PAST_SPELLINGS: readonly string[] = []; const _unused = [');
    expect(states(run(tmpRoot))).toContain(STATES.ROOT_DRIFT);
  });

  it('Μ12 — η ρίζα λείπει τελείως ⇒ root-drift, ποτέ σιωπηλή παράλειψη', () => {
    fs.unlinkSync(path.join(tmpRoot, ROOT_FILE));
    expect(states(run(tmpRoot))).toContain(STATES.ROOT_DRIFT);
  });
});

describe('CHECK 3.81 — locales: ο ΔΕΥΤΕΡΟΣ κανόνας', () => {
  it('Μ13 — ΠΑΛΙΑ γραφή σε locale ⇒ undeclared-writing', () => {
    mutate(tmpRoot, 'src/i18n/locales/el/onboarding.json',
      'Καλωσήρθατε στο Nestor App', 'Καλωσήρθατε στο Nestor Construct');
    expect(states(run(tmpRoot))).toContain(STATES.UNDECLARED_WRITING);
  });

  it('Μ14 ΥΠΕΡ-ΕΥΑΙΣΘΗΣΙΑ — η ΚΑΝΟΝΙΚΗ γραφή σε locale ΠΕΡΝΑ (δεν μπορεί να εισάγει σταθερά)', () => {
    mutate(tmpRoot, 'src/i18n/locales/el/onboarding.json',
      'Καλωσήρθατε στο Nestor App', 'Καλώς ήρθατε ξανά στο Nestor App');
    expect(blocking(run(tmpRoot))).toEqual([]);
  });

  /**
   * ⚠️ Ο ΣΤΟΧΟΣ ΕΙΝΑΙ ΟΛΟΚΛΗΡΗ Η ΓΡΑΜΜΗ, ΕΠΙΤΗΔΕΣ. Η πρώτη γραφή αυτής της άγκυρας
   * στόχευε σκέτο το `"title":`, που εμφανίζεται **τρεις φορές** στο αρχείο — και ο
   * φρουρός ασάφειας του `_mutate` την **αρνήθηκε**. Σωστά: η αντικατάσταση θα
   * χτυπούσε σιωπηλά την πρώτη, και η άγκυρα θα «απεδείκνυε» κάτι που δεν δοκίμασε.
   */
  it('Μ15 — το ΚΛΕΙΔΙ δεν κρίνεται, μόνο η ΤΙΜΗ', () => {
    mutate(tmpRoot, 'src/i18n/locales/el/onboarding.json',
      '"title": "Καλωσήρθατε στο Nestor App"',
      '"titleNestorConstructΝΕΣΤΩΡ": "Καλωσήρθατε στο Nestor App"');
    expect(blocking(run(tmpRoot))).toEqual([]);
  });
});

describe('CHECK 3.81 — συμβόλαια', () => {
  /**
   * 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΔΙΚΑΙΟΛΟΓΕΙ ΟΛΟ ΤΟ AST. Το `src/app/layout.tsx` περιέχει σχόλιο
   * που ΤΕΚΜΗΡΙΩΝΕΙ τις τρεις παλιές γραφές. Σαρωτής κειμένου θα κοκκίνιζε πάνω
   * στη ΘΕΡΑΠΕΙΑ — και το ίδιο ισχύει για τρία ακόμη αρχεία του δέντρου.
   */
  it('Κ-Α — τα ΣΧΟΛΙΑ δεν γεννούν ευρήματα, ούτε όταν γράφουν ΚΑΘΕ παλιά γραφή', () => {
    const p = path.join(tmpRoot, 'src/app/layout.tsx');
    fs.writeFileSync(p, `${fs.readFileSync(p, 'utf8')}\n`
      + '// ΝΕΣΤΩΡ · Nestor Construct · Nestor Pagonis · Nestor App — τεκμηρίωση της βλάβης\n');
    expect(blocking(run(tmpRoot))).toEqual([]);
  });

  it('Κ-Β — κλειστή λογιστική: κάθε κατάσταση έχει κάδο, καμία σιωπηλή τρίτη', () => {
    const r = run(tmpRoot);
    expect(Object.keys(r.tally).sort()).toEqual(Object.values(STATES).sort());
  });

  it('Κ-Γ — ΟΛΕΣ οι μπλοκάρουσες τυπώνονται, ακόμα και στο μηδέν', () => {
    const lines = [];
    gate.report(run(tmpRoot), (l) => lines.push(l));
    for (const s of gate.BLOCKING) expect(lines.join('\n')).toContain(s);
  });

  it('Κ-Δ — η αναφορά ονομάζει τη ΘΕΡΑΠΕΙΑ, όχι μόνο το πρόβλημα', () => {
    mutate(tmpRoot, 'src/app/layout.tsx', 'variable: "--font-sans",',
      'variable: "--font-sans", brand: "Nestor Construct",');
    const lines = [];
    gate.report(run(tmpRoot), (l) => lines.push(l));
    expect(lines.join('\n')).toContain('ΘΕΡΑΠΕΙΑ');
  });

  it('Κ-Ε — σάρωση χωρίς αρχεία ⇒ ΑΡΝΗΣΗ, ποτέ σιωπηλό πράσινο', () => {
    expect(() => gate.measure({
      root: tmpRoot, configPath: path.join(tmpRoot, '.product-identity.json'),
    })).toThrow(/δεν κοίταξε/);
  });

  it('Κ-ΣΤ — το SKIP_ είναι ρητό και τυπώνεται', () => {
    const prev = process.env.SKIP_PRODUCT_IDENTITY;
    process.env.SKIP_PRODUCT_IDENTITY = '1';
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(gate.main()).toBe(0);
      expect(spy.mock.calls.flat().join(' ')).toContain('παραλείφθηκε');
    } finally {
      spy.mockRestore();
      if (prev === undefined) delete process.env.SKIP_PRODUCT_IDENTITY;
      else process.env.SKIP_PRODUCT_IDENTITY = prev;
    }
  });
});
