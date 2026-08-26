/**
 * CHECK 3.69 / ADR-805 — ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΜΗΤΡΩΟΥ ΓΡΑΜΜΑΤΟΣΕΙΡΩΝ.
 *
 * ⚠️ Οι μεταλλάξεις γίνονται στις **ΕΙΣΟΔΟΥΣ** (συνθετικό μητρώο / συνθετική απόδειξη), όχι
 * στην πύλη — μια πύλη που κρίνει **περιεχόμενο** πρέπει να αποδείξει ότι ξεχωρίζει περιεχόμενο.
 *
 * 🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΔΕΝΤΡΟ**: αν η πύλη δεν έβρισκε **τίποτα** εκεί, το
 * «0 παραβιάσεις» θα σήμαινε «δεν κοίταξα». Βρίσκει — και το εύρημα (`helvetiker` με άδεια
 * **MgOpen**, εκτός SPDX, που δεν ενέκρινε ποτέ κανείς) ήταν **η αιτία** που γράφτηκε η πύλη.
 */

'use strict';

const path = require('node:path');

const A = require('../lib/font-assets/assets');
const E = require('../lib/font-assets/evidence');

const REPO_ROOT = path.join(__dirname, '..', '..');

const OFL = {
  family: 'Liberation Sans',
  license: 'Licensed under the SIL Open Font License, Version 1.1',
  licenseURL: 'http://scripts.sil.org/OFL',
  copyright: 'Copyright (c) 2012 Red Hat, Inc.',
  bytes: 1,
  spdx: 'OFL-1.1',
};

/** Συνθετικός κόσμος — κάθε άγκυρα αλλάζει **μία** είσοδο. */
const world = (over = {}) => A.takeInventory(REPO_ROOT, {
  files: [],
  shipped: ['public/fonts/A.ttf'],
  registry: {
    'public/fonts/A.ttf': { spdx: 'OFL-1.1', family: 'Liberation Sans', attribution: 'public/fonts/OFL.txt' },
  },
  allowedLicenses: ['MIT', 'Apache-2.0', 'OFL-1.1'],
  evidenceOf: () => ({ ...OFL }),
  attributionExists: () => true,
  existsOnDisk: () => true,
  ...over,
});

describe('CHECK 3.69 — έχει κάθε διανεμόμενη γραμματοσειρά εγκεκριμένη άδεια;', () => {
  it('Κ1: δηλωμένη + επιτρεπόμενη + το ΑΡΧΕΙΟ συμφωνεί ⇒ ✅', () => {
    const v = A.judge(world());
    expect(A.idsOf(v, A.STATES.DECLARED_ALLOWED)).toEqual(['public/fonts/A.ttf']);
  });

  it('Κ2: διανέμεται χωρίς δήλωση ⇒ ⛔ undeclared-asset', () => {
    const v = A.judge(world({ registry: {} }));
    expect(A.idsOf(v, A.STATES.UNDECLARED_ASSET)).toEqual(['public/fonts/A.ttf']);
  });

  /**
   * 🔑 **Η ΝΕΑ ΕΡΩΤΗΣΗ, ΚΑΙ Ο ΛΟΓΟΣ ΠΟΥ Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ ΤΟ ΑΡΧΕΙΟ.** Ούτε το AutoCAD ούτε το
   * Revit ούτε το Figma ρωτούν αν το αρχείο που φόρτωσαν **είναι** αυτό που νομίζουν. Εδώ η
   * δήλωση του ανθρώπου συγκρίνεται με το `name` table του ίδιου του δυαδικού.
   */
  it('Κ3: το μητρώο λέει άλλη άδεια από το ΑΡΧΕΙΟ ⇒ ⛔ license-drift', () => {
    const v = A.judge(world({
      registry: { 'public/fonts/A.ttf': { spdx: 'MIT', family: 'X', attribution: 'x' } },
    }));
    expect(A.idsOf(v, A.STATES.LICENSE_DRIFT)).toEqual(['public/fonts/A.ttf']);
  });

  it('Κ4: άδεια εκτός allowlist ⇒ 🔴 license-not-allowed', () => {
    const v = A.judge(world({ allowedLicenses: ['MIT'] }));
    expect(A.idsOf(v, A.STATES.LICENSE_NOT_ALLOWED)).toEqual(['public/fonts/A.ttf']);
  });

  it('Κ5: άδεια που απαιτεί απόδοση, χωρίς αρχείο απόδοσης ⇒ 🔴 unattributed', () => {
    const v = A.judge(world({ attributionExists: () => false }));
    expect(A.idsOf(v, A.STATES.UNATTRIBUTED)).toEqual(['public/fonts/A.ttf']);
  });

  it('Κ6: το αρχείο δεν κουβαλά αναγνωρίσιμη άδεια ⇒ ⛔ license-unverifiable (fail-closed)', () => {
    const v = A.judge(world({ evidenceOf: () => ({ family: 'X', spdx: null }) }));
    expect(A.idsOf(v, A.STATES.LICENSE_UNVERIFIABLE)).toEqual(['public/fonts/A.ttf']);
  });

  it('Κ7: το αρχείο δεν διαβάζεται ⇒ ⛔ unreadable-asset, ΠΟΤΕ σιωπηλό πέρασμα', () => {
    const v = A.judge(world({ evidenceOf: () => ({ unreadable: 'κατεστραμμένο' }) }));
    expect(A.idsOf(v, A.STATES.UNREADABLE_ASSET)).toEqual(['public/fonts/A.ttf']);
  });

  /**
   * ⚠️ **ΔΥΟ ΑΙΤΙΕΣ, ΑΝΤΙΘΕΤΗ ΘΕΡΑΠΕΙΑ** — ένα μήνυμα για τις δύο θα έλεγε ψέματα στη μία.
   */
  it('Κ8: δηλωμένο, ΥΠΑΡΧΕΙ στον δίσκο, εκτός ευρετηρίου ⇒ ⛔ declared-not-tracked («git add»)', () => {
    const v = A.judge(world({ shipped: [], existsOnDisk: () => true }));
    expect(A.idsOf(v, A.STATES.DECLARED_NOT_TRACKED)).toEqual(['public/fonts/A.ttf']);
    expect(A.idsOf(v, A.STATES.ORPHAN_DECLARATION)).toEqual([]);
  });

  it('Κ9: δηλωμένο και ΔΕΝ υπάρχει ⇒ ⛔ orphan-declaration («σβήσε τη δήλωση»)', () => {
    const v = A.judge(world({ shipped: [], existsOnDisk: () => false }));
    expect(A.idsOf(v, A.STATES.ORPHAN_DECLARATION)).toEqual(['public/fonts/A.ttf']);
    expect(A.idsOf(v, A.STATES.DECLARED_NOT_TRACKED)).toEqual([]);
  });

  it('Κ10: η λογιστική ΚΛΕΙΝΕΙ — κάθε στοιχείο/δήλωση παίρνει ακριβώς μία κατάσταση', () => {
    const v = A.judge(world({ shipped: ['public/fonts/A.ttf', 'public/fonts/B.ttf'] }));
    expect(Object.values(v.tally).reduce((a, b) => a + b, 0)).toBe(v.rows.length);
  });

  it('Κ11: άγνωστη κατάσταση ⇒ throw ΜΕ ΟΝΟΜΑ (fail-closed λογιστική)', () => {
    expect(() => A.tallyOf([{ state: 'φαντασμα', id: 'x' }])).toThrow(/άγνωστη κατάσταση/);
  });

  it('Κ12: fail-closed — μητρώο που λείπει ⇒ σφάλμα ΜΕ ΟΝΟΜΑ, ποτέ «καμία παραβίαση»', () => {
    expect(() => A.takeInventory(path.join(__dirname, '__δεν_υπάρχει__')))
      .toThrow(/\.font-assets\.json λείπει/);
  });
});

// ─── Η ΑΠΟΔΕΙΞΗ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΟ ΙΔΙΟ ΤΟ ΑΡΧΕΙΟ ────────────────────────────

describe('Α — η άδεια βγαίνει από το ΑΡΧΕΙΟ, όχι από τη δήλωση', () => {
  it('Α1: το πραγματικό Liberation δηλώνει OFL-1.1 στο δικό του name table', () => {
    const ev = E.readEvidence(REPO_ROOT, 'public/fonts/LiberationSans-Regular.ttf');
    expect(ev.family).toBe('Liberation Sans');
    expect(ev.license).toMatch(/SIL Open Font License, Version 1\.1/);
    expect(ev.licenseURL).toMatch(/scripts\.sil\.org\/OFL/);
    expect(ev.spdx).toBe('OFL-1.1');
  });

  /** Η ΟΨΗ διαβάζεται ξεχωριστά — δύο αρχεία της ίδιας οικογένειας δεν είναι το ίδιο στοιχείο. */
  it('Α2: η ΟΨΗ (subfamily) διαβάζεται ανά αρχείο, όχι ανά οικογένεια', () => {
    const ev = E.readEvidence(REPO_ROOT, 'public/fonts/LiberationSans-Bold.ttf');
    expect(ev.family).toBe('Liberation Sans');
    expect(ev.subfamily).toBe('Bold');
    expect(ev.spdx).toBe('OFL-1.1');
  });

  /**
   * 🔑 Το `.typeface.json` του three.js κρατά τα **ίδια** πεδία **αλλού** — και αυτό είναι που
   * αποκάλυψε το ζωντανό εύρημα.
   */
  /**
   * ⚠️ **ΣΥΝΘΕΤΙΚΟ ΕΠΙΤΗΔΕΣ, ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟΣ.** Ως τις 2026-08-25 αυτή η άγκυρα
   * διάβαζε το **πραγματικό** `helvetiker_regular.typeface.json`. Το αρχείο **διαγράφηκε**
   * (ADR-805 §9: MgOpen εκτός SPDX, μηδέν καταναλωτές) ⇒ η άγκυρα **αυτο-ακυρώθηκε τη στιγμή
   * που η εκστρατεία πέτυχε** — τρίτη φορά που αυτό το σχήμα πληρώνεται σε δύο μέρες
   * (ADR-790 §9.1 · `Π2` του CHECK 3.67).
   *
   * Ο **αναγνώστης** της μορφής και η **υπογραφή** `LicenseRef-MgOpen` παραμένουν, με
   * **πληθυσμό 0 εκ σχεδιασμού**: κλειδώνουν την κατάσταση **πριν** ξαναεμφανιστεί, όπως ο
   * κανόνας `Κ1` του CHECK 3.43. Χωρίς άγκυρα θα ήταν **νεκρός κώδικας που κανείς δεν ασκεί**.
   */
  it('Α3: μορφή `.typeface.json` — τα ΙΔΙΑ πεδία αλλού, και η MgOpen αναγνωρίζεται', () => {
    // eslint-disable-next-line global-require
    const fs = require('node:fs');
    // eslint-disable-next-line global-require
    const os = require('node:os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-assets-'));
    const file = path.join(dir, 'ghost_regular.typeface.json');
    fs.writeFileSync(file, JSON.stringify({
      familyName: 'Ghost',
      glyphs: { A: {}, B: {} },
      original_font_information: {
        copyright: 'Copyright (c) Magenta ltd, 2004',
        license_url: 'http://www.ellak.gr/fonts/MgOpen/license.html',
      },
    }), 'utf8');

    const ev = E.readEvidence(dir, 'ghost_regular.typeface.json');
    expect(ev.family).toBe('Ghost');
    expect(ev.licenseURL).toMatch(/ellak\.gr\/fonts\/MgOpen/);
    expect(ev.spdx).toBe('LicenseRef-MgOpen');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /**
   * 🔴 Η πιο εκτεθειμένη διανομή: τα bytes που ενσωματώνονται σε **κάθε PDF πελάτη**. Κρίνονται
   * με τον **ίδιο** αναγνώστη — αποκωδικοποιώντας το base64, όχι εμπιστευόμενοι τη δήλωση.
   */
  it('Α4: το base64 module αποκωδικοποιείται και ΚΡΙΝΕΤΑΙ σαν κάθε άλλο TTF', () => {
    const ev = E.readEvidence(REPO_ROOT, 'src/services/gantt-export/roboto-font-data.ts');
    expect(ev.family).toBe('Roboto');
    expect(ev.spdx).toBe('Apache-2.0');
    expect(ev.bytes).toBeGreaterThan(100000);
  });

  it('Α5: κείμενο χωρίς καμία υπογραφή ⇒ null, ποτέ μαντεψιά', () => {
    expect(E.spdxFromEvidence({ license: 'κάτι εντελώς άλλο', licenseURL: null, copyright: null }))
      .toBeNull();
    expect(E.spdxFromEvidence({})).toBeNull();
  });
});

// ─── Ο ΠΑΡΟΝΟΜΑΣΤΗΣ + Η ΑΝΑΚΑΛΥΨΗ ΣΤΟ ΠΡΑΓΜΑΤΙΚΟ ΔΕΝΤΡΟ ────────────────────

describe('Π — το πραγματικό δέντρο', () => {
  const cli = require('../check-font-assets.js');

  it('Π1: καμία μπλοκάρουσα κατάσταση, και η baseline ταιριάζει', () => {
    const m = cli.measure();
    expect(m.blocking).toEqual([]);
    // eslint-disable-next-line global-require
    const baseline = require('node:fs').readFileSync(cli.BASELINE_FILE, 'utf8');
    expect(m.violationIds).toEqual(JSON.parse(baseline).violations);
  });

  /**
   * 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΠΙΑ «ΒΡΙΣΚΕΙ ΤΟ helvetiker».
   *
   * 🔴 Η πρώτη του γραφή απαιτούσε από το **ζωντανό** δέντρο να περιέχει τη μη εγκεκριμένη
   * άδεια. Ήταν σωστή όσο η βλάβη υπήρχε, και **έσπασε τη στιγμή που η εκστρατεία πέτυχε**
   * (ADR-805 §9: το αρχείο διαγράφηκε). Ένας παρονομαστής **δεν επιτρέπεται να μετακινείται
   * μαζί με τη θεραπεία** (ADR-790 §9.1).
   *
   * Πλέον αποδεικνύει το ίδιο πράγμα **χωρίς να χρειάζεται ζωντανή βλάβη**: με τις
   * **ΠΡΑΓΜΑΤΙΚΕΣ** αποδείξεις — διαβασμένες από τα **ΠΡΑΓΜΑΤΙΚΑ bytes** των αρχείων που
   * διανέμουμε — και **μόνο** τη λίστα αδειών συρρικνωμένη, κάθε διανεμόμενη γραμματοσειρά
   * **οφείλει** να γίνει `license-not-allowed`. Αν η πύλη ήταν κενή, εδώ θα έβγαινε 0.
   */
  it('Π2: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — με ΠΡΑΓΜΑΤΙΚΕΣ αποδείξεις και συρρικνωμένη allowlist, ΟΛΑ πέφτουν', () => {
    const inv = A.takeInventory(REPO_ROOT, { allowedLicenses: ['MIT'] });
    expect(inv.shipped.length).toBeGreaterThan(0);
    const v = A.judge(inv);
    const flagged = A.idsOf(v, A.STATES.LICENSE_NOT_ALLOWED);
    expect(flagged).toEqual(inv.shipped);
    expect(A.idsOf(v, A.STATES.DECLARED_ALLOWED)).toEqual([]);
  });

  /** Και η αντίστροφη κατεύθυνση: με την ΠΡΑΓΜΑΤΙΚΗ allowlist, κανένα δεν πέφτει. */
  it('Π2β: με την πραγματική allowlist κάθε διανεμόμενη γραμματοσειρά είναι εγκεκριμένη', () => {
    const v = A.judge(A.takeInventory(REPO_ROOT));
    expect(A.idsOf(v, A.STATES.LICENSE_NOT_ALLOWED)).toEqual([]);
    expect(A.idsOf(v, A.STATES.DECLARED_ALLOWED).length).toBeGreaterThan(0);
  });

  /**
   * 🔑 Η ανακάλυψη είναι **παραγόμενη**, όχι χειρόγραφη λίστα — το σχήμα που έχει αποτύχει
   * μετρημένα τέσσερις φορές σε αυτό το repo (3.34 · 3.37 · 3.49 · 3.57).
   */
  /**
   * ⚠️ Η **τρίτη** μορφή (`.typeface.json`) δεν έχει πια ζωντανό εκπρόσωπο μετά το ADR-805 §9 —
   * την ασκεί η **συνθετική** άγκυρα `Α3`, ώστε ο αναγνώστης της να μη γίνει νεκρός κώδικας.
   */
  it('Π3: η απογραφή ΠΑΡΑΓΕΤΑΙ και πιάνει ΚΑΙ τις δύο ζωντανές μορφές διανομής', () => {
    const inv = A.takeInventory(REPO_ROOT);
    expect(inv.shipped).toEqual(expect.arrayContaining([
      'public/fonts/LiberationSans-Regular.ttf',          // δυαδικό στο public/
      'src/services/gantt-export/roboto-font-data.ts',    // base64 μέσα σε module
    ]));
    // …και ΔΕΝ πιάνει ό,τι δεν είναι γραμματοσειρά.
    expect(inv.shipped).not.toContain('src/subapps/accounting/services/pdf/logo-data.ts');
  });

  it('Π4: το base64 module εντοπίζεται ΑΚΟΛΟΥΘΩΝΤΑΣ ΤΟΝ ΚΑΤΑΝΑΛΩΤΗ — 0 ψευδώς θετικά', () => {
    const found = A.base64FontModules(REPO_ROOT);
    expect(found).toEqual(['src/services/gantt-export/roboto-font-data.ts']);
    // ⚠️ Το `logo-data.ts` εξάγει κι αυτό `*_BASE64` αλλά είναι **εικόνα**: το ευρετικό
    //    «εξάγει _BASE64» έδινε 50% ψευδώς θετικά, γι' αυτό απορρίφθηκε.
    expect(found).not.toContain('src/subapps/accounting/services/pdf/logo-data.ts');
  });

  it('Π5: η λίστα επιτρεπόμενων είναι Η ΜΙΑ — αυτή του .license-allowlist.json', () => {
    const inv = A.takeInventory(REPO_ROOT);
    // eslint-disable-next-line global-require
    const allow = JSON.parse(require('node:fs').readFileSync(
      path.join(REPO_ROOT, '.license-allowlist.json'), 'utf8',
    ));
    expect([...inv.allowed].sort()).toEqual([...allow.allowedLicenses].sort());
  });

  /**
   * 🔴 **Η ΠΥΛΗ ΕΦΑΓΕ ΤΗ ΔΙΚΗ ΤΗΣ ΤΕΚΜΗΡΙΩΣΗ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ** (2026-08-25).
   *
   * Το `assets.js` γράφει το κριτήριό του ως **παράδειγμα σε σχόλιο**. Η ίδια του η κανονική
   * έκφραση το διάβασε, εξήγαγε «ταυτοποιητή» **`X`**, και το `git grep "export const X"`
   * επέστρεψε **10 άσχετα αρχεία** ⇒ η πύλη ανέφερε **11** αδήλωτες γραμματοσειρές αντί για
   * **1**, δηλαδή ήταν **σπασμένη ενώ φαινόταν αυστηρότερη**. Ίδιο σχήμα με το `Κ7β` του 3.50.
   */
  it('Π6: η πύλη ΔΕΝ τρέφεται από το ΔΙΚΟ ΤΗΣ docblock (ο ΠΑΡΟΝΟΜΑΣΤΗΣ είναι μέσα)', () => {
    // eslint-disable-next-line global-require
    const gateSource = require('node:fs').readFileSync(
      path.join(REPO_ROOT, 'scripts/lib/font-assets/assets.js'), 'utf8',
    );
    const RE = /addFileToVFS\(\s*['"][^'"]+\.(?:ttf|otf|woff2?)['"]\s*,\s*([A-Za-z_$][\w$]*)/g;

    // 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ΧΩΡΙΣ κόψιμο σχολίων, το ίδιο το αρχείο της πύλης ΔΙΝΕΙ ταυτοποιητή.
    expect([...gateSource.matchAll(RE)].length).toBeGreaterThan(0);

    // …και ΜΕ κόψιμο, δεν δίνει κανέναν.
    // eslint-disable-next-line global-require
    const { stripComments } = require('../lib/source-text');
    expect([...stripComments(gateSource).matchAll(RE)]).toHaveLength(0);

    // Άρα η πραγματική απογραφή βλέπει ΜΟΝΟ τον έναν αληθινό καταναλωτή.
    expect(A.base64FontModules(REPO_ROOT))
      .toEqual(['src/services/gantt-export/roboto-font-data.ts']);
  });
});

// ─── Ο ΦΡΟΥΡΟΣ ΤΟΥ ZERO-TOLERANCE ────────────────────────────────────────────

/**
 * 🔴 Γεννήθηκε **μαζί** με την πύλη, επειδή το αδελφό CHECK 3.67 απέδειξε την ίδια μέρα ότι
 * χωρίς αυτόν οι ⛔ καταστάσεις είναι **διακοσμητικές**: το `runSetRatchetCli` συγκρίνει **μόνο**
 * τα σύνολα `violationIds` / `declarations`, και οι μπλοκάρουσες δεν μπαίνουν σε αυτά.
 */
describe('Ζ — το zero-tolerance ΜΠΛΟΚΑΡΕΙ όντως', () => {
  const cli = require('../check-font-assets.js');

  function captureExit(fn) {
    const realExit = process.exit;
    const realErr = console.error;
    const codes = [];
    process.exit = (c) => { codes.push(c); throw new Error('__exit__'); };
    console.error = () => {};
    try { fn(); } catch (e) { if (e.message !== '__exit__') throw e; }
    finally { process.exit = realExit; console.error = realErr; }
    return codes;
  }

  const blocking = () => ({
    blocking: [{ state: A.STATES.LICENSE_DRIFT, id: 'public/fonts/X.ttf', detail: 'δοκιμή' }],
  });
  const clean = () => ({ blocking: [] });

  it('Ζ1: μπλοκάρουσα κατάσταση ⇒ έξοδος με 1', () => {
    expect(captureExit(() => cli.enforceZeroTolerance([], blocking))).toEqual([1]);
  });

  it('Ζ2: καθαρή κατάσταση ⇒ καμία έξοδος', () => {
    expect(captureExit(() => cli.enforceZeroTolerance([], clean))).toEqual([]);
  });

  it('Ζ3: `--report` ΔΕΝ μπλοκάρει — ο άνθρωπος πρέπει να ΔΕΙ τι έσπασε', () => {
    expect(captureExit(() => cli.enforceZeroTolerance(['--report'], blocking))).toEqual([]);
  });

  /** 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο φρουρός ΔΕΝ είναι πλεονασμός του ratchet. */
  it('Ζ4: οι μπλοκάρουσες ταυτότητες ΔΕΝ φτάνουν ΠΟΤΕ στα συγκρινόμενα σύνολα', () => {
    const v = A.judge(world({ evidenceOf: () => ({ unreadable: 'x' }) }));
    const blockingRows = v.rows.filter((r) => A.BLOCKING.includes(r.state));
    expect(blockingRows.length).toBeGreaterThan(0);
    const ratcheted = v.rows.filter((r) => A.RATCHETED.includes(r.state))
      .map((r) => `${r.state} :: ${r.id}`);
    for (const row of blockingRows) expect(ratcheted).not.toContain(`${row.state} :: ${row.id}`);
  });

  /** 🔑 Η ΚΑΛΩΔΙΩΣΗ — το `Ζ1` θα έμενε πράσινο ακόμη κι αν κανείς δεν καλούσε τον φρουρό. */
  it('Ζ5: το CLI καλεί τον φρουρό ΠΡΙΝ το ratchet', () => {
    // eslint-disable-next-line global-require
    const src = require('node:fs').readFileSync(
      path.join(__dirname, '..', 'check-font-assets.js'), 'utf8',
    );
    const guard = src.indexOf('enforceZeroTolerance(process.argv');
    const ratchetCall = src.indexOf('runSetRatchetCli({');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(ratchetCall);
  });

  it('Ζ6: η σπορά ΑΡΝΕΙΤΑΙ να κλειδώσει μπλοκάρουσα κατάσταση σε baseline', () => {
    expect(() => cli.buildPayload({ blocking: [{ state: A.STATES.LICENSE_DRIFT }] }))
      .toThrow(/άρνηση σποράς/);
  });
});
