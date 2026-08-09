/**
 * CHECK 3.50 / ADR-780 — η πύλη της κλίμακας z-index ελέγχεται από τη ΔΙΚΗ της σουίτα.
 *
 * ΔΟΜΗ (ίδια με τα CHECK 3.35/3.39/3.41/3.44/3.47/3.48):
 *   Μ0       — το ΖΩΝΤΑΝΟ δέντρο, με **παρονομαστή**· και η βάση κάθε μετάλλαξης
 *   Μ1..Μ10  — μία ΜΕΤΑΛΛΑΞΗ ανά ρητή κατάσταση + ο αυτοέλεγχος διάταξης
 *   Π1..Π5   — ο ΠΡΑΓΜΑΤΙΚΟΣ κώδικας, με **χειρόγραφη** λίστα προσδοκίας
 *   Κ1..Κ9   — κοκκίωση: τι ΔΕΝ πιάνει και γιατί, δηλωμένο ως test και όχι ως ελπίδα
 *
 * 🔑 ΓΙΑΤΙ ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ **ΕΙΣΟΔΟΥΣ**, ΟΧΙ ΣΤΗΝ ΠΥΛΗ. Κάθε Μ αντιγράφει τα
 * **πραγματικά** αρχεία σε μίνι-repo και αλλάζει **μία** γραμμή — δηλαδή κάνει ακριβώς
 * αυτό που θα έκανε ένας άνθρωπος αύριο. Μετάλλαξη στον κώδικα της πύλης θα απεδείκνυε
 * μόνο ότι ο κώδικας εκτελείται· μετάλλαξη στην είσοδο αποδεικνύει ότι η πύλη **απαντά
 * το ερώτημα**.
 *
 * 🔑 ΓΙΑΤΙ ΤΑ Π ΕΙΝΑΙ ΧΕΙΡΟΓΡΑΦΑ, ΕΠΙΤΗΔΕΣ (ADR-587 §6.1). Ο σαρωτής παίρνει τους ρόλους
 * **από το `design-tokens.json`**. Ένα test που τους ξαναδιαβάζει από εκεί είναι πράσινο
 * και άχρηστο: θα συμφωνούσε με **οποιαδήποτε** τιμή. Τα Π γράφουν τους πέντε αριθμούς
 * με το χέρι, ώστε μια αθόρυβη αλλαγή τιμής να έχει **δεύτερη φωνή** να τη διαψεύσει.
 *
 * ⚠️ ΤΟ ΜΙΝΙ-REPO ΔΕΝ ΕΙΝΑΙ ΚΑΘΑΡΟ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ: κουβαλά τα **πραγματικά**
 * αρχεία, άρα και ζωντανές ωμές δηλώσεις. Οι μεταλλάξεις κρίνονται στη **διαφορά της
 * απογραφής**, όχι στο σύνολο· να τις συγκρίναμε με το κενό σύνολο θα σήμαινε είτε
 * ψεύτικο κόκκινο είτε — χειρότερα — προσαρμογή του κριτηρίου μέχρι να «βγει» ο αριθμός.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const gate = require('../check-zindex-scale');
const {
  readScale, findScaleDisorder, cssVarNameOf, toKebabCase,
  GLOBAL_LAYER_FLOOR, KEYWORDS,
} = require('../lib/zindex/scale');
const {
  STATES, ZERO_TOLERANCE, RATCHETED,
  findCssDeclarations, findParallelScaleDefs, findTsSites,
  stripImportant, classify, assertClosed,
} = require('../lib/zindex/sites');

const REPO_ROOT = path.join(__dirname, '..', '..');
const VARIABLES_CSS = 'src/styles/design-system/generated/variables.css';

/**
 * Τα αρχεία που **ορίζουν** την απάντηση — πραγματικά, αντιγραμμένα αυτούσια.
 * Επιλέχθηκαν επειδή μεταξύ τους εκθέτουν **και τις έξι** μη-μηδενικές καταστάσεις
 * του ζωντανού δέντρου, όχι επειδή είναι βολικά.
 */
const FIXTURE_FILES = [
  'design-tokens.json',                                          // η αυθεντία
  VARIABLES_CSS,                                                 // ο δείκτης ορισμών
  'src/app/globals.css',                                         // token · reference · local · raw
  'src/subapps/dxf-viewer/ui/ribbon/styles/ribbon-tokens.css',   // 6 scale-token, 3 ρόλοι
  'src/styles/design-tokens/modules/layout-utilities-constants.ts', // raw · runtime · reference
];

/**
 * Μίνι-repo με τα ΑΚΡΙΒΗ μονοπάτια που περιμένει ο σαρωτής.
 * `edits` = `{ 'σχετικό/μονοπάτι': (πηγή) => νέα πηγή }` — μία αλλαγή, πραγματικό αρχείο.
 */
function miniRepo(edits = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zx350-'));
  for (const rel of FIXTURE_FILES) {
    let source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    if (edits[rel]) {
      const next = edits[rel](source);
      // Μια μετάλλαξη που δεν άλλαξε τίποτα είναι ο ορισμός του νεκρού test
      // (μάθημα CHECK 3.44 / Μ11): ουρλιάζει αντί να περάσει πράσινη.
      if (next === source) throw new Error(`η μετάλλαξη στο ${rel} ΔΕΝ άλλαξε τίποτα.`);
      source = next;
    }
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, source);
  }
  return root;
}

const run = (edits = {}, args = []) => gate.measure(args, miniRepo(edits));

/** Προσάρτηση κανόνα CSS στο τέλος — ο φθηνότερος τρόπος να «γράψει κάτι» ένας άνθρωπος. */
const appendCss = (rule) => (source) => `${source}\n${rule}\n`;

const RIBBON = 'src/subapps/dxf-viewer/ui/ribbon/styles/ribbon-tokens.css';
const GLOBALS = 'src/app/globals.css';
const UTILS = 'src/styles/design-tokens/modules/layout-utilities-constants.ts';

/** Η απογραφή της **ανέπαφης** βάσης — κάθε Μ κρίνεται στη διαφορά της. */
let BASE;
beforeAll(async () => { BASE = (await run()).census; });

/** `{ raw-literal: +1 }` — μόνο οι κάδοι που άλλαξαν, με πρόσημο. */
function delta(census) {
  const out = {};
  for (const state of Object.values(STATES)) {
    const d = census[state] - BASE[state];
    if (d !== 0) out[state] = d;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Μ0 — αγκύρωση παλινδρόμησης
// ─────────────────────────────────────────────────────────────────────────────

describe('Μ0 — το ζωντανό δέντρο και η βάση των μεταλλάξεων', () => {
  it('η λογιστική κλείνει, ΚΑΙ έχει κρίνει σημεία (ο παρονομαστής)', async () => {
    const m = await gate.measure([]);
    const total = Object.values(m.census).reduce((a, b) => a + b, 0);
    expect(total).toBe(m.found.length);
    // ⚠️ Χωρίς αυτή τη γραμμή, ένας σαρωτής που δεν άνοιξε κανένα αρχείο θα ήταν
    // εξίσου «πράσινος» — το «0 = κανείς δεν κοίταξε» μέσα στο test που το κυνηγά.
    expect(m.found.length).toBeGreaterThanOrEqual(200);
  });

  it('το ζωντανό δέντρο ΔΕΝ έχει καμία παραβίαση μηδενικής ανοχής', async () => {
    // Αν αυτό γίνει κόκκινο, η πύλη μπλοκάρει **χωρίς** baseline — και σωστά:
    // ένα `unknown-token` βάφει `z-index: auto`, δηλαδή σιωπηλά λάθος στρώση.
    const m = await gate.measure([]);
    expect(m.zero).toEqual([]);
  });

  it('η ίδια η κλίμακα είναι διατεταγμένη — ο αυτοέλεγχος περνά ζωντανά', async () => {
    const m = await gate.measure([]);
    expect(m.disorder).toEqual([]);
  });

  it('το μίνι-repo μετράει και τις έξι μη-μηδενικές καταστάσεις (η βάση είναι χρήσιμη)', () => {
    expect(BASE[STATES.SCALE_TOKEN]).toBeGreaterThan(0);
    expect(BASE[STATES.SCALE_REFERENCE]).toBeGreaterThan(0);
    expect(BASE[STATES.RUNTIME_PROPERTY]).toBeGreaterThan(0);
    expect(BASE[STATES.LOCAL_STACKING]).toBeGreaterThan(0);
    expect(BASE[STATES.RAW_LITERAL]).toBeGreaterThan(0);
    expect(BASE[STATES.UNKNOWN_TOKEN]).toBe(0);
    expect(BASE[STATES.PARALLEL_SCALE]).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Μ1..Μ10 — μία μετάλλαξη ανά ρητή κατάσταση, ΣΤΙΣ ΕΙΣΟΔΟΥΣ
// ─────────────────────────────────────────────────────────────────────────────

describe('Μ — μεταλλάξεις στις εισόδους', () => {
  it('Μ1 — ωμός αριθμός ≥1000 σε CSS ⇒ raw-literal', async () => {
    const m = await run({ [RIBBON]: appendCss('.zx-probe { z-index: 5000; }') });
    expect(delta(m.census)).toEqual({ [STATES.RAW_LITERAL]: 1 });
  });

  it('Μ2 — ωμός αριθμός ≥1000 σε Tailwind arbitrary ⇒ raw-literal (η δεύτερη διάλεκτος)', async () => {
    const m = await run({ [UTILS]: (s) => `${s}\nexport const probe = 'z-[4321]';\n` });
    expect(delta(m.census)).toEqual({ [STATES.RAW_LITERAL]: 1 });
  });

  it('Μ3 — ωμός αριθμός ≥1000 σε inline style ⇒ raw-literal (η τρίτη διάλεκτος)', async () => {
    const m = await run({ [UTILS]: (s) => `${s}\nexport const probe = { zIndex: 4322 };\n` });
    expect(delta(m.census)).toEqual({ [STATES.RAW_LITERAL]: 1 });
  });

  it('Μ4 — τυπογραφικό σε όνομα ρόλου ⇒ unknown-token, και η πύλη ΠΕΤΑΕΙ (zero-tol)', async () => {
    // ⚠️ Το πρόθεμα `z-index:` ΔΕΝ είναι διακοσμητικό: η **πρώτη** εμφάνιση του
    // `var(--z-index-sticky)` στο πραγματικό αρχείο ζει μέσα σε **σχόλιο** (γρ. 30).
    // Η πρώτη γραφή αυτού του test μετάλλαξε το σχόλιο, ο σαρωτής το αφαίρεσε, και η
    // «μετάλλαξη» δεν άλλαξε τίποτα — δες Κ7β, που το κλειδώνει ως ιδιότητα.
    const edits = { [RIBBON]: (s) => s.replace('z-index: var(--z-index-sticky);', 'z-index: var(--z-index-stickyy);') };
    await expect(run(edits)).rejects.toThrow(/μηδενικής ανοχής/);
    // Και η κατάσταση είναι ονομασμένη — όχι σιωπηλή απόρριψη:
    const m = await run(edits, ['--report']);
    expect(delta(m.census)).toEqual({ [STATES.SCALE_TOKEN]: -1, [STATES.UNKNOWN_TOKEN]: 1 });
  });

  it('Μ5 — ΟΡΙΣΜΟΣ δεύτερης κλίμακας ⇒ parallel-scale, και η πύλη ΠΕΤΑΕΙ (zero-tol)', async () => {
    const edits = { [RIBBON]: appendCss(':root { --legacy-z-menu: 9999; }') };
    await expect(run(edits)).rejects.toThrow(/μηδενικής ανοχής/);
    const m = await run(edits, ['--report']);
    expect(delta(m.census)).toEqual({ [STATES.PARALLEL_SCALE]: 1 });
  });

  it('Μ6 — ΧΡΗΣΗ ονόματος ορισμένου εκτός κλίμακας ⇒ parallel-scale (άλλος κλάδος από τον Μ5)', async () => {
    // ⚠️ Το `--menu-layer` δεν έχει `-z-`, άρα ο ανιχνευτής ΟΡΙΣΜΩΝ δεν το βλέπει·
    // το πιάνει η **χρήση**. Δύο δρόμοι προς την ίδια κατάσταση, και οι δύο ζωντανοί.
    const edits = { [RIBBON]: appendCss(':root { --menu-layer: 9999; }\n.zx { z-index: var(--menu-layer); }') };
    await expect(run(edits)).rejects.toThrow(/μηδενικής ανοχής/);
    const m = await run(edits, ['--report']);
    expect(delta(m.census)).toEqual({ [STATES.PARALLEL_SCALE]: 1 });
  });

  it('Μ7 — αριθμός κάτω από το κατώφλι ⇒ local-stacking, ΟΧΙ παράβαση', async () => {
    const m = await run({ [RIBBON]: appendCss('.zx-probe { z-index: 7; }') });
    expect(delta(m.census)).toEqual({ [STATES.LOCAL_STACKING]: 1 });
  });

  it('Μ8 — λέξη-κλειδί ⇒ keyword, ΟΧΙ παράβαση', async () => {
    // Το ζωντανό δέντρο έχει **μηδέν** `z-index: auto`, άρα ο κάδος `keyword` δεν
    // ασκείται πουθενά αλλού. Ένας κάδος που δηλώνεται αλλά δεν ασκείται ΠΟΤΕ είναι
    // φρουρός χωρίς απόδειξη ζωής (μάθημα CHECK 3.39 / Μμ7).
    expect(BASE[STATES.KEYWORD]).toBe(0);
    const m = await run({ [RIBBON]: appendCss('.zx-probe { z-index: auto; }') });
    expect(delta(m.census)).toEqual({ [STATES.KEYWORD]: 1 });
  });

  it('Μ9 — namespace βιβλιοθήκης ⇒ runtime-property, ΟΧΙ unknown-token', async () => {
    const m = await run({ [RIBBON]: appendCss('.zx-probe { z-index: var(--radix-popper-layer); }') });
    expect(delta(m.census)).toEqual({ [STATES.RUNTIME_PROPERTY]: 1 });
  });

  it('Μ10 — η ΘΕΡΑΠΕΙΑ φαίνεται: ωμό → ρόλος μειώνει το raw-literal', async () => {
    // Η αντίστροφη κατεύθυνση. Χωρίς αυτό, μια πύλη που μετρά μόνο «χειροτέρεψε;»
    // δεν αποδεικνύει ποτέ ότι η σωστή πράξη **αναγνωρίζεται** ως σωστή.
    const m = await run({ [UTILS]: (s) => s.replace("modal: 'z-[1000]'", "modal: 'z-[var(--z-index-modal)]'") });
    expect(delta(m.census)).toEqual({ [STATES.RAW_LITERAL]: -1, [STATES.SCALE_TOKEN]: 1 });
  });

  it('Μ11 — ρόλος εκτός σειράς ⇒ ο ΑΥΤΟΕΛΕΓΧΟΣ της κλίμακας πετάει', async () => {
    // Η σειρά των κλειδιών στο JSON **είναι** το ανθρώπινο νόημα· κανένας
    // μεταγλωττιστής δεν έχει γνώμη για τη σειρά κλειδιών ενός JSON.
    const edits = {
      'design-tokens.json': (s) => s.replace('"viewerPalette": { "value": "9900"', '"viewerPalette": { "value": "8000"'),
    };
    await expect(run(edits)).rejects.toThrow(/δεν είναι διατεταγμένη/);
  });

  it('Μ12 — δύο ρόλοι με την ΙΔΙΑ τιμή πετάνε (γνησίως αύξουσα, όχι μη-φθίνουσα)', () => {
    const roles = [{ role: 'a', value: 1000 }, { role: 'b', value: 1000 }];
    // Δύο ονόματα για ένα σκαλί ⇒ η σειρά τους αποφασίζεται από τη σειρά DOM,
    // που είναι ακριβώς η κατάσταση που η κλίμακα υπάρχει για να μην αφήνει στην τύχη.
    expect(findScaleDisorder(roles)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Π — ο πραγματικός κώδικας, με ΧΕΙΡΟΓΡΑΦΗ προσδοκία
// ─────────────────────────────────────────────────────────────────────────────

describe('Π — ο πραγματικός κώδικας', () => {
  it('Π1 — οι πέντε ρόλοι του viewer έχουν ΑΚΡΙΒΩΣ τις τιμές που έβαφε ο κώδικας πριν', () => {
    // Χειρόγραφα, επίτηδες: αυτοί οι πέντε αριθμοί ΕΙΝΑΙ η απόδειξη ότι η μετανάστευση
    // ήταν μηδενικής οπτικής αλλαγής (ADR-780 §5.4). Αν αλλάξουν, κάτι μετακινήθηκε.
    const byRole = Object.fromEntries(readScale(REPO_ROOT).map((r) => [r.role, r.value]));
    expect(byRole.viewerModal).toBe(9000);
    expect(byRole.viewerModalNested).toBe(9001);
    expect(byRole.viewerPalette).toBe(9900);
    expect(byRole.viewerMenu).toBe(9999);
    expect(byRole.viewerTransient).toBe(10000);
  });

  it('Π2 — ΚΑΘΕ ρόλος παράγει όνομα που ΥΠΑΡΧΕΙ στο variables.css', () => {
    // 🔑 Η **μοναδική** αντιστάθμιση για το δηλωμένο όριο του `cssVarNameOf`: αντιγράφει
    // τη γραμματική του generator. Αν οι δύο γραμματικές αποκλίνουν, αυτό γίνεται
    // κόκκινο **εδώ** αντί να γίνει σιωπηλό `unknown-token` στην παραγωγή.
    const css = fs.readFileSync(path.join(REPO_ROOT, VARIABLES_CSS), 'utf8');
    const missing = readScale(REPO_ROOT)
      .map((r) => r.cssVar)
      .filter((name) => !new RegExp(`${name}\\s*:`).test(css));
    expect(missing).toEqual([]);
  });

  it('Π3 — τα ΔΥΟ παράλληλα λεξιλόγια δεν ορίζονται πουθενά πια', () => {
    // `--cp-z-*` (5 ορισμοί) και `--ribbon-z-context-menu` διαγράφηκαν στο ADR-780 §5.3.
    // Ό,τι απομένει με αυτά τα ονόματα είναι **σχόλιο** — και ο σαρωτής αφαιρεί σχόλια.
    const defs = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (full.endsWith('.css')) {
          const text = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
          if (/--cp-z-[a-z]+\s*:|--ribbon-z-context-menu\s*:/.test(text)) defs.push(full);
        }
      }
    };
    walk(path.join(REPO_ROOT, 'src'));
    expect(defs).toEqual([]);
  });

  it('Π4 — το SSoT του TS ΔΕΝ ξαναγράφει τους αριθμούς με το χέρι', () => {
    // Ο χειρόγραφος καθρέφτης («Synced with…») ήταν το λεξιλόγιο #2 και δεν τον
    // επέβαλλε **καμία** πύλη — ίδιο σχήμα με τις δύο λίστες namespace του CHECK 3.34.
    const layout = fs.readFileSync(path.join(REPO_ROOT, 'src/styles/design-tokens/modules/layout.ts'), 'utf8');
    expect(layout).toMatch(/\.\.\.zIndexScale/);
    expect(layout).not.toMatch(/dropdown\s*:\s*1000/);
    expect(layout).not.toMatch(/tooltip\s*:\s*1800/);
  });

  it('Π5 — το κατώφλι είναι 1000 και δεν έχει μετακινηθεί', () => {
    // Χειρόγραφο: το 1000 επιβεβαιώνεται ανεξάρτητα από Atlas · Salt · Bootstrap.
    // Αν κατέβαινε, ο θόρυβος θα ξεπερνούσε τον πήχη <10% ψευδώς θετικών.
    expect(GLOBAL_LAYER_FLOOR).toBe(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Κ — κοκκίωση: τι ΔΕΝ πιάνει, δηλωμένο ως test
// ─────────────────────────────────────────────────────────────────────────────

describe('Κ — τα όρια, γραμμένα ρητά', () => {
  const NO_DEFS = new Map();
  const SCALE = new Map([['--z-index-viewer-menu', { value: 9999 }]]);

  it('Κ1 — ΕΠΙΛΟΓΕΑΣ που περιέχει "z-index: 99999" ΔΕΝ είναι δήλωση', () => {
    // Πραγματικό, από το `globals.css`: κυνηγά inline style του dev overlay του Next.js,
    // δηλαδή **άμυνα**, όχι παράβαση. Ένα σκέτο /z-index\s*:/ θα το μετρούσε 99999.
    const css = 'div[style*="z-index: 99999" i]:not([class*="nextjs"]) { display: none; }';
    expect(findCssDeclarations(css)).toEqual([]);
  });

  it('Κ1β — και ο ζωντανός κανόνας του globals.css δεν παράγει εύρημα 99999', async () => {
    const m = await gate.measure([]);
    expect(m.found.filter((f) => f.file === GLOBALS && f.raw.includes('99999'))).toEqual([]);
  });

  it('Κ2 — `var(--ρόλος, 9999)` κρίνεται token, ΟΧΙ ωμό (η σειρά κλάδων είναι συμβόλαιο)', () => {
    // Περιέχει **και** τα δύο. Αν ο αριθμός κρινόταν πρώτος, κάθε νόμιμο fallback θα
    // γινόταν παράβαση — και η θεραπεία θα ήταν να **αφαιρεθεί** το fallback.
    expect(classify('var(--z-index-viewer-menu, 9999)', NO_DEFS, SCALE).state)
      .toBe(STATES.SCALE_TOKEN);
  });

  it('Κ3 — `!important` ΔΕΝ κρύβει ωμή δήλωση', () => {
    // 🔴 Ήταν ζωντανό ψευδές πράσινο: `Number('2147483647 !important')` = NaN ⇒ ο
    // ταξινομητής έπεφτε στον κλάδο «έκφραση TS» και έβαφε ✅ **scale-reference**.
    expect(stripImportant('2147483647 !important')).toBe('2147483647');
    expect(classify('2147483647 !important', NO_DEFS, SCALE).state).toBe(STATES.RAW_LITERAL);
    expect(classify('20 !important', NO_DEFS, SCALE).state).toBe(STATES.LOCAL_STACKING);
    expect(classify('var(--z-index-viewer-menu) !important', NO_DEFS, SCALE).state)
      .toBe(STATES.SCALE_TOKEN);
  });

  it('Κ3β — και οι ΕΞΙ `2147483647 !important` του globals.css μετρώνται ωμές', async () => {
    // Είναι ακριβώς οι έξι που **νικούν** το `--z-index-critical` (ο αγωγός CSS το
    // στρογγυλοποιεί σε 2147480000, ADR-780 §4.4). Η πύλη ήταν πράσινη πάνω τους.
    const m = await gate.measure([]);
    const six = m.found.filter((f) => f.file === GLOBALS && f.raw.startsWith('2147483647'));
    expect(six).toHaveLength(6);
    expect(six.every((f) => f.state === STATES.RAW_LITERAL)).toBe(true);
  });

  it('Κ4 — έκφραση TS ΔΕΝ είναι ωμός αριθμός (δηλωμένο όριο: δεν αποτιμάται)', () => {
    // `zIndex: zIndex.tooltip` περνά ως `scale-reference`. Η πύλη **δεν** εκτελεί TS,
    // άρα δεν ξέρει αν η έκφραση καταλήγει σε ρόλο ή σε ωμό αριθμό. Δηλωμένο, όχι κρυφό.
    expect(classify('zIndex.tooltip', NO_DEFS, SCALE).state).toBe(STATES.SCALE_REFERENCE);
    expect(classify('base + 10', NO_DEFS, SCALE).state).toBe(STATES.SCALE_REFERENCE);
  });

  it('Κ5 — ιδιωτική `--x-z-badge: 3` είναι τοπική στοίβαξη με όνομα, ΟΧΙ αντίπαλο λεξιλόγιο', () => {
    expect(findParallelScaleDefs(':root { --panel-z-badge: 3; }')).toEqual([]);
    expect(findParallelScaleDefs(':root { --panel-z-badge: 3000; }')).toHaveLength(1);
  });

  it('Κ6 — ο ΔΙΚΟΣ μας πρόθεμα εξαιρείται (αλλιώς η κλίμακα καταγγέλλει τον εαυτό της)', () => {
    expect(findParallelScaleDefs(':root { --z-index-viewer-menu: 9999; }')).toEqual([]);
  });

  it('Κ7 — σχόλιο σε TS ΔΕΝ είναι δήλωση', () => {
    expect(findTsSites('// zIndex: 9999\nconst a = 1;')).toEqual([]);
    expect(findTsSites('/* z-[9999] */')).toEqual([]);
  });

  it('Κ7β — ούτε σχόλιο σε CSS είναι δήλωση, ΚΑΙ ΑΥΤΟ ΤΟ ΒΡΗΚΕ ΜΙΑ ΑΠΟΤΥΧΙΑ', async () => {
    // Η πρώτη γραφή του Μ4 μετάλλαξε το `var(--z-index-sticky)` που ζει στη γραμμή 30
    // του `ribbon-tokens.css` — **μέσα σε σχόλιο** που τεκμηριώνει τη διαγραφή του
    // `--ribbon-z-context-menu`. Η απογραφή δεν κουνήθηκε. Ένα σχόλιο που τεκμηριώνει
    // παλιό λεξιλόγιο ΔΕΝ πρέπει να μετριέται ως ζωντανό λεξιλόγιο, αλλιώς κάθε ADR
    // που περιγράφει τη βλάβη θα γινόταν το ίδιο βλάβη.
    const m = await run({ [RIBBON]: (s) => s.replace('/* 🔴 ΤΟ `--ribbon-z-context-menu: 1100`', '/* 🔴 z-index: 4242; ΤΟ `--ribbon-z-context-menu: 1100`') });
    expect(delta(m.census)).toEqual({});
  });

  it('Κ8 — η λογιστική είναι fail-closed: άγνωστη κατάσταση ΠΕΤΑΕΙ με όνομα', () => {
    // Ένα άθροισμα που κλείνει χωρίς να ρωτά «ποιος κρίθηκε;» επικυρώνει τον εαυτό του.
    expect(() => assertClosed([{ state: 'επινοημένη', file: 'a.css', line: 1 }]))
      .toThrow(/άγνωστη κατάσταση "επινοημένη"/);
    expect(assertClosed([])[STATES.RAW_LITERAL]).toBe(0);
  });

  it('Κ9 — τα zero-tolerance ΔΕΝ μπαίνουν ΠΟΤΕ στη baseline', async () => {
    // *Ένα zero-tol που κλειδώνεται με ένα `--write-baseline` δεν είναι zero-tol*
    // (μάθημα CHECK 3.44). Ο έλεγχος είναι στο ίδιο το φορτίο, όχι στην πρόθεση.
    const m = await run({ [RIBBON]: appendCss(':root { --legacy-z-menu: 9999; }') }, ['--report']);
    const payload = gate.buildPayload(m);
    expect(payload.violations.some((id) => id.includes(STATES.PARALLEL_SCALE))).toBe(false);
    expect(payload.violations.some((id) => id.includes(STATES.UNKNOWN_TOKEN))).toBe(false);
    expect(payload.by_state[STATES.PARALLEL_SCALE]).toBe(1); // μετριέται, δεν κλειδώνεται
  });

  it('Κ10 — το `--report` ΔΕΝ πετάει στις zero-tol (το χρειάζεσαι όταν είναι κόκκινη)', async () => {
    const edits = { [RIBBON]: (s) => s.replace('z-index: var(--z-index-sticky);', 'z-index: var(--z-index-nowhere);') };
    await expect(run(edits)).rejects.toThrow();
    await expect(run(edits, ['--report'])).resolves.toBeDefined();
  });

  it('Κ11 — `readScale` είναι fail-closed: κενή ή άκυρη κλίμακα ΠΕΤΑΕΙ', () => {
    const noRoot = miniRepo({ 'design-tokens.json': (s) => s.replace('"zIndex"', '"zIndexOLD"') });
    expect(() => readScale(noRoot)).toThrow(/λείπει η ρίζα "zIndex"/);

    const notInt = miniRepo({ 'design-tokens.json': (s) => s.replace('"viewerPalette": { "value": "9900"', '"viewerPalette": { "value": "ψηλά"') });
    expect(() => readScale(notInt)).toThrow(/δεν είναι ακέραιος/);
  });

  it('Κ12 — η γραμματική ονόματος είναι kebab, και οι λέξεις-κλειδιά είναι κλειστό σύνολο', () => {
    expect(toKebabCase('viewerModalNested')).toBe('viewer-modal-nested');
    expect(cssVarNameOf('viewerModalNested')).toBe('--z-index-viewer-modal-nested');
    // Το `auto` λέει «**μη** δημιουργείς stacking context» — είναι το αντίθετο στρώσης.
    expect(KEYWORDS.has('auto')).toBe(true);
    expect(KEYWORDS.has('9999')).toBe(false);
  });

  it('Κ13 — οι δύο μηχανισμοί είναι ξένοι μεταξύ τους (καμία κατάσταση σε δύο κάδους)', () => {
    expect(ZERO_TOLERANCE.filter((s) => RATCHETED.includes(s))).toEqual([]);
    for (const s of [...ZERO_TOLERANCE, ...RATCHETED]) {
      expect(Object.values(STATES)).toContain(s);
    }
  });
});
