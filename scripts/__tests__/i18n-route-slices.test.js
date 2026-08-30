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
  /**
   * ADR-744 §20 — μια **σφραγισμένη μέτρηση** με αλυσίδα που κλείνει. Το `budget`
   * καταργήθηκε: το ταβάνι δεν δηλώνεται πια, **υπολογίζεται** (`sealed × 1,25`).
   */
  const seal = sealed => ({
    sealed,
    sealedAt: '2026-08-30',
    reason: 'άγκυρα',
    history: [{ from: 0, to: sealed, at: '2026-08-30', why: 'άγκυρα' }],
  });
  const ok = seal(10_000);

  const observe = () => Object.keys(config.routeSlices).map(page => ({
    id: RS.routeIdFor(page),
    page,
    actual: bytesOf(readJson(path.join(REPO, `src/i18n/generated/routes/${RS.routeIdFor(page)}.el.json`))),
  }));

  it('Λ1: σκέτο `reason` ΑΠΟΡΡΙΠΤΕΤΑΙ — πρόζα δεν είναι προϋπολογισμός (§8.38 στον αδελφό)', () => {
    expect(() => L.auditRouteLedger({ p: { reason: 'μόνο λόγια' } }, [], 1000))
      .toThrow(/sealed/);
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
      { 'src/app/(app)/properties/[id]/page.tsx': seal(999_999) },
      [{ id: 'properties__id', page: 'src/app/(app)/properties/[id]/page.tsx', actual: PROPERTIES_ID_BYTES }],
      SHELL_BYTES,
    );
    expect(audit.entries[0].shapeVerdict).toBe(L.ROUTE_SHAPE.SECOND_SHELL);
    expect(audit.entries[0].budgetVerdict).toBe(L.ROUTE_BUDGET.WITHIN);
    expect(L.describeRouteFailures(audit.failures, SHELL_BYTES)).toMatch(/ΔΕΥΤΕΡΟ ΚΕΛΥΦΟΣ/);
  });

  it('Λ4: Κ1 και Κ2 είναι ΑΝΕΞΑΡΤΗΤΑ — ένας κανόνας με «ή» θα έπεφτε και στις δύο φορές', () => {
    // (α) εντός ταβανιού, αλλά ≥ κέλυφος ⇒ μόνο το Κ1 μιλά.
    const k1 = L.auditRouteLedger({ p: seal(999_999) },
      [{ id: 'p', page: 'p', actual: SHELL_BYTES }], SHELL_BYTES);
    expect(k1.entries[0].budgetVerdict).toBe(L.ROUTE_BUDGET.WITHIN);
    expect(k1.entries[0].shapeVerdict).toBe(L.ROUTE_SHAPE.SECOND_SHELL);
    expect(k1.failures).toHaveLength(1);

    // (β) μικροσκοπικό σε σχέση με το κέλυφος, αλλά πάνω από το ταβάνι ⇒ μόνο το Κ2.
    const k2 = L.auditRouteLedger({ p: seal(1_000) },
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
    for (const sealed of [1, 1_000, 240_521, 10_000_000]) {
      const audit = L.auditRouteLedger({ p: seal(sealed) },
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
      write({ 'src/app/x/page.tsx': seal(1000) });
      expect(() => loadConfig(dir)).not.toThrow();          // ο παρονομαστής
      write({ 'src/app/x/page.tsx': { reason: 'μόνο πρόζα' } });
      expect(() => loadConfig(dir)).toThrow(/routeSlices.*sealed/s);
      // 🔴 ADR-744 §20 — ΚΑΙ ΤΟ ΠΑΛΙΟ ΣΧΗΜΑ ΑΠΟΡΡΙΠΤΕΤΑΙ ΕΔΩ, ΘΟΡΥΒΩΔΩΣ. Δύο σχήματα
      // στο ίδιο μητρώο = δύο λίστες που αποκλίνουν, το ακριβές ελάττωμα του ADR-744.
      write({ 'src/app/x/page.tsx': { budget: 1000, reason: 'ok' } });
      expect(() => loadConfig(dir)).toThrow(/budget.*καταργήθηκε/s);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * ADR-744 §20 — Κ3: ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΠΡΟΕΛΕΥΣΗΣ ΤΟΥ ΑΡΙΘΜΟΥ
   * ═══════════════════════════════════════════════════════════════════════════ */

  it('Λ11: ΔΕΝ ΥΠΑΡΧΕΙ ΑΡΙΘΜΟΣ ΝΑ ΑΝΕΒΑΣΕΙΣ — το ταβάνι ΠΑΡΑΓΕΤΑΙ από τη σφράγιση', () => {
    // Η μετάλλαξη που το παλιό σχήμα επέτρεπε: «κοκκίνισε; γράψε μεγαλύτερο νούμερο».
    // Εδώ ΔΕΝ υπάρχει πεδίο ταβανιού· η μόνη κίνηση είναι να αλλάξει η ΜΕΤΡΗΣΗ.
    expect(L.ceilingFor(1_000)).toBe(1_250);
    expect(L.ceilingFor(7_900)).toBe(9_875);
    const audit = L.auditRouteLedger({ p: seal(1_000) }, [{ id: 'p', page: 'p', actual: 1_251 }], SHELL_BYTES);
    expect(audit.entries[0].budgetVerdict).toBe(L.ROUTE_BUDGET.OVER);
    expect(audit.entries[0].ceiling).toBe(1_250);
    // …και το μήνυμα ΟΝΟΜΑΖΕΙ τη σφράγιση και το περιθώριο, όχι σκέτο «over budget»:
    // ο αναγνώστης πρέπει να μάθει ΑΠΟ ΠΟΥ βγήκε ο αριθμός, αλλιώς ξαναγράφει bump.
    expect(L.describeRouteFailures(audit.failures, SHELL_BYTES)).toMatch(/σφράγιση 1000 της 2026-08-30 \+ 25% περιθώριο/);
  });

  it('Λ12: το `history` είναι ΑΡΙΘΜΗΤΙΚΗ, όχι ημερολόγιο — αλυσίδα που δεν κλείνει ΜΠΛΟΚΑΡΕΙ', () => {
    const chain = history => ({ sealed: 900, sealedAt: '2026-08-30', reason: 'r', history });
    // (α) το βήμα δεν ξεκινά εκεί που τελείωσε το προηγούμενο
    expect(() => L.parseRouteDeclaration('p', chain([
      { from: 0, to: 500, at: '2026-08-01', why: 'γέννηση' },
      { from: 600, to: 900, at: '2026-08-30', why: 'αύξηση' },
    ]))).toThrow(/αλυσίδα ΔΕΝ κλείνει/);
    // (β) η αλυσίδα δεν καταλήγει στη σφράγιση ⇒ ο αριθμός άλλαξε χωρίς να το πει κανείς
    expect(() => L.parseRouteDeclaration('p', chain([
      { from: 0, to: 500, at: '2026-08-01', why: 'γέννηση' },
    ]))).toThrow(/καταλήγει στα 500 αλλά το `sealed` λέει 900/);
    // (γ) σφράγιση ΧΩΡΙΣ καθόλου αιτιολογία = «bump» με άλλο όνομα
    expect(() => L.parseRouteDeclaration('p', { sealed: 900, sealedAt: '2026-08-30', reason: 'r', history: [] }))
      .toThrow(/history/);
    // (δ) βήμα με κενό `why` — η αιτιολογία είναι ΟΛΟΣ ο λόγος ύπαρξης του history
    expect(() => L.parseRouteDeclaration('p', chain([{ from: 0, to: 900, at: '2026-08-30', why: '   ' }])))
      .toThrow(/why/);
    // (ε) «πέρσι» δεν είναι ημερομηνία
    expect(() => L.parseRouteDeclaration('p', chain([{ from: 0, to: 900, at: 'πέρσι', why: 'w' }])))
      .toThrow(/ΥΥΥΥ-ΜΜ-ΗΗ/);
    // …και η νόμιμη αλυσίδα περνά, αλλιώς όλα τα παραπάνω θα ήταν «πάντα σκάει».
    expect(L.parseRouteDeclaration('p', chain([
      { from: 0, to: 500, at: '2026-08-01', why: 'γέννηση' },
      { from: 500, to: 900, at: '2026-08-30', why: 'η σελίδα απέκτησε πεδίο' },
    ])).ceiling).toBe(1_125);
  });

  /**
   * ⚠️ ΑΥΤΗ Η ΑΓΚΥΡΑ ΓΕΝΝΗΘΗΚΕ ΛΑΘΟΣ ΚΑΙ ΔΙΟΡΘΩΘΗΚΕ ΠΡΙΝ ΚΛΕΙΔΩΣΕΙ. Η πρώτη γραφή
   * σάρωνε το `why` για απαγορευμένες φράσεις (`/για να γίνει πράσινο/`) — και
   * **κοκκίνισε αμέσως**, γιατί η νόμιμη αιτιολογία του `/offers/mandate/new`
   * **ΠΑΡΑΘΕΤΕΙ** τη φράση για να την αντικρούσει. Έλεγχος πρόζας δεν διακρίνει
   * «το λέω» από «το κατηγορώ»: είναι το ίδιο σφάλμα που το §8.38 ονομάζει
   * «πρόζα δεν είναι προϋπολογισμός», με τους ρόλους αντεστραμμένους.
   *
   * Ό,τι μπορεί να κριθεί **δομικά** κρίνεται δομικά· η ποιότητα της αιτιολογίας
   * είναι δουλειά **ανθρώπου σε review**, όπως ακριβώς το `Binary-Size:` footer.
   */
  it('Λ13: ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΜΗΤΡΩΟ — κάθε αλυσίδα κλείνει, καμία σφράγιση δεν είναι από το μέλλον', () => {
    const pages = Object.keys(config.routeSlices);
    expect(pages.length).toBeGreaterThan(0);
    const today = new Date().toISOString().slice(0, 10);
    for (const page of pages) {
      const declaration = L.parseRouteDeclaration(page, config.routeSlices[page]);
      // Η αλυσίδα καταλήγει ΑΚΡΙΒΩΣ στη σφράγιση (το `parseRouteDeclaration` το
      // επιβάλλει· εδώ ασκείται πάνω στο ΠΡΑΓΜΑΤΙΚΟ αρχείο, όχι σε fixture).
      expect(declaration.history[declaration.history.length - 1].to).toBe(declaration.sealed);
      expect(declaration.sealedAt <= today).toBe(true);
      for (const step of declaration.history) {
        // Μια αιτιολογία μιας λέξης είναι «bump» με άλλο όνομα. Το μήκος δεν
        // αποδεικνύει ποιότητα — αποδεικνύει ότι κάποιος ΚΑΘΙΣΕ και έγραψε.
        expect(step.why.trim().length).toBeGreaterThan(40);
        expect(step.at <= today).toBe(true);
      }
    }
  });

  it('Λ14: 🔴 Β2 — Η ΑΡΝΗΣΗ ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ ΩΣ «ΕΝΤΟΣ ΤΑΒΑΝΙΟΥ»', () => {
    // ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: ένα slice που αρνήθηκε να εκπεμφθεί είναι ΕΛΛΙΠΕΣ, άρα τα bytes
    // του είναι ΚΑΤΩ ΦΡΑΓΜΑ. Χωρίς ρητή κατάσταση θα περνούσε ως «WITHIN» — «δεν
    // κρίθηκε» με τη στολή του «κρίθηκε και πέρασε».
    const audit = L.auditRouteLedger(
      { p: seal(10_000) },
      [{ id: 'p', page: 'p', actual: 42, refused: true }],
      SHELL_BYTES,
    );
    expect(audit.entries[0].presence).toBe(L.ROUTE_PRESENCE.REFUSED);
    expect(audit.entries[0].budgetVerdict).toBeNull();   // ΔΕΝ κρίθηκε…
    expect(audit.entries[0].shapeVerdict).toBeNull();
    expect(audit.failures).toHaveLength(1);              // …και ΜΕΤΡΑΕΙ ως αποτυχία
    expect(L.describeRouteFailures(audit.failures, SHELL_BYTES)).toMatch(/ΔΕΝ ΚΡΙΘΗΚΕ.*ΚΑΤΩ ΦΡΑΓΜΑ/s);
    // …και η λογιστική ΚΛΕΙΝΕΙ με την άρνηση μέσα (ζυγίζει και στις δύο πλευρές).
    expect(audit.entries).toHaveLength(1);
  });

  it('Λ15: ο ΤΖΟΓΟΣ ανακοινώνεται — σφράγιση που πάλιωσε κρύβει την επόμενη παλινδρόμηση', () => {
    // Το μάθημα ADR-598 (8× τζόγος επί 40 ημέρες) και το πρότυπο PHPStan
    // `reportUnmatchedIgnoredErrors`: καταστολή που δεν χρειάζεται πια ΕΙΝΑΙ ελάττωμα.
    const audit = L.auditRouteLedger({ p: seal(10_000) }, [{ id: 'p', page: 'p', actual: 4_000 }], SHELL_BYTES);
    expect(audit.failures).toHaveLength(0);                    // ΔΕΝ μπλοκάρει…
    const lines = L.announceRouteSlack(audit.entries);
    expect(lines).toHaveLength(1);                             // …αλλά ΜΙΛΑΕΙ
    expect(lines[0]).toMatch(/6000 bytes κάτω από τη σφράγιση/);
    // …και σιωπά όταν δεν υπάρχει τζόγος, αλλιώς θα ήταν μόνιμος θόρυβος.
    const tight = L.auditRouteLedger({ p: seal(10_000) }, [{ id: 'p', page: 'p', actual: 9_900 }], SHELL_BYTES);
    expect(L.announceRouteSlack(tight.entries)).toHaveLength(0);
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

/**
 * =============================================================================
 * Ε — ΟΙ ΕΙΣΟΔΟΙ ΤΩΝ ΔΙΑΔΡΟΜΩΝ ΕΧΟΥΝ ΑΠΟΤΥΠΩΜΑΤΑ (ADR-744 §21)
 * =============================================================================
 *
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ (2026-08-30). Το working tree μοιράζεται με
 * δεύτερο πράκτορα. Το `MandateCatalogContent.tsx` άλλαξε **ανάμεσα** στο `generate`
 * και στο `commit`, **δύο** route artifacts βγήκαν εκτός συγχρονισμού — και το Layer 1
 * **δεν είπε τίποτα**, γιατί το αρχείο δεν είναι shell module και το
 * `manifest.shellFiles` δεν το περιείχε. Οι **509** είσοδοι των κλειστοτήτων διαδρομών
 * δεν είχαν **καμία** εγγραφή.
 *
 * 🏆 Η αρχή είναι του **Bazel** — παραγόμενο = **δηλωμένο σύνολο εισόδων**,
 * κατακερματισμένο· αλλάζει είσοδος ⇒ μπαγιάτικη έξοδος **εξ ορισμού**. Την είχαμε ήδη
 * για το κέλυφος, και **μόνο** γι' αυτό.
 * =============================================================================
 */
describe('Ε — οι είσοδοι των διαδρομών έχουν αποτυπώματα (§21)', () => {
  const { spawnSync } = require('node:child_process');
  const CHECKER = path.join(REPO, 'scripts/check-i18n-shell-slice.js');
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'src/i18n/generated/shell-slice.manifest.json'), 'utf8'));

  it('Ε0 ΠΑΡΟΝΟΜΑΣΤΗΣ: το `routeFiles` ΥΠΑΡΧΕΙ και δεν είναι κενό', () => {
    // Χωρίς αυτό, τα Ε1-Ε3 θα ήταν πράσινα επειδή **δεν κοίταξαν τίποτα**.
    expect(Object.keys(manifest.routeFiles || {}).length).toBeGreaterThan(0);
  });

  it('Ε1: ΚΑΜΙΑ επικάλυψη με το `shellFiles` — ένα αρχείο, ΜΙΑ απάντηση', () => {
    // Το αποτύπωμα είναι ΤΟΠΙΚΟ στο αρχείο, άρα διπλή εγγραφή είναι διπλότυπο που
    // μπορεί να ΑΠΟΚΛΙΝΕΙ — και τότε ποια κερδίζει το κρίνει η σειρά ανάγνωσης.
    const overlap = Object.keys(manifest.routeFiles).filter(file => file in manifest.shellFiles);
    expect(overlap).toEqual([]);
  });

  it('Ε2: κάθε δηλωμένη διαδρομή έχει ΤΟΥΛΑΧΙΣΤΟΝ μία είσοδο σε έναν από τους δύο πίνακες', () => {
    // Διαδρομή χωρίς καμία αποτυπωμένη είσοδο σημαίνει «κανείς δεν φυλάει την πηγή της».
    const known = new Set([...Object.keys(manifest.shellFiles), ...Object.keys(manifest.routeFiles)]);
    for (const [id, entry] of Object.entries(manifest.routes)) {
      expect({ id, covered: known.has(entry.page) }).toEqual({ id, covered: true });
    }
  });

  /**
   * ⚠️ ΤΟ Ε0-Ε2 ΚΟΙΤΑΖΟΥΝ ΔΕΔΟΜΕΝΑ. Αν κάποιος βγάλει το `routeFiles` από την ερώτηση
   * του `checkStagedShellFiles`, μένουν **ΠΡΑΣΙΝΑ** και η πύλη ξαναγίνεται τυφλή. Γι'
   * αυτό εδώ τρέχει το **ΠΡΑΓΜΑΤΙΚΟ CLI** και κρίνεται ο κωδικός εξόδου του.
   */
  it('Ε3 🔴 ΜΕΤΑΛΛΑΞΗ: αλλαγή σε module ΔΙΑΔΡΟΜΗΣ ⇒ Layer 1 ΚΟΚΚΙΝΟ (ήταν σιωπηλό)', () => {
    // Το θύμα διαβάζεται ΑΠΟ ΤΟ MANIFEST, ποτέ καρφωμένο: μια χειρόγραφη διαδρομή εδώ
    // θα σάπιζε τη μέρα που το αρχείο μετακομίσει, και η άγκυρα θα γινόταν διακοσμητική.
    const victim = Object.keys(manifest.routeFiles).find(file => /\.tsx?$/.test(file));
    expect(victim).toBeDefined();

    const abs = path.join(REPO, victim);
    const original = fs.readFileSync(abs, 'utf8');
    const run = () => spawnSync(process.execPath, [CHECKER, victim], { cwd: REPO, encoding: 'utf8' });
    try {
      expect(run().status).toBe(0);                       // ο παρονομαστής

      // Νέα ακμή εισαγωγής = αλλαγή στο `importSpecs`, δηλαδή στο ΙΔΙΟ το αποτύπωμα.
      fs.writeFileSync(abs, `import { useMemo as __probe } from 'react';\n${original}`, 'utf8');
      const red = run();
      expect(red.status).toBe(1);
      expect(`${red.stdout}${red.stderr}`).toContain(victim);
    } finally {
      // 🛡️ Επαναφορά ΠΑΝΤΑ, byte-ίδια, από μνήμη. ΠΟΤΕ `git checkout`: το δέντρο είναι
      // κοινό με άλλον πράκτορα και ένα checkout θα έσβηνε ΞΕΝΗ δουλειά.
      fs.writeFileSync(abs, original, 'utf8');
    }
    expect(fs.readFileSync(abs, 'utf8')).toBe(original);
  }, 60_000);
});

/**
 * =============================================================================
 * Χ — ΤΙ ΠΑΡΑΓΕΙ Η ΠΗΓΗ, **ΟΛΟΚΛΗΡΟ** (ADR-744 §15 Φ4)
 * =============================================================================
 *
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΤΑ ΓΕΝΝΗΣΕ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ
 * -----------------------------------------------------------
 * Το `dafcf62a` (2026-08-20) πρόσθεσε τα per-route slices **και** τη συγχώνευσή
 * τους στο manifest — **μόνο στον γεννήτορα**. Ο ελεγκτής (Layer 2, CI) έμεινε
 * με το `renderArtifacts` σκέτο, δηλαδή αναπαρήγαγε **2** artifacts ενώ η πηγή
 * παράγει **19**. Η πύλη ήταν **δομικά αδύνατο** να περάσει και έμεινε κόκκινη
 * **8 ημέρες** στο CI. Διαφορά: 17 route entries · `sliceBytes` 192.833 →
 * 313.750 · `inputsSha256`. **Τρία** top-level κλειδιά, κανένα άλλο.
 *
 * ⚠️ ΤΟ ΔΕΥΤΕΡΟ ΚΕΝΟ ΗΤΑΝ ΧΕΙΡΟΤΕΡΟ ΑΠΟ ΤΟ ΠΡΩΤΟ, ΚΑΙ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΤΩΝ Χ3/Χ4:
 * ένα route slice **μπαγιάτικο ως προς την πηγή** αλλά **συνεπές ως προς το
 * manifest** περνούσε **και τα δύο** Layers καθαρό — το Layer 1 ρωτά «ταιριάζει
 * το sha256 που υπέγραψε το manifest;» (ναι), το Layer 2 δεν το κοίταζε καθόλου.
 * Αυτό δεν είναι υποθετικό σχήμα: είναι **ακριβώς** η κατάσταση που αφήνει πίσω
 * του ένα μισό regenerate ή ένα cherry-pick.
 *
 * 🔑 ΓΙΑΤΙ ΚΑΘΕ ΑΓΚΥΡΑ ΕΧΕΙ ΠΑΡΟΝΟΜΑΣΤΗ: μια «διόρθωση» που κάνει το `--full` να
 * συγκρίνει το manifest **με τον εαυτό του** γίνεται πράσινη και δεν ελέγχει
 * τίποτα. Το Χ0 μετρά τι έβλεπε ο ελεγκτής **πριν**, το Χ3 ότι η πύλη είναι
 * πράσινη **χωρίς** πείραγμα — αλλιώς τα Χ1/Χ4 δεν λένε τίποτα.
 *
 * ⚠️ Το Jest εδώ τρέχει με `@swc/jest`, που **ΣΒΗΝΕΙ ΤΟΥΣ ΤΥΠΟΥΣ**: ό,τι
 * επιβάλλεται εδώ επιβάλλεται από **εκτέλεση**, ποτέ από υπογραφή.
 * =============================================================================
 */
describe('Χ — η αναπαραγωγή του ελεγκτή είναι ΟΛΟΚΛΗΡΗ', () => {
  const { spawnSync } = require('node:child_process');
  const { loadConfig } = require('../lib/i18n-shell-slice/config');
  const P = require('../lib/i18n-shell-slice/plan');
  const { sha256 } = require('../lib/i18n-shell-slice/slice-build');
  const { normalize } = require('../check-i18n-shell-slice');

  const CHECKER = path.join(REPO, 'scripts/check-i18n-shell-slice.js');
  const MANIFEST_REL = 'src/i18n/generated/shell-slice.manifest.json';
  const config = loadConfig(REPO);
  const declaredRoutes = Object.keys(config.routeSlices || {}).length;
  const isRoute = artifactPath => artifactPath.includes(`/${RS.ROUTES_DIR}/`);

  let bare;
  let complete;

  // Ένας γράφος για όλη την ομάδα: το χτίσιμο κοστίζει ~20s και είναι ΤΟ ΙΔΙΟ
  // αντικείμενο που θα ξαναχτιζόταν — ο γεννήτορας το περνά για τον ίδιο λόγο.
  beforeAll(() => {
    const graph = P.buildModuleGraph(REPO);
    const plan = P.buildShellPlan(REPO, config, graph);
    bare = P.renderArtifacts(REPO, config, plan);
    complete = RS.renderComplete({ projectRoot: REPO, config, plan, graph, rendered: bare });
  }, 300_000);

  it('Χ0 ΠΑΡΟΝΟΜΑΣΤΗΣ: το `renderArtifacts` ΜΟΝΟ ΤΟΥ δεν παράγει ΚΑΜΙΑ διαδρομή', () => {
    // Χωρίς αυτόν τον ισχυρισμό, το Χ1 θα ήταν πράσινο ακόμη κι αν το
    // `renderArtifacts` έφτιαχνε ήδη τα πάντα — δηλαδή δεν θα έλεγε τίποτα.
    expect(declaredRoutes).toBeGreaterThan(0);
    expect([...bare.artifacts.keys()].filter(isRoute)).toEqual([]);
  });

  it('Χ1: το `renderComplete` προσθέτει ΚΑΘΕ δηλωμένη διαδρομή, και το manifest του είναι ΤΑΥΤΟΣΗΜΟ με τον δίσκο', () => {
    const routePaths = [...complete.rendered.artifacts.keys()].filter(isRoute);

    expect(complete.refused).toEqual([]);
    expect(routePaths).toHaveLength(declaredRoutes);
    expect(complete.rendered.artifacts.size).toBe(bare.artifacts.size + declaredRoutes);
    expect(normalize(complete.rendered.manifestText))
      .toBe(normalize(fs.readFileSync(path.join(REPO, MANIFEST_REL), 'utf8')));
  });

  it('Χ2: ΝΤΕΤΕΡΜΙΝΙΣΜΟΣ — δεύτερη κλήση στις ίδιες εισόδους δίνει byte-ίδιο manifest', () => {
    // Εμβέλεια: η ΣΥΝΘΕΣΗ. Ο ντετερμινισμός ΟΛΗΣ της αλυσίδας (δύο ανεξάρτητα
    // χτισίματα γράφου ⇒ byte-ίδιο manifest) μετρήθηκε χωριστά· εδώ δεν
    // ξαναχτίζεται γράφος για να μη διπλασιαστεί ο χρόνος της σουίτας.
    const graph = P.buildModuleGraph(REPO);
    const plan = P.buildShellPlan(REPO, config, graph);
    const rendered = P.renderArtifacts(REPO, config, plan);
    const again = RS.renderComplete({ projectRoot: REPO, config, plan, graph, rendered });

    expect(again.rendered.manifestText).toBe(complete.rendered.manifestText);
  }, 300_000);

  /**
   * ⚠️ ΤΑ Χ0-Χ2 ΚΑΛΟΥΝ ΤΗ ΣΥΝΑΡΤΗΣΗ ΑΠΕΥΘΕΙΑΣ — αποδεικνύουν ότι **παράγει**
   * σωστά, όχι ότι **κάποιος τη ρωτά**. Αν κάποιος τη βγάλει από το `runFull`,
   * τα Χ0-Χ2 μένουν ΠΡΑΣΙΝΑ και η πύλη ξαναγίνεται τυφλή στις διαδρομές. Γι'
   * αυτό εδώ τρέχει το ΠΡΑΓΜΑΤΙΚΟ CLI και κρίνεται ο κωδικός εξόδου του.
   * (Το ίδιο μάθημα με το Ν3 παραπάνω.)
   */
  describe('Χ3/Χ4 — το ΠΡΑΓΜΑΤΙΚΟ CLI, στον πραγματικό δίσκο', () => {
    const ROUTES_ABS = path.join(REPO, config.outputDir, RS.ROUTES_DIR);
    const [language] = config.languages;

    let targetRel;
    let targetAbs;
    let originalRoute;
    let originalManifest;

    beforeAll(() => {
      const [first] = fs.readdirSync(ROUTES_ABS).filter(f => f.endsWith(`.${language}.json`)).sort();
      expect(first).toBeDefined();
      targetAbs = path.join(ROUTES_ABS, first);
      targetRel = [config.outputDir, RS.ROUTES_DIR, first].join('/');
    });

    beforeEach(() => {
      originalRoute = fs.readFileSync(targetAbs, 'utf8');
      originalManifest = fs.readFileSync(path.join(REPO, MANIFEST_REL), 'utf8');
    });

    // 🛡️ Επαναφορά ΠΑΝΤΑ, byte-ίδια, από μνήμη. ΠΟΤΕ `git checkout`: το δέντρο
    // είναι κοινό με άλλον πράκτορα και ένα checkout θα έσβηνε ξένη δουλειά.
    afterEach(() => {
      if (originalRoute !== undefined) fs.writeFileSync(targetAbs, originalRoute, 'utf8');
      if (originalManifest !== undefined) {
        fs.writeFileSync(path.join(REPO, MANIFEST_REL), originalManifest, 'utf8');
      }
    });

    const runGate = (...args) => spawnSync(process.execPath, [CHECKER, ...args], {
      cwd: REPO, encoding: 'utf8',
    });

    /**
     * Αλλάζει ΕΝΑ χαρακτήρα μιας τιμής κρατώντας **ίδιο πλήθος bytes**, ώστε το
     * πείραγμα να μη μετακινήσει κανένα μέγεθος: το `checkRouteLedger` κρίνει
     * bytes έναντι προϋπολογισμού, και ένα πείραγμα που αλλάζει μέγεθος θα
     * κοκκίνιζε για **λάθος λόγο** — δηλαδή θα ήταν ψεύτικη άγκυρα.
     */
    function tamperSameLength(text) {
      const match = /: "([^"\\]{4,})"/.exec(text);
      expect(match).not.toBeNull();
      const value = match[1];
      const last = value.codePointAt(value.length - 1);
      const swapped = last >= 0x391 && last <= 0x3c8
        ? String.fromCodePoint(last + 1)                 // ελληνικό → ελληνικό (2 bytes → 2 bytes)
        : (value.slice(-1) === 'x' ? 'y' : 'x');         // ASCII → ASCII (1 byte → 1 byte)
      const mutated = `${value.slice(0, -1)}${swapped}`;

      expect(Buffer.byteLength(mutated, 'utf8')).toBe(Buffer.byteLength(value, 'utf8'));
      expect(mutated).not.toBe(value);
      return text.replace(`: "${value}"`, `: "${mutated}"`);
    }

    it('Χ3 ΠΑΡΟΝΟΜΑΣΤΗΣ: ΧΩΡΙΣ πείραγμα, ΚΑΙ ΤΑ ΔΥΟ Layers είναι πράσινα', () => {
      expect(runGate().status).toBe(0);          // Layer 1
      expect(runGate('--full').status).toBe(0);  // Layer 2 — ΗΤΑΝ ΑΔΥΝΑΤΟ ΩΣ ΤΙΣ 2026-08-28
    }, 300_000);

    /**
     * 🔴 ΑΥΤΗ Η ΑΓΚΥΡΑ ΑΝΤΙΣΤΡΑΦΗΚΕ ΣΤΙΣ 2026-08-30 (ADR-744 §20 / Β2β), ΚΑΙ Η
     * ΑΝΤΙΣΤΡΟΦΗ ΕΙΝΑΙ Η ΒΕΛΤΙΩΣΗ.
     *
     * Ως τότε έλεγε **«Layer 1 ΠΡΑΣΙΝΟ»** — και ήταν αλήθεια: το Layer 1 ρωτούσε
     * μόνο «ταιριάζει το sha256 που υπέγραψε το manifest;». Δηλαδή η άγκυρα
     * **κατέγραφε τυφλό σημείο ως προδιαγραφή**. Το τι κόστιζε μετρήθηκε ζωντανά:
     * με τα 20 νέα κλειδιά του ADR-832 μέσα στα locales και το route artifact
     * χωρίς κανένα, το pre-commit τύπωνε `✅ CHECK 3.34 OK` και θα άφηνε να περάσει
     * commit που βάφει ωμά κλειδιά σε δύο πεδία που ο νόμος απαιτεί.
     *
     * Τώρα το manifest κουβαλά τα `wants` **κάθε διαδρομής**, οπότε το Layer 1
     * ξανακλαδεύει τη διαδρομή από τα σημερινά locales — **χωρίς γράφο**, δηλαδή
     * χωρίς κόστος στο pre-commit. Το κενό που περιέγραφε αυτή η άγκυρα **έκλεισε**.
     */
    it('Χ4 🔴 ΜΕΤΑΛΛΑΞΗ: «συνεπές αλλά ΜΠΑΓΙΑΤΙΚΟ» ⇒ ΚΑΙ ΤΑ ΔΥΟ Layers ΚΟΚΚΙΝΑ και ΤΟ ΟΝΟΜΑΖΟΥΝ', () => {
      const tampered = tamperSameLength(originalRoute);
      fs.writeFileSync(targetAbs, tampered, 'utf8');

      // Το manifest ΞΑΝΑΫΠΟΓΡΑΦΕΙ το πειραγμένο artifact: αυτό είναι όλο το νόημα
      // — η ασυνέπεια εξαφανίζεται, μένει μόνο η ΜΠΑΓΙΑΤΙΚΟΤΗΤΑ ως προς την πηγή.
      const manifest = JSON.parse(originalManifest);
      manifest.artifacts[targetRel] = sha256(normalize(tampered));
      fs.writeFileSync(path.join(REPO, MANIFEST_REL), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      // Layer 1 ΤΟ ΒΛΕΠΕΙ ΠΛΕΟΝ: ξανακλαδεύει τη διαδρομή από τα locales και βρίσκει
      // τιμή που δεν συμφωνεί. (ΗΤΑΝ `.toBe(0)` — και αυτό ήταν το ελάττωμα.)
      const layerOne = runGate();
      expect(layerOne.status).toBe(1);
      expect(`${layerOne.stdout}${layerOne.stderr}`).toContain(targetRel);

      // Layer 2 ρωτά ΤΗΝ ΠΗΓΗ — και εξακολουθεί να το βλέπει, από άλλο μονοπάτι.
      // ΔΥΟ ανεξάρτητοι φρουροί: αν σπάσει ο ένας, ο άλλος μιλά ακόμη.
      const red = runGate('--full');
      expect(red.status).toBe(1);
      expect(`${red.stdout}${red.stderr}`).toContain(targetRel);
    }, 300_000);
  });
});
