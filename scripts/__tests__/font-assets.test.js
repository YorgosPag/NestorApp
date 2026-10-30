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

const LP = require('../lib/license-policy/policy');

const REAL_POLICY_RAW = JSON.parse(require('node:fs').readFileSync(path.join(REPO_ROOT, LP.POLICY_FILE_NAME), 'utf8'));

/**
 * Η **ΠΡΑΓΜΑΤΙΚΗ** πολιτική αδειών με **μία** αλλαγή (2026-09-16, ADR-598 G13). ⚠️ Ποτέ δεύτερη
 * λίστα αδειών μέσα στη σουίτα: τότε θα δοκίμαζε μια πολιτική που δεν τρέχει πουθενά.
 */
function policyWith(mutate = () => {}) {
  const raw = JSON.parse(JSON.stringify(REAL_POLICY_RAW));
  mutate(raw);
  const compiled = LP.compilePolicy(raw);
  if (!compiled.ok) throw new Error(compiled.error);
  return compiled.policy;
}

/** Ο συνθετικός κόσμος ονομάζει το αρχείο `A.ttf`· η πραγματική εξαίρεση OFL απλώνεται σε αυτό. */
const WORLD_POLICY = policyWith((raw) => {
  raw.assetExceptions.find((e) => e.id === 'liberation-fonts-ofl').paths = ['public/fonts/*.ttf'];
});

/** Συνθετικός κόσμος — κάθε άγκυρα αλλάζει **μία** είσοδο. */
const world = (over = {}) => A.takeInventory(REPO_ROOT, {
  files: [],
  shipped: ['public/fonts/A.ttf'],
  registry: {
    'public/fonts/A.ttf': { spdx: 'OFL-1.1', family: 'Liberation Sans', attribution: 'public/fonts/OFL.txt' },
  },
  policy: WORLD_POLICY,
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

  /** OFL-1.1 = Google BY_EXCEPTION_ONLY: χωρίς ρητή `assetExceptions` ΔΕΝ περνά. */
  it('Κ4: OFL-1.1 χωρίς ρητή εξαίρεση στην πολιτική ⇒ 🔴 license-not-allowed', () => {
    const v = A.judge(world({ policy: policyWith((raw) => { raw.assetExceptions = []; }) }));
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
  it('Π2: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — με ΠΡΑΓΜΑΤΙΚΕΣ αποδείξεις και αυστηρότερη πολιτική, ΟΛΑ πέφτουν', () => {
    // Αυστηρότερη = καμία εξαίρεση αρχείου + το Apache-2.0 μετακινείται σε κατηγορία που θέλει έγκριση.
    const strict = policyWith((raw) => {
      raw.assetExceptions = [];
      raw.licenseCategories.notice = raw.licenseCategories.notice.filter((id) => id !== 'Apache-2.0');
      raw.licenseCategories.reciprocal.push('Apache-2.0');
    });
    const inv = A.takeInventory(REPO_ROOT, { policy: strict });
    expect(inv.shipped.length).toBeGreaterThan(0);
    const v = A.judge(inv);
    const flagged = A.idsOf(v, A.STATES.LICENSE_NOT_ALLOWED);
    expect(flagged).toEqual(inv.shipped);
    expect(A.idsOf(v, A.STATES.DECLARED_ALLOWED)).toEqual([]);
  });

  /** Και η αντίστροφη κατεύθυνση: με την ΠΡΑΓΜΑΤΙΚΗ πολιτική, κανένα δεν πέφτει. */
  it('Π2β: με την πραγματική πολιτική κάθε διανεμόμενη γραμματοσειρά είναι εγκεκριμένη', () => {
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

  /**
   * 🔑 ΜΙΑ πολιτική (2026-09-16): το ΙΔΙΟ αρχείο και η ΙΔΙΑ συνάρτηση με το CHECK 12. Η απόδειξη
   * ΕΚΤΕΛΕΙ: αφαιρώντας την εξαίρεση OFL από την πολιτική, οι Liberation πέφτουν ΕΔΩ — ενώ το
   * Roboto (Apache-2.0 = notice) μένει, γιατί δεν χρειαζόταν ποτέ εξαίρεση.
   */
  it('Π5: η πολιτική αδειών είναι Η ΜΙΑ — το ίδιο αρχείο και η ίδια απόφαση με το CHECK 12', () => {
    const inv = A.takeInventory(REPO_ROOT);
    expect(A.POLICY_FILE).toBe(LP.POLICY_FILE_NAME);
    expect(inv.policy.raw).toEqual(REAL_POLICY_RAW);

    const v = A.judge(A.takeInventory(REPO_ROOT, { policy: policyWith((raw) => { raw.assetExceptions = []; }) }));
    const notAllowed = A.idsOf(v, A.STATES.LICENSE_NOT_ALLOWED);
    expect(notAllowed.filter((id) => id.includes('Liberation')).length).toBeGreaterThan(0);
    expect(notAllowed).not.toContain('src/services/gantt-export/roboto-font-data.ts');
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
    // ADR-924 §8.8: το CLI δίνει τον φρουρό στο SSoT, που τον καλεί ΠΡΙΝ το ratchet — ελέγχονται ΚΑΙ τα δύο.
    expect(src).toMatch(/runZeroTolerantSetRatchetCli\(\{[\s\S]*\}, enforceZeroTolerance\)/);
    const ssot = require('node:fs').readFileSync(path.join(__dirname, '..', 'lib', 'ratchet-baseline.js'), 'utf8');
    const body = ssot.slice(ssot.indexOf('function runZeroTolerantSetRatchetCli'));
    expect(body.indexOf('enforce(')).toBeGreaterThan(-1);
    expect(body.indexOf('enforce(')).toBeLessThan(body.indexOf('runSetRatchetCli('));
  });

  it('Ζ6: η σπορά ΑΡΝΕΙΤΑΙ να κλειδώσει μπλοκάρουσα κατάσταση σε baseline', () => {
    expect(() => cli.buildPayload({ blocking: [{ state: A.STATES.LICENSE_DRIFT }] }))
      .toThrow(/άρνηση σποράς/);
  });
});

// ─── WOFF2: Η ΙΔΙΑ ΑΠΟΔΕΙΞΗ, ΑΠΟ ΜΟΡΦΗ ΠΟΥ ΤΟ opentype.js ΔΕΝ ΔΙΑΒΑΖΕΙ ─────────

/**
 * 🔴 Ως τις 2026-10-10 δεν διανέμαμε κανένα `.woff2`, οπότε το ότι το `opentype.js` δεν τα
 * διαβάζει ήταν αόρατο. Τη μέρα που η Roboto του UI έγινε checked-in, και τα εννέα αρχεία της
 * θα έβγαιναν ⛔ `unreadable-asset` — μπλοκάρισμα επειδή η πύλη **δεν μπορεί να κοιτάξει**.
 */
describe('Α′ — η απόδειξη διαβάζεται ΚΑΙ από WOFF2 (ADR-805 §10)', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const W2 = require('../lib/font-assets/woff2');
  const LATIN = 'public/fonts/roboto/roboto-v3.015-latin.woff2';

  it('Α6: η Roboto του UI δηλώνει OFL-1.1 στο ΔΙΚΟ της name table — όχι Apache-2.0', () => {
    const ev = E.readEvidence(REPO_ROOT, LATIN);
    expect(ev.family).toBe('Roboto');
    expect(ev.licenseURL).toMatch(/openfontlicense\.org/);
    expect(ev.spdx).toBe('OFL-1.1');
    expect(ev.glyphs).toBeGreaterThan(100);
  });

  /** 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς τον αναγνώστη WOFF2, το ίδιο αρχείο ΔΕΝ διαβάζεται. */
  it('Α7: το opentype.js ΑΠΟΡΡΙΠΤΕΙ το ίδιο αρχείο — ο αναγνώστης WOFF2 δεν είναι πλεονασμός', () => {
    const buf = fs.readFileSync(path.join(REPO_ROOT, LATIN));
    expect(W2.isWoff2(buf)).toBe(true);
    // eslint-disable-next-line global-require
    const opentype = require('opentype.js');
    expect(() => opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)))
      .toThrow();
  });

  it('Α8: κομμένο WOFF2 ⇒ `unreadable`, ΠΟΤΕ σιωπηλό πέρασμα', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-assets-w2-'));
    const whole = fs.readFileSync(path.join(REPO_ROOT, LATIN));
    fs.writeFileSync(path.join(dir, 'cut.woff2'), whole.subarray(0, 400));
    const ev = E.readEvidence(dir, 'cut.woff2');
    expect(ev.unreadable).toBeTruthy();
    expect(ev.spdx).toBeUndefined();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('Α9: η μορφή κρίνεται από τα BYTES — ένα TTF δεν περνά από τον αναγνώστη WOFF2', () => {
    const ttf = fs.readFileSync(path.join(REPO_ROOT, 'public/fonts/LiberationSans-Regular.ttf'));
    expect(W2.isWoff2(ttf)).toBe(false);
    expect(() => W2.readNames(ttf)).toThrow(/υπογραφή/);
  });
});

// ─── Ρ — ΚΑΜΙΑ ΓΡΑΜΜΑΤΟΣΕΙΡΑ ΑΠΟ ΤΡΙΤΟΝ, ΚΑΙ Η ROBOTO ΤΟΥ UI ΕΙΝΑΙ ΑΥΤΗ ΠΟΥ ΛΕΜΕ ──

/**
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ** (2026-10-10). Το `next/font/google` κατέβαζε το CSS της Google σε κάθε
 * εκκίνηση· μια μέρα η Google απάντησε αλλιώς και **καμία σελίδα δεν αποδόθηκε**. Και τα bytes
 * που σέρβιρε ήταν **OFL-1.1** ενώ το ADR έγραφε Apache-2.0 — κανείς δεν μπορούσε να το δει,
 * γιατί δεν ήταν ποτέ checked-in.
 */
describe('Ρ — καμία γραμματοσειρά από τρίτον (ADR-805 §10)', () => {
  const fs = require('node:fs');
  const W2 = require('../lib/font-assets/woff2');
  const { stripComments } = require('../lib/source-text');
  const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

  const GOOGLE_IMPORT = 'import { Roboto } from "next/font/google";\n';

  it('Ρ1: το πραγματικό δέντρο δεν φορτώνει γραμματοσειρά από τρίτον', () => {
    expect(A.remoteFontSources(REPO_ROOT)).toEqual([]);
  });

  /**
   * 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ, ΠΑΝΩ ΣΤΟ ΠΡΑΓΜΑΤΙΚΟ ΑΡΧΕΙΟ: το `layout.tsx` όπως είναι **δεν** δίνει
 * εύρημα· με την παλιά γραμμή εισαγωγής μπροστά, **δίνει**. Αν ο ανιχνευτής ήταν κενός, το
   * `Ρ1` θα έμενε πράσινο για πάντα.
   */
  it('Ρ2: αν ξαναμπεί το `next/font/google` στο layout ⇒ ο ανιχνευτής το ΒΛΕΠΕΙ', () => {
    const layout = read('src/app/layout.tsx');
    expect(A.remoteNeedlesIn(layout)).toEqual([]);
    expect(A.remoteNeedlesIn(GOOGLE_IMPORT + layout)).toEqual(['next/font/google']);
    expect(A.remoteNeedlesIn("@import url('https://fonts.googleapis.com/css2?family=Roboto');"))
      .toEqual(['fonts.googleapis.com']);
  });

  it('Ρ2β: …και το εύρημα ΜΠΛΟΚΑΡΕΙ (⛔ remote-font-source, ποτέ σε baseline)', () => {
    const v = A.judge(world({ remote: [{ file: 'src/app/layout.tsx', needle: 'next/font/google' }] }));
    expect(A.idsOf(v, A.STATES.REMOTE_FONT_SOURCE)).toEqual(['src/app/layout.tsx']);
    expect(A.BLOCKING).toContain(A.STATES.REMOTE_FONT_SOURCE);
    expect(A.RATCHETED).not.toContain(A.STATES.REMOTE_FONT_SOURCE);
  });

  /** Η τεκμηρίωση της βλάβης δεν είναι η βλάβη (σχήμα `Π6`): το `ui-font.css` την περιγράφει σε σχόλιο. */
  it('Ρ2γ: η αναφορά μέσα σε ΣΧΟΛΙΟ δεν μετρά — και το `ui-font.css` έχει τέτοια', () => {
    const css = read('src/app/ui-font.css');
    expect(css).toContain('next/font/google');
    expect(A.remoteNeedlesIn(css)).toEqual([]);
  });

  // ── Το φύλλο στυλ της Roboto ↔ τα αρχεία της ──────────────────────────────

  const UI_CSS = 'src/app/ui-font.css';
  const PUBLIC = 'public';

  /** Οι όψεις `Roboto UI` του φύλλου στυλ, με τη σειρά δήλωσης. */
  function faces() {
    const css = stripComments(read(UI_CSS));
    return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)]
      .map((m) => m[1])
      .filter((body) => /font-family:\s*'Roboto UI'\s*;/.test(body))
      .map((body) => ({
        url: /url\('([^']+)'\)/.exec(body)[1],
        weight: Number(/font-weight:\s*(\d+)/.exec(body)[1]),
        ranges: /unicode-range:\s*([^;]+);/.exec(body)[1].split(',').map((r) => {
          const [lo, hi] = r.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16));
          return [lo, hi ?? lo];
        }),
      }));
  }
  const inRanges = (ranges, cp) => ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
  const subsetOf = (url) => /roboto-v[\d.]+-([a-z-]+)\.woff2$/.exec(url)[1];
  const coverage = (url) => W2.readCoverage(fs.readFileSync(path.join(REPO_ROOT, PUBLIC, url)));

  it('Ρ3: κάθε `url()` είναι αρχείο του ΜΗΤΡΩΟΥ, και κάθε δηλωμένη Roboto woff2 χρησιμοποιείται', () => {
    const registry = JSON.parse(read(A.REGISTRY_FILE)).assets;
    const used = [...new Set(faces().map((f) => `${PUBLIC}${f.url}`))].sort();
    const declared = Object.keys(registry).filter((rel) => rel.endsWith('.woff2')).sort();
    expect(used).toHaveLength(9);
    expect(used).toEqual(declared);
    // Κάθε υποσύνολο έχει ΚΑΙ τα δύο βάρη, πάνω στο ΙΔΙΟ αρχείο.
    for (const rel of used) {
      const weights = faces().filter((f) => `${PUBLIC}${f.url}` === rel).map((f) => f.weight).sort();
      expect(weights).toEqual([400, 700]);
    }
  });

  it('Ρ4: το layout προφορτώνει ΑΚΡΙΒΩΣ latin + greek, με `href` ίδιο με το `url()` και με crossOrigin', () => {
    const layout = stripComments(read('src/app/layout.tsx'));
    const links = [...layout.matchAll(/<link\s+rel="preload"([^>]*)>/g)].map((m) => m[1])
      .filter((attrs) => /as="font"/.test(attrs));
    const hrefs = links.map((attrs) => /href="([^"]+)"/.exec(attrs)[1]);
    expect(hrefs.map(subsetOf).sort()).toEqual(['greek', 'latin']);
    const urls = new Set(faces().map((f) => f.url));
    for (const href of hrefs) expect(urls.has(href)).toBe(true);
    for (const attrs of links) {
      expect(attrs).toMatch(/crossOrigin="anonymous"/);
      expect(attrs).toMatch(/type="font\/woff2"/);
    }
  });

  /**
   * 🔑 «Ελληνικά και λατινικά σε Roboto 400/700» — κριμένο από τα **bytes**, όχι από το όνομα
   * του αρχείου: κάθε χαρακτήρας πρέπει να είναι ΚΑΙ μέσα στο δηλωμένο εύρος ΚΑΙ γλύφος του αρχείου.
   */
  it('Ρ5: ελληνικά και λατινικά καλύπτονται από το εύρος ΚΑΙ από τους γλύφους του αρχείου τους', () => {
    const bySubset = Object.fromEntries(faces().map((f) => [subsetOf(f.url), f]));
    const check = (subset, text) => {
      const face = bySubset[subset];
      const glyphs = new Set(coverage(face.url).codepoints);
      for (const ch of text) {
        const cp = ch.codePointAt(0);
        expect([subset, ch, inRanges(face.ranges, cp), glyphs.has(cp)]).toEqual([subset, ch, true, true]);
      }
    };
    check('greek', 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρσςτυφχψωάέήίόύώϊϋΐΰΆΈΉΊΌΎΏ');
    check('latin', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?()€²%');
  });

  /**
   * 🔴 **ΜΕΤΡΗΜΕΝΟ 2026-10-10**: με τα εύρη της Google αυτούσια, ένα «→» και ένα «⌘» στη σελίδα
   * κτιρίων κατέβαζαν το `symbols` **και** το `math` (62 KB) — και **κανένα** δεν είχε τον γλύφο.
   * Η Google δηλώνει το ίδιο γενικό εύρος για κάθε οικογένεια (`symbols`: 3.960 κωδικοί, το
   * αρχείο έχει 9). Ένας δηλωμένος κωδικός χωρίς γλύφο είναι **υπόσχεση που κοστίζει αίτημα**.
   */
  it('Ρ5β: ΚΑΘΕ δηλωμένος κωδικός είναι γλύφος του αρχείου του — κανένα εύρος-υπόσχεση', () => {
    for (const face of faces().filter((f) => f.weight === 400)) {
      const glyphs = new Set(coverage(face.url).codepoints);
      const promised = face.ranges.flatMap(([lo, hi]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i));
      const empty = promised.filter((cp) => !glyphs.has(cp));
      expect([subsetOf(face.url), empty]).toEqual([subsetOf(face.url), []]);
      expect(promised.length).toBeGreaterThan(0);
    }
    // Και τα δύο βάρη του ίδιου αρχείου δηλώνουν το ΙΔΙΟ εύρος.
    for (const face of faces().filter((f) => f.weight === 700)) {
      const twin = faces().find((f) => f.weight === 400 && f.url === face.url);
      expect(face.ranges).toEqual(twin.ranges);
    }
  });

  it('Ρ6: κάθε αρχείο είναι variable με άξονα wght που ΠΕΡΙΕΧΕΙ το 400 και το 700 (όχι ψευδο-έντονα)', () => {
    for (const url of new Set(faces().map((f) => f.url))) {
      const wght = coverage(url).axes.find((a) => a.tag === 'wght');
      expect([url, wght && wght.min <= 400 && wght.max >= 700]).toEqual([url, true]);
    }
  });

  /**
   * 🔑 Σε επικάλυψη ευρών κερδίζει η **τελευταία** δήλωση (CSS Fonts 4 §4.5). Το `math` έχει κι
   * αυτό ελληνικά γράμματα και τα δηλώνει — ο παρονομαστής είναι **μέσα** στην άγκυρα: αν έπαυε
   * να τα έχει, η σειρά δεν θα είχε πια σημασία και η άγκυρα θα το έλεγε.
   */
  it('Ρ7: το `greek` δηλώνεται ΜΕΤΑ το `math` — αλλιώς τα ελληνικά τραβούν το αρχείο `math`', () => {
    const order = faces().filter((f) => f.weight === 400).map((f) => subsetOf(f.url));
    const math = faces().find((f) => subsetOf(f.url) === 'math');
    const alpha = 'α'.codePointAt(0);
    expect(inRanges(math.ranges, alpha)).toBe(true);
    expect(coverage(math.url).codepoints).toContain(alpha);
    expect(order.indexOf('greek')).toBeGreaterThan(order.indexOf('math'));
    expect(order[order.length - 1]).toBe('latin');
  });

  /** Το `/fonts/(.*)` σερβίρεται `immutable` για έναν χρόνο: το όνομα ΠΡΕΠΕΙ να αλλάζει με την έκδοση. */
  it('Ρ8: το όνομα κάθε αρχείου κουβαλά την έκδοση που δηλώνει το ΔΙΚΟ του name table', () => {
    for (const url of new Set(faces().map((f) => f.url))) {
      const inName = /roboto-v([\d.]+)-/.exec(url)[1];
      const names = W2.readNames(fs.readFileSync(path.join(REPO_ROOT, PUBLIC, url)));
      expect([url, names.version.includes(`Version ${inName}`)]).toEqual([url, true]);
    }
    expect(read('next.config.js')).toMatch(/source: '\/fonts\/\(\.\*\)'[\s\S]{0,200}immutable/);
  });
});
