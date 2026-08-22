/**
 * @jest-environment node
 *
 * =============================================================================
 * ADR-744 §15 (Φ4) — ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΑΦΑΙΡΕΣΗΣ
 * =============================================================================
 *
 * Το per-route slice είναι **ΑΦΑΙΡΕΣΗ**: κρατά μόνο ό,τι το κέλυφος δεν απαντά
 * ήδη. Αν η αφαίρεση σπάσει προς τα **πάνω** (κρατά περισσότερα), κάθε σελίδα
 * ξανακουβαλά τα κοινά κλειδιά και το «per-route» γίνεται **ΜΕΓΑΛΥΤΕΡΟ** από το
 * σημερινό. Αν σπάσει προς τα **κάτω** (κρατά λιγότερα), βγαίνει ωμό κλειδί.
 * Καμία από τις δύο δεν φαίνεται χωρίς άγκυρα — γι' αυτό υπάρχει αυτό το αρχείο.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RS = require('../lib/i18n-shell-slice/route-slices');

const REPO = path.resolve(__dirname, '..', '..');

describe('Α — η ταυτότητα της διαδρομής', () => {
  it('Α1: το route group ΔΕΝ μπαίνει στο id (είναι φάκελος, όχι URL)', () => {
    expect(RS.routeIdFor('src/app/(app)/test-harness/listing-shapes/page.tsx')).toBe('test-harness__listing-shapes');
    expect(RS.routeUrlFor('src/app/(app)/test-harness/listing-shapes/page.tsx')).toBe('/test-harness/listing-shapes');
  });

  it('Α2: τα δυναμικά τμήματα χάνουν τις αγκύλες στο ΟΝΟΜΑ ΑΡΧΕΙΟΥ, όχι στη διεύθυνση', () => {
    expect(RS.routeIdFor('src/app/(light)/listing/[id]/page.tsx')).toBe('listing__id');
    expect(RS.routeUrlFor('src/app/(light)/listing/[id]/page.tsx')).toBe('/listing/[id]');
  });

  it('Α3: η ρίζα έχει όνομα, δεν γίνεται κενό', () => {
    expect(RS.routeIdFor('src/app/(light)/page.tsx')).toBe('root');
    expect(RS.routeUrlFor('src/app/(light)/page.tsx')).toBe('/');
  });
});

describe('Σ — η αφαίρεση', () => {
  it('Σ1: κλειδί που ΥΠΑΡΧΕΙ στο κέλυφος αφαιρείται', () => {
    const route = { ns: { a: 'ΑΛΦΑ', b: 'ΒΗΤΑ' } };
    const shell = { ns: { a: 'ΑΛΦΑ' } };
    expect(RS.subtractShell(route, shell, [])).toEqual({ ns: { b: 'ΒΗΤΑ' } });
  });

  it('Σ2: namespace που ταξιδεύει ΟΛΟΚΛΗΡΟ στο κέλυφος φεύγει εντελώς', () => {
    const route = { common: { x: 'Χ' }, other: { y: 'Υ' } };
    expect(RS.subtractShell(route, {}, ['common'])).toEqual({ other: { y: 'Υ' } });
  });

  it('Σ3: η αφαίρεση είναι ΑΝΑΔΡΟΜΙΚΗ — φωλιασμένα κλειδιά κρίνονται ξεχωριστά', () => {
    const route = { ns: { map: { basemap: { map: 'Χάρτης', satellite: 'Δορυφόρος' } } } };
    const shell = { ns: { map: { basemap: { map: 'Χάρτης' } } } };
    expect(RS.subtractShell(route, shell, [])).toEqual({ ns: { map: { basemap: { satellite: 'Δορυφόρος' } } } });
  });

  it('Σ4: κλάδος που αδειάζει ΕΞΑΦΑΝΙΖΕΤΑΙ — κανένα κενό αντικείμενο', () => {
    const route = { ns: { map: { basemap: { map: 'Χάρτης' } } } };
    const shell = { ns: { map: { basemap: { map: 'Χάρτης' } } } };
    expect(RS.subtractShell(route, shell, [])).toEqual({});
  });

  it('Σ5: namespace που ΔΕΝ υπάρχει καθόλου στο κέλυφος περνά ΑΘΙΚΤΟ', () => {
    const route = { 'geo-canvas': { map: { basemap: { map: 'Χάρτης' } } } };
    expect(RS.subtractShell(route, { common: {} }, [])).toEqual(route);
  });

  it('Σ6: διαφορετική ΤΙΜΗ στο ίδιο κλειδί ΔΕΝ επιβιώνει — το κέλυφος είναι η αυθεντία', () => {
    // Αν το route slice κρατούσε τη δική του τιμή, θα υπήρχαν ΔΥΟ αλήθειες για
    // το ίδιο κλειδί, και ποια κερδίζει θα το έκρινε η σειρά εγκατάστασης.
    const route = { ns: { a: 'ΔΙΑΦΟΡΕΤΙΚΟ' } };
    const shell = { ns: { a: 'ΚΕΛΥΦΟΣ' } };
    expect(RS.subtractShell(route, shell, [])).toEqual({});
  });
});

/**
 * ⚠️ **ΤΟ ΣΥΝΟΛΟ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΗ ΔΗΛΩΣΗ, ΟΧΙ ΑΠΟ ΛΙΣΤΑ ΕΔΩ.** Μια δεύτερη
 * χειρόγραφη λίστα διαδρομών μέσα στο test θα απέκλινε από το
 * `.i18n-shell-slice.json` — ακριβώς το σχήμα που αυτό το ADR υπάρχει για να
 * καταργήσει. Νέα διαδρομή στη δήλωση ⇒ ελέγχεται **αυτόματα**.
 */
describe('Π — τα πραγματικά artifacts στο δέντρο', () => {
  const config = JSON.parse(fs.readFileSync(path.join(REPO, '.i18n-shell-slice.json'), 'utf8'));
  const declared = Object.keys(config.routeSlices || {});
  const shell = JSON.parse(fs.readFileSync(path.join(REPO, 'src/i18n/generated/shell-slice.el.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'src/i18n/generated/shell-slice.manifest.json'), 'utf8'));
  const wholeRaw = JSON.parse(fs.readFileSync(path.join(REPO, 'src/i18n/generated/shell-slice.whole.json'), 'utf8'));
  const wholeNs = Array.isArray(wholeRaw) ? wholeRaw : Object.keys(wholeRaw);

  it('Π0: υπάρχει τουλάχιστον μία δηλωμένη διαδρομή — αλλιώς τα Π από κάτω δεν ασκούνται', () => {
    expect(declared.length).toBeGreaterThan(0);
  });

  it.each(declared)('Π1 [%s]: το artifact υπάρχει και δεν είναι κενό', page => {
    const rel = RS.sliceFileFor({ outputDir: 'src/i18n/generated' }, RS.routeIdFor(page), 'el');
    expect(fs.existsSync(path.join(REPO, rel))).toBe(true);
    expect(Object.keys(JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'))).length).toBeGreaterThan(0);
  });

  it.each(declared)('Π2 [%s]: κανένα namespace που το κέλυφος ταξιδεύει ΟΛΟΚΛΗΡΟ', page => {
    const rel = RS.sliceFileFor({ outputDir: 'src/i18n/generated' }, RS.routeIdFor(page), 'el');
    const slice = JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'));
    expect(Object.keys(slice).filter(ns => wholeNs.includes(ns))).toEqual([]);
  });

  it.each(declared)('Π3 [%s]: το manifest ΤΟ ΥΠΟΓΡΑΦΕΙ — αλλιώς κανένας φρουρός δεν το βλέπει', page => {
    const rel = RS.sliceFileFor({ outputDir: 'src/i18n/generated' }, RS.routeIdFor(page), 'el');
    expect(Object.keys(manifest.artifacts)).toContain(rel);
  });

  it('Π4: το κέλυφος ΔΕΝ κατάπιε το geo-canvas (θα ήταν σιωπηλή ένωση)', () => {
    expect(shell['geo-canvas']).toBeUndefined();
    // …και το slice είναι κλάσμα του πλήρους locale — αλλιώς δεν κερδίσαμε τίποτα.
    const rel = RS.sliceFileFor({ outputDir: 'src/i18n/generated' }, 'test-harness__listing-shapes', 'el');
    const sliceBytes = fs.statSync(path.join(REPO, rel)).size;
    const localeBytes = fs.statSync(path.join(REPO, 'src/i18n/locales/el/geo-canvas.json')).size;
    expect(sliceBytes).toBeLessThan(localeBytes / 5);
  });

  /**
   * 🔴 ADR-744 §18 — «ΤΟ ARTIFACT ΥΠΑΡΧΕΙ» ΔΕΝ ΣΗΜΑΙΝΕΙ «ΠΑΡΑΔΙΔΕΤΑΙ».
   *
   * Πληρώθηκε ζωντανά: οι τέσσερις δημόσιες οθόνες πήραν δήλωση, artifact, υπογραφή στο
   * manifest και **πράσινες πύλες** (3.34 · 3.51 · κάλυψη 68/68 κλειδιών μέσα στο αρχείο)
   * ενώ **κανένα από τα τέσσερα `page.tsx` δεν εισήγαγε το slice του**. Ο μηχανισμός
   * παράδοσης (§15.5) είναι **στατική εισαγωγή + `registerRouteSlice()` σε εμβέλεια
   * module**· χωρίς αυτήν το slice δεν φορτώνεται ποτέ και η θεραπεία είναι **ΑΔΡΑΝΗΣ**.
   *
   * ⚠️ Ο έλεγχος ΔΕΝ ρωτά το `page.tsx`: τα έντεκα προϋπάρχοντα εγγράφουν από **component**
   * μέσα στην κλειστότητά τους (`ListingDetailContent.tsx` κ.λπ.), και αυτό είναι σωστό.
   * Ρωτά «υπάρχει **ΚΩΔΙΚΑΣ ΠΡΟΪΟΝΤΟΣ** που το εισάγει **και** καλεί `registerRouteSlice`;».
   *
   * ⚠️ ΤΑ TESTS ΔΕΝ ΜΕΤΡΑΝΕ. Το `route-slice.test.ts` εισάγει ένα artifact ως fixture — αν
   * περνούσε για παράδοση, ένα slice θα φαινόταν «ζωντανό» επειδή το φορτώνει μια δοκιμή.
   */
  it('Π5: κάθε δηλωμένο route slice ΠΑΡΑΔΙΔΕΤΑΙ — στατική εισαγωγή + registerRouteSlice()', () => {
    const { execFileSync } = require('node:child_process');
    const tracked = execFileSync('git', ['grep', '-l', 'generated/routes/', '--', 'src'], { cwd: REPO, encoding: 'utf8' })
      .split('\n')
      .filter(file => /\.tsx?$/.test(file) && !file.includes('/generated/') && !file.includes('__tests__'));

    const deliveredBy = new Map();
    for (const file of tracked) {
      const source = fs.readFileSync(path.join(REPO, file), 'utf8');
      if (!source.includes('registerRouteSlice(')) continue;
      for (const match of source.matchAll(/from '[^']*generated\/routes\/([A-Za-z0-9_-]+)\.el\.json'/g)) {
        deliveredBy.set(match[1], file);
      }
    }

    const inert = declared.filter(page => !deliveredBy.has(RS.routeIdFor(page)));
    expect(inert).toEqual([]);
  });
});

/**
 * =============================================================================
 * Λ — ΤΟ ΚΑΤΑΣΤΙΧΟ ΤΩΝ ΔΙΑΔΡΟΜΩΝ (ADR-777 §8.43)
 * =============================================================================
 *
 * «Είναι αυτή η δηλωμένη διαδρομή **ΣΕΛΙΔΑ**, ή **ΔΕΥΤΕΡΟ ΚΕΛΥΦΟΣ**;»
 *
 * Οι αριθμοί εδώ **δεν είναι fixtures** — είναι η μέτρηση της 2026-08-21 στο πραγματικό
 * δέντρο, με τον ίδιο `buildShellPlan` και ρίζα τη σελίδα. Αν αλλάξουν, κάτι πραγματικό
 * κουνήθηκε και θέλει ματιά, όχι σιωπηλή ενημέρωση του αριθμού.
 * =============================================================================
 */
describe('Λ — το κατάστιχο των διαδρομών (§8.43)', () => {
  const L = require('../lib/i18n-shell-slice/ledger');
  const config = JSON.parse(fs.readFileSync(path.join(REPO, '.i18n-shell-slice.json'), 'utf8'));
  const bytesOf = tree => Buffer.byteLength(JSON.stringify(tree), 'utf8');
  const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

  const SHELL_BYTES = bytesOf(readJson(path.join(REPO, 'src/i18n/generated/shell-slice.el.json')));
  /** ΜΕΤΡΗΜΕΝΟ 2026-08-21: το `/properties/[id]` θα κόστιζε τόσα, σε 48 namespaces. */
  const PROPERTIES_ID_BYTES = 240521;
  const ok = { budget: 10_000, reason: 'άγκυρα' };

  const observe = () => Object.keys(config.routeSlices).map(page => ({
    id: RS.routeIdFor(page),
    page,
    actual: bytesOf(readJson(path.join(REPO, `src/i18n/generated/routes/${RS.routeIdFor(page)}.el.json`))),
  }));

  it('Λ1: σκέτο `reason` ΑΠΟΡΡΙΠΤΕΤΑΙ — πρόζα δεν είναι προϋπολογισμός (§8.38 στον αδελφό)', () => {
    expect(() => L.auditRouteLedger({ p: { reason: 'μόνο λόγια' } }, [], 1000))
      .toThrow(/budget/);
    // …και το μήνυμα ΟΝΟΜΑΖΕΙ το σωστό κατάστιχο, αλλιώς ο αναγνώστης ψάχνει αλλού.
    expect(() => L.auditRouteLedger({ p: 'κάποτε ήταν συμβολοσειρά' }, [], 1000))
      .toThrow(/routeSlices\.p/);
  });

  it('Λ2: το ΠΡΑΓΜΑΤΙΚΟ δέντρο κλείνει — 11 παρόντα, 0 απόντα, 0 ορφανά, 0 αποτυχίες', () => {
    const audit = L.auditRouteLedger(config.routeSlices, observe(), SHELL_BYTES);
    const count = state => audit.entries.filter(entry => entry.presence === state).length;
    expect(count(L.ROUTE_PRESENCE.PRESENT)).toBe(Object.keys(config.routeSlices).length);
    expect(count(L.ROUTE_PRESENCE.ABSENT)).toBe(0);
    expect(count(L.ROUTE_PRESENCE.ORPHAN)).toBe(0);
    expect(L.describeRouteFailures(audit.failures, SHELL_BYTES)).toBe('');
    // ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: κάθε παρούσα εγγραφή ΚΡΙΘΗΚΕ και στους δύο άξονες. Χωρίς αυτό,
    // «0 αποτυχίες» θα μπορούσε να σημαίνει «κανείς δεν κοίταξε».
    expect(audit.entries.every(entry => entry.budgetVerdict !== null && entry.shapeVerdict !== null)).toBe(true);
  });

  it('Λ3: ΒΑΘΜΟΝΟΜΗΣΗ — το /properties/[id] είναι ΔΕΥΤΕΡΟ ΚΕΛΥΦΟΣ (240.521 έναντι κελύφους)', () => {
    // Το εύρημα του §8.43, κλειδωμένο: 145,2% του κελύφους. Ένα route slice μεγαλύτερο
    // από το κέλυφος ΔΕΝ είναι αφαίρεση. Δηλώνεται με γενναιόδωρο ταβάνι επίτηδες —
    // η απόδειξη είναι ότι το Κ1 μιλά ΑΚΟΜΑ ΚΑΙ ΟΤΑΝ το Κ2 σιωπά.
    expect(PROPERTIES_ID_BYTES).toBeGreaterThan(SHELL_BYTES);
    const audit = L.auditRouteLedger(
      { 'src/app/(app)/properties/[id]/page.tsx': { budget: 999_999, reason: 'υποθετικό' } },
      [{ id: 'properties__id', page: 'src/app/(app)/properties/[id]/page.tsx', actual: PROPERTIES_ID_BYTES }],
      SHELL_BYTES,
    );
    expect(audit.entries[0].shapeVerdict).toBe(L.ROUTE_SHAPE.SECOND_SHELL);
    expect(audit.entries[0].budgetVerdict).toBe(L.ROUTE_BUDGET.WITHIN);
    expect(L.describeRouteFailures(audit.failures, SHELL_BYTES)).toMatch(/ΔΕΥΤΕΡΟ ΚΕΛΥΦΟΣ/);
  });

  it('Λ4: Κ1 και Κ2 είναι ΑΝΕΞΑΡΤΗΤΑ — ένας κανόνας με «ή» θα έπεφτε και στις δύο φορές', () => {
    // (α) εντός ταβανιού, αλλά ≥ κέλυφος ⇒ μόνο το Κ1 μιλά.
    const k1 = L.auditRouteLedger({ p: { budget: 999_999, reason: 'r' } },
      [{ id: 'p', page: 'p', actual: SHELL_BYTES }], SHELL_BYTES);
    expect(k1.entries[0].budgetVerdict).toBe(L.ROUTE_BUDGET.WITHIN);
    expect(k1.entries[0].shapeVerdict).toBe(L.ROUTE_SHAPE.SECOND_SHELL);
    expect(k1.failures).toHaveLength(1);

    // (β) μικροσκοπικό σε σχέση με το κέλυφος, αλλά πάνω από το ταβάνι ⇒ μόνο το Κ2.
    const k2 = L.auditRouteLedger({ p: { budget: 1_000, reason: 'r' } },
      [{ id: 'p', page: 'p', actual: 5_000 }], SHELL_BYTES);
    expect(k2.entries[0].budgetVerdict).toBe(L.ROUTE_BUDGET.OVER);
    expect(k2.entries[0].shapeVerdict).toBe(L.ROUTE_SHAPE.PAGE);
    expect(k2.failures).toHaveLength(1);
  });

  it('Λ5: `orphan-artifact` — artifact ΧΩΡΙΣ δήλωση μπλοκάρει (το writeArtifacts δεν κλαδεύει)', () => {
    const audit = L.auditRouteLedger({ p: ok },
      [{ id: 'p', page: 'p', actual: 10 }, { id: 'ξεχασμένο', page: null, actual: 4_242 }], SHELL_BYTES);
    expect(audit.failures).toHaveLength(1);
    expect(L.describeRouteFailures(audit.failures, SHELL_BYTES)).toMatch(/ξεχασμένο.*ΧΩΡΙΣ δήλωση/);
  });

  it('Λ6: `declared-but-absent` — δήλωση χωρίς artifact μπλοκάρει', () => {
    const audit = L.auditRouteLedger({ p: ok }, [], SHELL_BYTES);
    expect(audit.entries[0].presence).toBe(L.ROUTE_PRESENCE.ABSENT);
    expect(L.describeRouteFailures(audit.failures, SHELL_BYTES)).toMatch(/ΔΕΝ παρήχθη artifact/);
  });

  it('Λ7: fail-closed — χωρίς παρονομαστή το Κ1 ΔΕΝ απαντά «καθαρό», σκάει με όνομα', () => {
    for (const bad of [0, -1, undefined, null, 1.5, '165649']) {
      expect(() => L.auditRouteLedger({}, [], bad)).toThrow(/κέλυφος|shellBytes|άγνωστο/);
    }
  });

  it('Λ8: ΚΑΝΕΝΑΣ ΑΡΙΘΜΟΣ ΔΕΝ ΣΙΩΠΑ ΤΟ Κ1 — το κατώφλι είναι παραγόμενο, όχι δηλωμένο', () => {
    // Η μετάλλαξη που θα «διόρθωνε» ένα κόκκινο Κ2 — ανέβασμα του ταβανιού — αφήνει το
    // Κ1 κόκκινο. Αυτός είναι όλος ο λόγος που οι δύο κανόνες δεν είναι ένας.
    for (const budget of [1, 1_000, 240_521, 10_000_000]) {
      const audit = L.auditRouteLedger({ p: { budget, reason: 'r' } },
        [{ id: 'p', page: 'p', actual: PROPERTIES_ID_BYTES }], SHELL_BYTES);
      expect(audit.entries[0].shapeVerdict).toBe(L.ROUTE_SHAPE.SECOND_SHELL);
      expect(audit.failures.length).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠️ ΔΥΟ ΦΡΟΥΡΟΙ, ΚΑΙ Ο ΠΡΩΙΜΟΣ ΧΡΕΙΑΖΕΤΑΙ ΔΙΚΗ ΤΟΥ ΑΓΚΥΡΑ. Το `parseDeclaration`
   * καλείται ΚΑΙ από το `auditRouteLedger` (αργά — αφού χτιστεί ο γράφος, ~40s) ΚΑΙ από το
   * `loadConfig` (νωρίς, σε ΚΑΘΕ καταναλωτή). Τα Λ1-Λ9 ασκούν μόνο τον δεύτερο: σβήνοντας
   * τον πρώιμο, όλα έμεναν ΠΡΑΣΙΝΑ — μετρημένο, ήταν αδρανής φρουρός μέχρι αυτή τη γραμμή.
   */
  it('Λ10: το σχήμα απορρίπτεται ΣΤΗ ΦΟΡΤΩΣΗ, πριν χτιστεί γράφος', () => {
    const os = require('node:os');
    const { loadConfig } = require('../lib/i18n-shell-slice/config');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'route-ledger-'));
    try {
      const write = routeSlices => fs.writeFileSync(
        path.join(dir, '.i18n-shell-slice.json'), JSON.stringify({ routeSlices }), 'utf8',
      );
      write({ 'src/app/x/page.tsx': { budget: 1000, reason: 'ok' } });
      expect(() => loadConfig(dir)).not.toThrow();          // ο παρονομαστής
      write({ 'src/app/x/page.tsx': { reason: 'μόνο πρόζα' } });
      expect(() => loadConfig(dir)).toThrow(/routeSlices.*budget/s);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Λ9: η λογιστική που ΔΕΝ κλείνει σκάει με ΟΝΟΜΑ — δεν επιστρέφει σιωπηλά', () => {
    // Διπλή παρατήρηση της ίδιας δήλωσης: το `byPage` κρατά μία, οπότε το άθροισμα
    // observed (2) δεν μπορεί να ταιριάξει. Αυτό είναι το fail-closed του οργάνου.
    expect(() => L.auditRouteLedger({ p: ok },
      [{ id: 'p', page: 'p', actual: 1 }, { id: 'p', page: 'p', actual: 2 }], SHELL_BYTES))
      .toThrow(/ΔΕΝ κλείνει/);
  });
});

/**
 * Ν — Η ΠΥΛΗ, ΟΧΙ Η ΜΗΧΑΝΗ. Το Λ αποδεικνύει ότι το κατάστιχο κρίνει σωστά· εδώ
 * αποδεικνύεται ότι **κάποιος το τρέχει**. Χωρίς αυτό, το §8.43 θα ήταν ένα anchor χωρίς
 * πύλη — δηλαδή σχόλιο (μάθημα CHECK 3.36).
 */
describe('Ν — το ορφανό artifact μπλοκάρει ΤΗΝ ΠΥΛΗ, στον πραγματικό δίσκο', () => {
  const ROUTES = path.join(REPO, 'src/i18n/generated/routes');
  const PROBE = path.join(ROUTES, 'zz-orphan-probe.el.json');
  const gate = require('../check-i18n-shell-slice');
  const config = JSON.parse(fs.readFileSync(path.join(REPO, '.i18n-shell-slice.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'src/i18n/generated/shell-slice.manifest.json'), 'utf8'));
  const fullConfig = { ...config, outputDir: 'src/i18n/generated' };

  afterEach(() => { if (fs.existsSync(PROBE)) fs.unlinkSync(PROBE); });

  it('Ν0: ΧΩΡΙΣ το ορφανό η πύλη είναι πράσινη — ο παρονομαστής, αλλιώς το Ν1 δεν λέει τίποτα', () => {
    expect(fs.existsSync(PROBE)).toBe(false);
    expect(gate.checkRouteLedger(fullConfig, manifest)).toBeNull();
  });

  it('Ν1: ΜΕ το ορφανό η πύλη ΚΟΚΚΙΝΙΖΕΙ και το ΟΝΟΜΑΖΕΙ', () => {
    fs.writeFileSync(PROBE, JSON.stringify({ ns: { k: 'ξεχασμένο' } }), 'utf8');
    expect(gate.checkRouteLedger(fullConfig, manifest)).toMatch(/zz-orphan-probe.*ΧΩΡΙΣ δήλωση/);
  });

  it('Ν2: το checkArtifactIntegrity ΗΤΑΝ ΤΥΦΛΟ σε αυτό — γι’ αυτό χρειάστηκε νέος κανόνας', () => {
    fs.writeFileSync(PROBE, JSON.stringify({ ns: { k: 'ξεχασμένο' } }), 'utf8');
    // Διατρέχει το `manifest.artifacts`, όπου το ορφανό ΔΕΝ υπάρχει ⇒ δεν το βλέπει ποτέ.
    expect(gate.checkArtifactIntegrity(manifest)).toBeNull();
  });

  /**
   * ⚠️ ΤΑ Ν0-Ν2 ΚΑΛΟΥΝ ΤΗ ΣΥΝΑΡΤΗΣΗ ΑΠΕΥΘΕΙΑΣ — δηλαδή αποδεικνύουν ότι **κρίνει**
   * σωστά, όχι ότι **κάποιος τη ρωτά**. Αν κάποιος τη βγάλει από την αλυσίδα του
   * `runLayerOne`, τα Ν0-Ν2 μένουν ΠΡΑΣΙΝΑ και η πύλη γίνεται διακοσμητική. Γι' αυτό
   * εδώ τρέχει το ΠΡΑΓΜΑΤΙΚΟ CLI και κρίνεται ο κωδικός εξόδου του.
   */
  it('Ν3: το ΠΡΑΓΜΑΤΙΚΟ CLI της CHECK 3.34 βγαίνει 1 με το ορφανό, 0 χωρίς αυτό', () => {
    const { spawnSync } = require('node:child_process');
    const run = () => spawnSync(process.execPath, [path.join(REPO, 'scripts/check-i18n-shell-slice.js')], {
      cwd: REPO, encoding: 'utf8',
    });

    expect(run().status).toBe(0);                                   // ο παρονομαστής
    fs.writeFileSync(PROBE, JSON.stringify({ ns: { k: 'ξεχασμένο' } }), 'utf8');
    const red = run();
    expect(red.status).toBe(1);
    expect(`${red.stdout}${red.stderr}`).toMatch(/zz-orphan-probe/);
  }, 30_000);
});
