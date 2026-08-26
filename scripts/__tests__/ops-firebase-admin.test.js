/**
 * ADR-813 — **ΕΠΤΑ ΑΝΤΙΓΡΑΦΑ, ΤΕΣΣΕΡΙΣ ΕΚΔΟΧΕΣ, ΚΑΝΕΝΑ ΣΩΣΤΟ**.
 *
 * 🔴 **Το γεγονός** (μετρημένο 2026-08-26): το `loadServiceAccount` ήταν γραμμένο
 * **7 φορές** με **4 διαφορετικά σώματα**, και **όλα** διάβαζαν μόνο
 * `FIREBASE_SERVICE_ACCOUNT_KEY` — με **regex πάνω στο κείμενο του `.env.local`**,
 * αγνοώντας και το `_B64` και το πραγματικό `process.env`. Ο κανονικός επιλυτής
 * της εφαρμογής (`src/lib/firebaseAdmin-credentials.ts`) δοκιμάζει `_B64`
 * **πρώτα**.
 *
 * 🔴 **Και ένα ήταν ΗΔΗ ΣΠΑΣΜΕΝΟ**: το `set-user-claims-direct.js` καλούσε
 * `loadEnvLocal()` και **πετούσε την επιστροφή**, μετά διάβαζε `process.env` —
 * που το `loadEnvLocal` **δεν γεμίζει ποτέ**. Δεν μπορούσε να τρέξει.
 *
 * ⚠️ **ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΕΣ ΕΡΩΤΗΣΕΙΣ, ΠΟΤΕ ΜΙΑ ΜΕ «Ή»** — άλλη θεραπεία η καθεμία:
 *   **Ι.** συμφωνεί η **σειρά** με τον κανονικό επιλυτή; ⇒ *διόρθωσε τη σειρά*
 *   **Κ.** λύνει σωστά **και σε σφάλμα**;               ⇒ *διόρθωσε τον επιλυτή*
 *   **Σ.** έμεινε **κανένα** τοπικό αντίγραφο;          ⇒ *μετανάστευσε το script*
 *
 * @jest-environment node
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  loadServiceAccount,
  initAdminApp,
  CREDENTIAL_SOURCES,
} = require('../_shared/firebaseAdminOps');

const REPO = path.join(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, 'scripts');
const CANONICAL = path.join(REPO, 'src', 'lib', 'firebaseAdmin-credentials.ts');

const FAKE_SA = { project_id: 'proj-x', client_email: 'a@b.c', private_key: 'k' };
const RAW = JSON.stringify(FAKE_SA);
const B64 = Buffer.from(JSON.stringify({ ...FAKE_SA, project_id: 'proj-b64' })).toString('base64');

/** Καθαρό περιβάλλον: κανένα από τα δύο κλειδιά, και κανένα `.env.local` πίσω. */
/** Ραφή: το `.env.local` **δεν** συμμετέχει, εκτός αν το ζητήσει η άγκυρα. */
const NO_FILE = { readFileEnv: () => ({}) };

function withEnv(vars, fn) {
  const saved = { ...process.env };
  for (const s of CREDENTIAL_SOURCES) delete process.env[s.env];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

/** Κώδικας χωρίς σχόλια — ο κόφτης ζει σε ΕΝΑ σημείο, με RegExp από συμβολοσειρά
 *  ώστε να μη χρειάζονται literals που τα εργαλεία επεξεργασίας διαστρεβλώνουν. */
const BLOCK_COMMENT = new RegExp('/\\*[\\s\\S]*?\\*/', 'g');
const LINE_COMMENT = new RegExp('//[^\\n]*', 'g');
function stripComments(source) {
  return source.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');
}

// ============================================================================
// Ι — Η ΣΕΙΡΑ ΣΥΜΦΩΝΕΙ ΜΕ ΤΟΝ ΚΑΝΟΝΙΚΟ ΕΠΙΛΥΤΗ
// ============================================================================

describe('Ι — καθρέφτης του κανονικού επιλυτή', () => {
  test('Ι1 — `_B64` ΠΡΩΤΑ, όπως στο src/lib/firebaseAdmin-credentials.ts', () => {
    // Ο κανονικός δοκιμάζει `_B64` πριν το ωμό JSON. Αντίστροφη σειρά εδώ
    // σημαίνει ότι σε περιβάλλον με **και τα δύο** τα ops θα ενεργούσαν με
    // **άλλο κλειδί** από την εφαρμογή — σιωπηλά.
    const canonical = fs.readFileSync(CANONICAL, 'utf8');
    const iB64 = canonical.indexOf('FIREBASE_SERVICE_ACCOUNT_KEY_B64');
    const iRaw = canonical.indexOf('if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY)');
    expect(iB64).toBeGreaterThan(-1);
    expect(iRaw).toBeGreaterThan(iB64); // ο παρονομαστής: όντως B64 πρώτα εκεί

    expect(CREDENTIAL_SOURCES.map((s) => s.env)).toEqual([
      'FIREBASE_SERVICE_ACCOUNT_KEY_B64',
      'FIREBASE_SERVICE_ACCOUNT_KEY',
    ]);
  });
});

// ============================================================================
// Κ — Ο ΕΠΙΛΥΤΗΣ
// ============================================================================

describe('Κ — τι λύνει, και τι αρνείται', () => {
  test('Κ1 — με ΚΑΙ ΤΑ ΔΥΟ παρόντα, κερδίζει το `_B64`', () =>
    withEnv({ FIREBASE_SERVICE_ACCOUNT_KEY_B64: B64, FIREBASE_SERVICE_ACCOUNT_KEY: RAW }, () => {
      expect(loadServiceAccount(NO_FILE).project_id).toBe('proj-b64');
    }));

  test('Κ2 — με μόνο το ωμό, το διαβάζει (ο παρονομαστής του Κ1)', () =>
    withEnv({ FIREBASE_SERVICE_ACCOUNT_KEY: RAW }, () => {
      expect(loadServiceAccount(NO_FILE).project_id).toBe('proj-x');
    }));

  test('Κ3 — δέχεται τιμή τυλιγμένη σε εισαγωγικά (μορφή `.env`)', () =>
    withEnv({ FIREBASE_SERVICE_ACCOUNT_KEY: `"${RAW}"` }, () => {
      expect(loadServiceAccount(NO_FILE).project_id).toBe('proj-x');
    }));

  test('Κ4 — ΑΚΥΡΗ τιμή που ΥΠΑΡΧΕΙ ⇒ ΣΦΑΛΜΑ, ποτέ σιωπηλή πτώση στην επόμενη', () =>
    withEnv({ FIREBASE_SERVICE_ACCOUNT_KEY_B64: 'όχι-base64-json', FIREBASE_SERVICE_ACCOUNT_KEY: RAW }, () => {
      // 🔑 Αυτό είναι ΤΟ σημείο. Σιωπηλή πτώση θα έκρυβε ένα **χαλασμένο**
      //    κλειδί πίσω από ένα **παλιό**, και ο άνθρωπος θα ενεργούσε με
      //    διαπιστευτήρια που δεν νόμιζε ότι χρησιμοποιεί.
      expect(() => loadServiceAccount(NO_FILE)).toThrow(/FIREBASE_SERVICE_ACCOUNT_KEY_B64/);
    }));

  test('Κ5 — τίποτα πουθενά ⇒ σφάλμα που ΟΝΟΜΑΖΕΙ ΚΑΘΕ πηγή που δοκιμάστηκε', () => {
    // ⚠️ Ραφή αντί για `jest.spyOn` στο module: ο εκκινητής κάνει destructure
    //    το `loadEnvLocal` **τη στιγμή του require**, οπότε ένα spy στο
    //    αντικείμενο του module **δεν αγγίζει** την ήδη πιασμένη αναφορά — το
    //    test θα ήταν πράσινο ή κόκκινο για λόγο άσχετο με τον κανόνα.
    withEnv({}, () => {
      expect(() => loadServiceAccount(NO_FILE)).toThrow(/FIREBASE_SERVICE_ACCOUNT_KEY_B64@process\.env/);
      expect(() => loadServiceAccount(NO_FILE)).toThrow(/FIREBASE_SERVICE_ACCOUNT_KEY@\.env\.local/);
    });
  });

  test('Κ6 — `initAdminApp` περνά το projectId και είναι ιδεοδύναμο', () =>
    withEnv({ FIREBASE_SERVICE_ACCOUNT_KEY: RAW }, () => {
      const apps = [];
      const admin = {
        get apps() { return apps; },
        credential: { cert: (sa) => ({ _cert: sa }) },
        initializeApp: (cfg) => { apps.push(cfg); },
        auth: () => 'AUTH',
        firestore: () => 'DB',
      };
      const first = initAdminApp(admin, { seam: NO_FILE });
      expect(first).toMatchObject({ auth: 'AUTH', db: 'DB', projectId: 'proj-x' });
      expect(apps).toHaveLength(1);
      expect(apps[0].projectId).toBe('proj-x');
      initAdminApp(admin, { seam: NO_FILE }); // δεύτερη κλήση
      expect(apps).toHaveLength(1); // ⇐ ιδεοδύναμο
    }));
});

// ============================================================================
// Σ — Η ΕΚΣΤΡΑΤΕΙΑ ΕΚΛΕΙΣΕ ΣΤΟ ΜΗΔΕΝ
// ============================================================================

describe('Σ — κανένα τοπικό αντίγραφο', () => {
  function scriptFiles() {
    const out = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
        if (/\.(js|cjs|mjs|ts)$/.test(e.name)) out.push(p);
      }
    })(SCRIPTS);
    return out;
  }

  test('Σ0 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο σαρωτής βλέπει το δέντρο', () => {
    expect(scriptFiles().length).toBeGreaterThan(50);
  });

  test('Σ1 — κανένα script δεν ορίζει δικό του loadServiceAccount', () => {
    // Ήταν **7**. Ο κοινός ζει στο `_shared/firebaseAdminOps.js` και δεν
    // μετριέται εδώ ως αντίγραφο — είναι ο ορισμός.
    const offenders = scriptFiles()
      .filter((p) => p !== path.join(SCRIPTS, '_shared', 'firebaseAdminOps.js'))
      .filter((p) => /function loadServiceAccount\s*\(/.test(fs.readFileSync(p, 'utf8')))
      .map((p) => path.relative(SCRIPTS, p).split(path.sep).join('/'));
    expect(offenders).toEqual([]);
  });

  test('Σ2 — το `set-user-claims-direct.js` ΔΕΝ ξαναδιαβάζει process.env για το κλειδί', () => {
    // Η ακριβής μορφή του σπασμένου: `loadEnvLocal()` χωρίς ανάθεση, και μετά
    // ανάγνωση από το περιβάλλον που εκείνο δεν γεμίζει ποτέ.
    //
    // ⚠️ **ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ**: το αρχείο τεκμηριώνει τη βλάβη γράφοντας την
    //    ίδια συμβολοσειρά — φρουρός που κρίνει ωμό κείμενο θα κοκκίνιζε πάνω
    //    στην **τεκμηρίωση της θεραπείας** (σχήμα `Κ7β` του CHECK 3.50). Το
    //    πλήρωσα ζωντανά γράφοντας αυτή την άγκυρα.
    const raw = fs.readFileSync(path.join(SCRIPTS, 'set-user-claims-direct.js'), 'utf8');
    const NEEDLE = 'process.env.FIREBASE_SERVICE_ACCOUNT_KEY';
    expect(raw).toContain(NEEDLE); // ο παρονομαστής: υπάρχει — σε ΣΧΟΛΙΟ

    const code = stripComments(raw);
    expect(code).not.toContain(NEEDLE);
    expect(code).toContain('initAdminApp(admin)');
  });
});
