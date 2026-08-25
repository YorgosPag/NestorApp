/**
 * ΑΓΚΥΡΑ — Ο **ΠΡΟΟΡΙΣΜΟΣ** ΤΟΥ FIREBASE ΣΤΟΝ ΠΕΛΑΤΗ (ADR-807)
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ — «ΜΗ ΕΓΚΥΡΑ ΣΤΟΙΧΕΙΑ ΣΥΝΔΕΣΗΣ» ΠΟΥ ΗΤΑΝ ΛΑΘΟΣ **ΠΡΟΟΡΙΣΜΟΥ**
 *
 * Το `dev:emulator` έθετε `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` **μόνο στο
 * process**. Το Next/Turbopack ενσωματώνει στο client bundle τα `NEXT_PUBLIC_*`
 * που **γνωρίζει** — από `.env*` ή από το κλειδί `env` του `next.config.js`. Μια
 * μεταβλητή που υπάρχει μόνο στο process **δεν ενσωματώνεται**: μένει runtime
 * lookup πάνω στο `next/dist/build/polyfills/process.js`, που στον browser είναι
 * **κενό** ⇒ `undefined === 'true'` ⇒ **false, πάντα**.
 *
 * Μετρημένο στο ίδιο bundle (2026-08-25): ο Admin SDK (server) πήγαινε στον
 * emulator, ο **client** στην **παραγωγή**. Ο demo χρήστης υπάρχει μόνο στον
 * emulator ⇒ το σύμπτωμα έφτανε στον άνθρωπο ως λάθος **διαπιστευτηρίων**.
 *
 * ⚠️ **ΚΑΙ Ο ΦΡΟΥΡΟΣ ΗΤΑΝ ΑΔΡΑΝΗΣ**: το `connectEmulatorOrReport` (ADR-745 Φάση Γ)
 * γράφτηκε ακριβώς γι' αυτό, αλλά τυπώνει ✅/⚠️ **ΜΕΣΑ** στο `if` — που δεν
 * αλήθευε ποτέ. **Δεν σιωπούσε επειδή πέτυχε· σιωπούσε επειδή δεν εκτελέστηκε**
 * (ADR-749 §5). Το ADR-745 πίστεψε ότι έφταιγε το σιωπηλό `catch {}`: **σωστό
 * όνομα βλάβης, λάθος αιτία.**
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΕΣΣΕΡΙΣ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ, **ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή»**
 *
 * Το κριτήριο του διαχωρισμού είναι ότι έχουν **διαφορετική θεραπεία** (μάθημα
 * CHECK 3.41). Ένας κανόνας με «ή» θα έμενε **πράσινος πάνω στο μισό ελάττωμα**:
 *
 *   Κ1  Η ΠΑΡΑΓΩΓΗ    → *«δηλώσου στο `env` του `next.config.js`»*
 *   Κ2  ΕΝΑΣ ΓΡΑΦΕΑΣ  → *«σβήσε τον δεύτερο διακόπτη»*
 *   Κ3  Ο ΦΡΟΥΡΟΣ ΕΞΩ → *«βγάλε τον έλεγχο έξω από το `if` που κρίνει»*
 *   Κ4  ΤΟ ARTIFACT   → *«το Next έπαψε να τιμά το `env` — μέτρησέ το ξανά»*
 *
 * Την ημέρα που γράφτηκε, ο **Κ2 ήταν ΚΟΚΚΙΝΟΣ** σε **δύο** ζωντανά αρχεία
 * (`scripts/qa-tests/run-qa-clean.sh|.ps1`): ο δεύτερος διακόπτης δεν είχε
 * αφαιρεθεί — είχε **μετακομίσει**. Κανένας άλλος κανόνας δεν τον έβλεπε.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΓΙΑΤΙ Ο Κ1 ΔΕΝ ΕΙΝΑΙ ΚΥΚΛΙΚΟΣ ΠΑΡΟΝΟΜΑΣΤΗΣ
 *
 * Ένας έλεγχος που διάβαζε το **κείμενο** του `next.config.js` θα ρωτούσε τον
 * ίδιο τον κριτή αν είναι σωστός (ADR-790 §9.1). Ο Κ1 δεν διαβάζει κείμενο:
 * **εκτελεί** το config σε **δύο ξεχωριστές διεργασίες**, με και χωρίς το
 * `FIREBASE_AUTH_EMULATOR_HOST`, και απαιτεί **διαφορετική** απάντηση. Έτσι
 * αποδεικνύεται η **παραγωγή** — κάτι που ένα καρφωμένο `'true'` δεν μπορεί να
 * περάσει, όσο σωστό κι αν φαίνεται διαβασμένο.
 *
 * ⚠️ **ΞΕΧΩΡΙΣΤΗ ΔΙΕΡΓΑΣΙΑ, ΥΠΟΧΡΕΩΤΙΚΑ**: το `next.config.js` διαβάζει το
 * `process.env` **τη στιγμή που φορτώνεται**, και το `require` απομνημονεύει.
 * Δύο κλήσεις στην ίδια διεργασία θα έδιναν την ίδια απάντηση, δηλαδή θα
 * **επικύρωναν τον εαυτό τους**.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ Κ3 — ΤΟ ΣΗΜΕΙΟ ΠΟΥ ΤΟΝ ΚΑΝΕΙ ΑΓΚΥΡΑ
 *
 * Το «ο φρουρός ζει έξω από το `if`» είναι εύκολο να είναι **πράσινο επειδή δεν
 * κοίταξε τίποτα**: αν το AST δεν βρει τον φρουρό, ο έλεγχος περνά κενός. Γι'
 * αυτό ο Κ3 απαιτεί **ΚΑΙ ΤΟ ΑΝΤΙΘΕΤΟ**: το `connectAuthEmulator` **ΠΡΕΠΕΙ** να
 * βρίσκεται **ΜΕΣΑ** σε `if` που κρίνει τη σημαία. Ένα AST που δεν ξεχωρίζει τα
 * δύο δεν αποδεικνύει τίποτα για κανένα.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔶 ΔΗΛΩΜΕΝΟ ΟΡΙΟ ΤΟΥ Κ4 — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΓΙΝΕΤΑΙ ΣΙΩΠΗΛΟ
 *
 * Ο Κ4 είναι ο **μόνος** που κρίνει το πραγματικό build artifact, δηλαδή ο μόνος
 * που αποδεικνύει την τελική αξίωση *«η τιμή έφτασε στον browser»*. Απαιτεί όμως
 * build, και το `jest-suite.yml` **δεν χτίζει**. Δύο δρόμοι απορρίφθηκαν:
 *
 *   • **αποτυχία χωρίς artifact** ⇒ μονίμως κόκκινο στο CI ⇒ `SKIP_` ⇒
 *     διακοσμητικό (δοκιμάστηκε και απορρίφθηκε ρητά στο CHECK 3.39)·
 *   • **σιωπηλό πέρασμα** ⇒ το «0 = κανείς δεν κοίταξε», το σχήμα που αυτό το
 *     repo έχει πληρώσει **οκτώ** φορές.
 *
 * Κρατήθηκε το **ρητό skip**: όταν δεν υπάρχει κανένα chunk που να **αναφέρει**
 * τη σημαία, ο Κ4 εμφανίζεται στην αναφορά του jest ως `○ skipped` — ορατό, όχι
 * πράσινο. Η λογιστική (Λ1) τυπώνει τους αριθμούς **ακόμα και στο μηδέν**.
 *
 * @jest-environment node
 * @see docs/centralized-systems/reference/adrs/ADR-807-firebase-client-destination.md
 * @see docs/centralized-systems/reference/adrs/ADR-745-titleblock-live-binding.md — Φάση Γ, η προηγούμενη (λάθος) διάγνωση
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ts = require('typescript');
const { stripComments, stripHashComments } = require('../lib/source-text');

const ROOT = path.join(__dirname, '..', '..');

/** Η σημαία που κρίνει ο πελάτης. */
const FLAG = 'NEXT_PUBLIC_USE_FIREBASE_EMULATOR';
/** Η **μία** πηγή από την οποία παράγεται — αυτή που ήδη στρέφει τον Admin SDK. */
const SOURCE_ENV = 'FIREBASE_AUTH_EMULATOR_HOST';
/** Ο **μοναδικός** γραφέας. Κλειστό σύνολο: ούτε λιγότεροι, ούτε περισσότεροι. */
const DECLARED_WRITERS = ['next.config.js'];

const CONFIG_PATH = path.join(ROOT, 'next.config.js');
const CLIENT_MODULE = path.join(ROOT, 'src', 'lib', 'firebase.ts');

// =============================================================================
// ΕΡΓΑΛΕΙΑ
// =============================================================================

/**
 * Η τιμή που θα ενσωματωθεί στο client bundle, όπως την **παράγει** το config
 * όταν το `FIREBASE_AUTH_EMULATOR_HOST` έχει (ή δεν έχει) τιμή.
 *
 * ⚠️ Ξεχωριστή διεργασία ανά κλήση — δες την ενότητα του Κ1 παραπάνω.
 */
function flagProducedWhen(hostValue) {
  const script = [
    'const c = require(process.argv[1]);',
    'const cfg = typeof c === "function" ? c() : (c && c.default ? c.default : c);',
    'const env = (cfg && cfg.env) || {};',
    'process.stdout.write(String(env[process.argv[2]]));',
  ].join('\n');

  const env = { ...process.env };
  delete env[SOURCE_ENV];
  if (hostValue !== null) env[SOURCE_ENV] = hostValue;

  return execFileSync(process.execPath, ['-e', script, CONFIG_PATH, FLAG], {
    env,
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** Τα **tracked** αρχεία που αναφέρουν καθόλου τη σημαία. Κενό ⇒ κενός πίνακας. */
function trackedFilesMentioningFlag() {
  try {
    return execFileSync('git', ['grep', '-l', '--fixed-strings', '-e', FLAG], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    // `git grep` βγαίνει με 1 όταν δεν βρει τίποτα — απουσία, όχι σφάλμα.
    return [];
  }
}

/**
 * Το κείμενο ενός αρχείου **χωρίς τα σχόλιά του**.
 *
 * 🔴 Χωρίς αυτό η άγκυρα κοκκινίζει πάνω στην **τεκμηρίωση της θεραπείας**: το
 * `src/lib/firebase.ts` αναφέρει τη σημαία σε σχόλιο, και το ίδιο αυτό αρχείο
 * την αναφέρει σε ολόκληρο docblock. Είναι το `Κ7β` του CHECK 3.50.
 */
function executableTextOf(relativePath) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  if (/\.(sh|ps1|ya?ml)$/i.test(relativePath)) return stripHashComments(source);
  return stripComments(source);
}

/**
 * **Αναθέτει** το αρχείο τιμή στη σημαία;
 *
 * Δεκτές μορφές: `FLAG=…` *(shell/cross-env)* · `$env:FLAG = …` *(PowerShell)* ·
 * `process.env.FLAG = …` *(JS)* · `FLAG: …` **δεν** μετρά ως ανάθεση shell αλλά
 * πιάνεται ως κλειδί αντικειμένου στο `next.config.js`, που είναι ο δηλωμένος
 * γραφέας.
 *
 * ⚠️ Το `(?!=)` αποκλείει το **σύγκριση** `=== 'true'`: ο **αναγνώστης** δεν
 * είναι γραφέας, και χωρίς αυτό ο μοναδικός νόμιμος καταναλωτής θα καταγγελλόταν.
 */
function assignsFlag(text) {
  const assignment = new RegExp('(^|[\\s;&|.:])' + FLAG + '\\s*[=:](?!=)');
  return assignment.test(text);
}

/**
 * Ο **ΕΝΑΣ** κατάλογος build που κρίνεται — ρωτώντας το SSoT, ποτέ με `readdir`.
 *
 * 🔴 **Η ΠΡΩΤΗ ΓΡΑΦΗ ΣΑΡΩΝΕ ΚΑΘΕ `.next*` ΚΑΙ ΗΤΑΝ ΛΑΘΟΣ ΠΑΡΟΝΟΜΑΣΤΗΣ.** Το δέντρο
 * κρατά **παγωμένους** καταλόγους από άλλα εργαλεία (`.next-oracle` του χρησμού
 * 3.51, `.next-3100`, `.next-bundlecheck`). Χτίστηκαν από **άλλη** πηγή, οπότε
 * μια αξίωση για τον **σημερινό** κώδικα δεν αποδεικνύεται ούτε καταρρίπτεται
 * από αυτούς: την ημέρα που γράφτηκε η άγκυρα ανέφεραν **20** runtime lookups
 * — αληθινούς **για τον κώδικα του Ιουλίου**. Ήταν κρίση **ιστορίας**.
 *
 * ⚠️ **ΟΧΙ `mtime` για φρεσκάδα**: ένα `git checkout` το αλλάζει χωρίς να αλλάξει
 * τίποτα (μάθημα CHECK 3.33). Η αυθεντία είναι **δήλωση**, όχι ρολόι: το
 * `resolveBuildDir()` ρωτά το `distDir` του ίδιου του `next.config.js` και τιμά
 * το `NEXT_DIST_DIR` — δηλαδή απαντά *«ποιον φάκελο εννοεί **αυτή** η εκτέλεση»*.
 * Είναι ο **ίδιος** αναγνώστης που χρησιμοποιεί ο bundle ratchet (ADR-598 G6).
 *
 * ⚡ Και είναι **43 δευτερόλεπτα φθηνότερο**: η σάρωση όλων των καταλόγων έκανε
 * 49s. *Μια άγκυρα που κοστίζει πολύ δεν είναι αυστηρότερη — είναι ανενεργή.*
 */
function chunkDirs() {
  const { resolveBuildDir } = require('../bundle-analyzer');
  const dir = path.join(resolveBuildDir(), 'static', 'chunks');
  return fs.existsSync(dir) ? [dir] : [];
}

/**
 * Η απογραφή του artifact — **με παρονομαστή**.
 *
 * Το `runtimeLookups` μόνο του θα ήταν `0` και σε δέντρο που δεν κοιτάχτηκε ποτέ.
 * Το `chunksMentioning` είναι η απόδειξη ότι υπήρχε κάτι να κριθεί.
 */
function surveyArtifact() {
  const census = { dirs: 0, chunksScanned: 0, chunksMentioning: 0, runtimeLookups: 0, offenders: [] };
  const lookup = new RegExp('\\.env\\.' + FLAG, 'g');

  for (const dir of chunkDirs()) {
    census.dirs += 1;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.js')) continue;
      let text;
      try {
        text = fs.readFileSync(path.join(dir, name), 'utf8');
      } catch {
        continue;
      }
      census.chunksScanned += 1;
      if (!text.includes(FLAG)) continue;
      census.chunksMentioning += 1;
      const hits = text.match(lookup);
      if (hits) {
        census.runtimeLookups += hits.length;
        census.offenders.push(path.relative(ROOT, path.join(dir, name)) + ' ×' + hits.length);
      }
    }
  }
  return census;
}

/** Οι συνθήκες όλων των `if` που περικλείουν έναν κόμβο, από μέσα προς τα έξω. */
function enclosingIfConditions(node, source) {
  const conditions = [];
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isIfStatement(current)) conditions.push(current.expression.getText(source));
  }
  return conditions;
}

/** Ο πρώτος κόμβος κλήσης του οποίου το κείμενο ταιριάζει. */
function findCall(source, matches) {
  let found = null;
  const visit = (node) => {
    if (found) return;
    if (ts.isCallExpression(node) && matches(node.getText(source))) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
}

const ARTIFACT = surveyArtifact();
const POSITIVE_GATE = new RegExp(FLAG + "\\s*===\\s*['\"]true['\"]");

// =============================================================================
// Κ1 — Η ΠΑΡΑΓΩΓΗ ΤΗΣ ΣΗΜΑΙΑΣ
// =============================================================================

describe('Κ1 — η σημαία ΠΑΡΑΓΕΤΑΙ από το ' + SOURCE_ENV, () => {
  // Κάθε κλήση φορτώνει το `@sentry/nextjs` σε **νέα** διεργασία (1,5-3,8s). Δύο
  // μετρήσεις στηρίζουν τρεις ισχυρισμούς — τρίτη κλήση θα ήταν το ίδιο πείραμα
  // πληρωμένο ξανά (29,7s → 21s).
  const withEmulator = flagProducedWhen('localhost:9099');
  const withoutEmulator = flagProducedWhen(null);

  test('με τη μεταβλητή του emulator ⇒ "true"', () => {
    expect(withEmulator).toBe('true');
  });

  test('χωρίς τη μεταβλητή ⇒ "false" (ποτέ undefined — undefined σημαίνει «δεν δηλώθηκε»)', () => {
    expect(withoutEmulator).toBe('false');
  });

  test('οι δύο απαντήσεις ΔΙΑΦΕΡΟΥΝ — αλλιώς η τιμή είναι καρφωμένη, όχι παραγόμενη', () => {
    expect(withEmulator).not.toBe(withoutEmulator);
  });
});

// =============================================================================
// Κ2 — ΕΝΑΣ ΓΡΑΦΕΑΣ (κλειστό σύνολο)
// =============================================================================

describe('Κ2 — ένας και μόνο γραφέας της σημαίας', () => {
  const writers = trackedFilesMentioningFlag()
    .filter((file) => assignsFlag(executableTextOf(file)))
    .map((file) => file.replace(/\\/g, '/'))
    .sort();

  test('κανένα άλλο tracked αρχείο δεν αναθέτει τιμή στη σημαία', () => {
    expect(writers).toEqual(DECLARED_WRITERS);
  });

  test('ο παρονομαστής υπάρχει — κάποιο tracked αρχείο ΑΝΑΦΕΡΕΙ τη σημαία', () => {
    expect(trackedFilesMentioningFlag().length).toBeGreaterThan(0);
  });

  test('τα σχόλια ΔΕΝ μετράνε ως ανάθεση', () => {
    expect(assignsFlag(stripHashComments('# ' + FLAG + '=true'))).toBe(false);
    expect(assignsFlag(stripComments('// ' + FLAG + '=true'))).toBe(false);
    expect(assignsFlag(FLAG + '=true')).toBe(true);
  });

  test('η ΑΝΑΓΝΩΣΗ δεν είναι ανάθεση', () => {
    expect(assignsFlag("process.env." + FLAG + " === 'true'")).toBe(false);
    expect(assignsFlag("process.env." + FLAG + " = 'true'")).toBe(true);
  });
});

// =============================================================================
// Κ3 — Ο ΦΡΟΥΡΟΣ ΖΕΙ ΕΞΩ ΑΠΟ ΤΟ `if` ΠΟΥ ΚΡΙΝΕΙ
// =============================================================================

describe('Κ3 — ο φρουρός προορισμού δεν εξαρτάται από τη δήλωση που ελέγχει', () => {
  const source = ts.createSourceFile(
    CLIENT_MODULE,
    fs.readFileSync(CLIENT_MODULE, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );

  const guard = findCall(source, (text) => text.startsWith('fetch(') && text.includes('9099'));
  const connect = findCall(source, (text) => text.startsWith('connectAuthEmulator('));

  test('ο φρουρός υπάρχει στο ' + path.basename(CLIENT_MODULE), () => {
    expect(guard).not.toBeNull();
  });

  test('ΠΑΡΟΝΟΜΑΣΤΗΣ — η σύνδεση στον emulator είναι ΜΕΣΑ στο `if` της σημαίας', () => {
    expect(connect).not.toBeNull();
    const conditions = enclosingIfConditions(connect, source);
    expect(conditions.some((c) => POSITIVE_GATE.test(c))).toBe(true);
  });

  test('ο φρουρός ΔΕΝ είναι μέσα στο ίδιο `if` — αλλιώς είναι δομικά ανίκανος να πυροδοτήσει', () => {
    const conditions = enclosingIfConditions(guard, source);
    expect(conditions.filter((c) => POSITIVE_GATE.test(c))).toEqual([]);
  });
});

// =============================================================================
// Κ4 — ΤΟ BUILD ARTIFACT (ρητό skip όταν δεν υπάρχει τι να κριθεί)
// =============================================================================

const artifactTest = ARTIFACT.chunksMentioning > 0 ? test : test.skip;

describe('Κ4 — η σημαία είναι ΕΝΣΩΜΑΤΩΜΕΝΗ, όχι runtime lookup', () => {
  artifactTest('κανένα client chunk δεν διαβάζει τη σημαία σε χρόνο εκτέλεσης', () => {
    expect({ runtimeLookups: ARTIFACT.runtimeLookups, offenders: ARTIFACT.offenders }).toEqual({
      runtimeLookups: 0,
      offenders: [],
    });
  });
});

// =============================================================================
// Λ — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ
// =============================================================================

describe('Λ — η απογραφή κλείνει', () => {
  test('Λ1 — οι αριθμοί του artifact είναι συνεπείς μεταξύ τους', () => {
    expect(ARTIFACT.chunksMentioning).toBeLessThanOrEqual(ARTIFACT.chunksScanned);
    expect(ARTIFACT.offenders.length > 0).toBe(ARTIFACT.runtimeLookups > 0);
    // Τυπώνεται **ακόμα και στο μηδέν**: ένα «0» που δεν φαίνεται διαβάζεται ως
    // «δεν υπάρχει τέτοιος έλεγχος» (μάθημα CHECK 3.48 / Κ6).
    process.stdout.write(
      '\n   [ADR-807] artifact: κατάλογοι=' +
        ARTIFACT.dirs +
        ' chunks=' +
        ARTIFACT.chunksScanned +
        ' αναφέρουν=' +
        ARTIFACT.chunksMentioning +
        ' runtime-lookups=' +
        ARTIFACT.runtimeLookups +
        (ARTIFACT.chunksMentioning === 0 ? '  ⏭ Κ4 ΠΑΡΑΛΕΙΦΘΗΚΕ (κανένα build)' : '') +
        '\n',
    );
  });
});
