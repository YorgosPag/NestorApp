/**
 * SSoT ανάγνωσης + αναφοράς της εξόδου του `tsc` — ADR-663 / ADR-757 ΦΑΣΗ Β #2.
 *
 * Καλύπτει `scripts/lib/tsc-diagnostics.js` και `scripts/lib/tsc-report.js`.
 *
 * ⚠️ ΚΑΝΕΝΑ test δεν ξοδεύει μεταγλωττιστή. Αυτό **δεν** είναι συμβιβασμός με
 * τον N.17 — είναι ο λόγος που ο σχεδιασμός χωρίστηκε σε «τρέξε» / «διάβασε» /
 * «πες»: η ανάγνωση και η αφήγηση είναι **καθαρές συναρτήσεις πάνω σε κείμενο**,
 * άρα κάθε κλάδος τους αποδεικνύεται με σταθερό fixture, χωρίς ποτέ να τρέξει
 * `tsc` ούτε τοπικά ούτε στο CI. Ό,τι απαιτεί μεταγλωττιστή (η ίδια η μέτρηση)
 * μένει ρητά στο CI.
 *
 * Ομάδες: **Κ** άγκυρες συμβολαίου · **Μ** μεταλλάξεις εισόδου · **Π** δεύτερη φωνή.
 */

'use strict';

const {
  LINE_CLASS,
  classifyLine,
  parseDiagnostics,
  countByFile,
  censusByCode,
  concentration,
} = require('../lib/tsc-diagnostics');

const {
  buildReport,
  renderMarkdown,
  renderConsoleCensus,
  regressionDiagnostics,
} = require('../lib/tsc-report');

const { describeEnvironment, environmentDrift } = require('../lib/tsc-runner');

/**
 * Έξοδος σε πραγματικό σχήμα: θόρυβος εργαλείου, διαγνωστικά με συνέχειες
 * (related info), warning, καθολικό διαγνωστικό, γραμμή σύνοψης.
 */
const REAL_SHAPED = [
  'npm info using npm@10.8.2',
  "src/subapps/dxf-viewer/utils/rotation-math.ts(79,13): error TS2339: Property 'corner1' does not exist on type 'Partial<EllipseEntity>'.",
  "  Property 'corner1' does not exist on type 'EllipseEntity'.",
  "src/subapps/dxf-viewer/utils/rotation-math.ts(80,13): error TS2339: Property 'corner2' does not exist on type 'Partial<EllipseEntity>'.",
  "src/subapps/dxf-viewer/bim/__tests__/wall.test.ts(12,3): error TS2322: Type 'X' is not assignable to type 'Y'.",
  'src/subapps/dxf-viewer/a.ts(3,1): warning TS6133: unused variable',
  'Found 3 errors in 2 files.',
].join('\n');

const normalize = (f) => f.replace(/\\/g, '/');

// ═══ Κ — ΑΓΚΥΡΕΣ ΣΥΜΒΟΛΑΙΟΥ ══════════════════════════════════════════════════

describe('Κ — το συμβόλαιο της ανάγνωσης', () => {
  it('Κ1 — ΤΑΥΤΟΤΗΤΑ ΜΕΤΡΗΣΗΣ: ίδιο πλήθος ανά αρχείο με το ΙΣΤΟΡΙΚΟ regex', () => {
    // Η δεύτερη φωνή είναι το regex που έγραψε τη σημερινή baseline (ADR-663,
    // 15/07). Αν η μετακόμιση σε SSoT άλλαξε έστω και έναν αριθμό, η baseline
    // θα σύγκρινε δύο διαφορετικές μηχανές — το ακριβές ελάττωμα του ADR-749.
    const HISTORICAL = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):/;
    const historicalByFile = {};
    for (const line of REAL_SHAPED.split('\n')) {
      const m = HISTORICAL.exec(line);
      if (!m) continue;
      const f = normalize(m[1]);
      historicalByFile[f] = (historicalByFile[f] || 0) + 1;
    }

    const { errors } = parseDiagnostics(REAL_SHAPED);
    expect(countByFile(errors, normalize)).toEqual(historicalByFile);
    expect(errors).toHaveLength(3);
  });

  it('Κ2 — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ: κάθε γραμμή σε ακριβώς έναν ονομασμένο κάδο', () => {
    const r = parseDiagnostics(REAL_SHAPED);
    const sum = Object.values(r.ledger).reduce((a, b) => a + b, 0);
    expect(sum).toBe(r.totalLines);
    expect(r.balanced).toBe(true);
    // Ονομαστικά, ώστε μια αλλαγή ταξινόμησης να μη «κλείνει» σιωπηλά αλλού.
    expect(r.ledger).toMatchObject({
      [LINE_CLASS.DIAGNOSTIC]: 3,
      [LINE_CLASS.NON_ERROR]: 1,
      [LINE_CLASS.CONTINUATION]: 1,
      [LINE_CLASS.SUMMARY]: 1,
      [LINE_CLASS.UNRECOGNISED]: 1, // ο θόρυβος του npm — ΟΝΟΜΑΖΕΤΑΙ, δεν εξαφανίζεται
    });
  });

  it('Κ3 — το warning ΔΕΝ είναι σφάλμα, αλλά ούτε αόρατο', () => {
    const r = parseDiagnostics(REAL_SHAPED);
    expect(r.errors.every((d) => d.category === 'error')).toBe(true);
    expect(r.nonErrors).toHaveLength(1);
    expect(r.nonErrors[0].code).toBe('TS6133');
  });

  it('Κ4 — καθολικό διαγνωστικό (χωρίς αρχείο) παίρνει ΟΝΟΜΑ, δεν διαβάζεται ως «0 σφάλματα»', () => {
    // Σπασμένο tsconfig: κανένα αρχείο να χρεωθεί ⇒ αδύνατο σε per-file ratchet.
    // Αν δεν είχε κάδο, ένα σπασμένο project θα διαβαζόταν ως καθαρό δέντρο.
    const r = parseDiagnostics('error TS18003: No inputs were found in config file.');
    expect(r.errors).toHaveLength(0);
    expect(r.global).toHaveLength(1);
    expect(r.global[0]).toMatchObject({ code: 'TS18003', file: null });
    expect(r.ledger[LINE_CLASS.GLOBAL]).toBe(1);
  });

  it('Κ5 — η συνέχεια μετράει ΜΟΝΟ μετά από διαγνωστικό', () => {
    // Χωρίς αυτόν τον όρο, κάθε γραμμή με εσοχή πριν το πρώτο σφάλμα (banner
    // εργαλείου, στοίχιση pnpm) θα γινόταν σιωπηλά «συνέχεια» και θα έφευγε από
    // τον κάδο `unrecognised` — δηλαδή η λογιστική θα έκλεινε ψευδώς.
    expect(classifyLine('   κάποιο banner', false).klass).toBe(LINE_CLASS.UNRECOGNISED);
    expect(classifyLine('   κάποιο banner', true).klass).toBe(LINE_CLASS.CONTINUATION);
  });

  it('Κ6 — τα κλειδιά ανά αρχείο βγαίνουν ταξινομημένα (σταθερό diff baseline)', () => {
    const { errors } = parseDiagnostics(
      ['src/z.ts(1,1): error TS1: a', 'src/a.ts(1,1): error TS1: b', 'src/m.ts(1,1): error TS1: c'].join('\n'),
    );
    expect(Object.keys(countByFile(errors, normalize))).toEqual(['src/a.ts', 'src/m.ts', 'src/z.ts']);
  });

  it('Κ7 — η απογραφή κρατά κωδικό, πλήθος, αρχεία και ΔΕΙΓΜΑ', () => {
    const { errors } = parseDiagnostics(REAL_SHAPED);
    const census = censusByCode(errors);
    expect(census[0]).toMatchObject({ code: 'TS2339', count: 2, files: 1 });
    expect(census[0].sampleMessage).toMatch(/corner1/);
    expect(census[0].sampleSite).toMatch(/rotation-math\.ts:79:13/);
  });

  it('Κ8 — ο διακριτής επιστρέφει ΑΡΙΘΜΟΥΣ, ποτέ ετυμηγορία', () => {
    const { errors } = parseDiagnostics(REAL_SHAPED);
    const c = concentration(errors);
    expect(c).toMatchObject({ total: 3, distinctCodes: 2, topCode: 'TS2339', topCount: 2 });
    expect(c.topShare).toBeCloseTo(2 / 3, 4);
    // Καμία λέξη «Υ1»/«Υ2»/«αιτία» — η ετυμηγορία ανήκει στον άνθρωπο.
    expect(Object.keys(c)).not.toContain('hypothesis');
  });

  it('Κ17 — ΚΑΜΙΑ γραμμή δεν βγάζει κατάσταση εκτός του κλειστού συνόλου', () => {
    // Ο φρουρός της λογιστικής είναι δομικά απυροβόλητος μέσω κανονικής εισόδου
    // (κάθε γραμμή παίρνει εξ ορισμού έναν κάδο). Η ΜΟΝΗ ρεαλιστική διαδρομή
    // προς τα εκεί είναι μελλοντικός κάδος με τυπογραφικό — γι' αυτό η άγκυρα
    // ελέγχει τον ταξινομητή, όχι το άθροισμα. Ένας φρουρός χωρίς απόδειξη ζωής
    // είναι σχόλιο (ADR-749 §5).
    const known = new Set(Object.values(LINE_CLASS));
    const adversarial = [
      '', '   ', '\t', 'Found 12 errors in 4 files.', 'error TS5083: Cannot read file',
      'warning TS6133: unused', 'src/a.ts(1,1): error TS1: x', 'src/a.ts(1,1): warning TS2: y',
      'src/a.ts:1:1 - error TS3: z', '   indented noise', '</>|{}[]()', 'src/a(b).ts(2,2): error TS4: w',
    ];
    for (const line of adversarial) {
      for (const seen of [false, true]) {
        expect(known.has(classifyLine(line, seen).klass)).toBe(true);
      }
    }
    expect(() => parseDiagnostics(adversarial.join('\n'))).not.toThrow();
  });

  it('Κ9 — κενή είσοδος δεν σκάει και δεν εφευρίσκει', () => {
    const r = parseDiagnostics('');
    expect(r.errors).toHaveLength(0);
    expect(r.balanced).toBe(true);
    expect(concentration(r.errors)).toMatchObject({ total: 0, topCode: null, topShare: 0 });
  });
});

// ═══ Κ (αναφορά) ═════════════════════════════════════════════════════════════

const BASELINE = { generatedAt: '2026-07-15T21:34:35.711Z', totalErrors: 381, byFile: { 'src/old.ts': 2 } };

function reportFor(text, regressions) {
  const analysis = parseDiagnostics(text);
  const byFile = countByFile(analysis.errors, normalize);
  return buildReport({
    check: 'CHECK 3.29',
    adr: 'ADR-663',
    project: 'src/subapps/dxf-viewer/tsconfig.json',
    heapMb: 12288,
    elapsedSeconds: 41.2,
    verdict: regressions.length ? 'fail' : 'pass',
    measurement: { measured: true, outcome: 'ran', detail: null },
    baseline: BASELINE,
    current: { totalErrors: analysis.errors.length, sourceErrors: 2, testErrors: 1, byFile },
    regressions,
    cleaned: [],
    analysis,
    normalize,
  });
}

const RISING = [
  { file: 'src/subapps/dxf-viewer/utils/rotation-math.ts', baseline: 0, current: 2, delta: 2, isNew: true },
];

describe('Κ — το συμβόλαιο της αναφοράς', () => {
  it('Κ10 — «δεν μέτρησα» γράφεται ως null, ΠΟΤΕ ως άδεια λίστα', () => {
    // Ένα `[]` διαβάζεται από άνθρωπο ΚΑΙ από script ως «κοίταξα και δεν βρήκα».
    // Αυτή η γραμμή είναι όλη η διαφορά ανάμεσα σε UNKNOWN και σε ψευδώς πράσινο.
    const r = buildReport({
      check: 'CHECK 3.29', adr: 'ADR-663', project: 'p', heapMb: 12288, verdict: 'unknown',
      measurement: { measured: false, outcome: 'out-of-memory', detail: 'V8 exhausted the JS heap' },
      baseline: BASELINE,
    });
    expect(r.census).toBeNull();
    expect(r.regressions).toBeNull();
    expect(r.totals).toBeNull();
    expect(r.census).not.toEqual([]);
    expect(r.measurement.measured).toBe(false);
  });

  it('Κ11 — το markdown του UNKNOWN λέει ρητά ότι ΔΕΝ είναι παλινδρόμηση', () => {
    const md = renderMarkdown(buildReport({
      check: 'CHECK 3.29', adr: 'ADR-663', project: 'p', heapMb: 12288, verdict: 'unknown',
      measurement: { measured: false, outcome: 'out-of-memory', detail: 'heap' },
      baseline: BASELINE,
    }));
    expect(md).toMatch(/UNKNOWN/);
    expect(md).toMatch(/δεν\*{0,2} είναι παλινδρόμηση/);
    expect(md).not.toMatch(/❌/);
  });

  it('Κ12 — η αναφορά χτίζεται ΚΑΙ στο πράσινο (βαθμονόμηση της επόμενης κόκκινης)', () => {
    const r = reportFor(REAL_SHAPED, []);
    expect(r.verdict).toBe('pass');
    expect(r.census.all.length).toBeGreaterThan(0);
    expect(r.totals.totalErrors).toBe(3);
    expect(r.ledger.balanced).toBe(true);
  });

  it('Κ13 — τα διαγνωστικά ΚΟΛΛΑΝΕ στο αρχείο που ανέβηκε (κωδικός + γραμμή + μήνυμα)', () => {
    const r = reportFor(REAL_SHAPED, RISING);
    expect(r.regressions[0].diagnostics).toEqual([
      { line: 79, column: 13, code: 'TS2339', message: expect.stringContaining('corner1') },
      { line: 80, column: 13, code: 'TS2339', message: expect.stringContaining('corner2') },
    ]);
    // Η απογραφή των ΝΕΩΝ αγνοεί το αρχείο test που δεν ανέβηκε.
    expect(r.census.regressions.map((e) => e.code)).toEqual(['TS2339']);
    expect(r.census.all.map((e) => e.code).sort()).toEqual(['TS2322', 'TS2339']);
  });

  it('Κ14 — ΚΑΘΕ περικοπή ονομάζει τη συνέχειά της', () => {
    // Το «… and 171 more» χωρίς προορισμό ήταν αδιέξοδο, όχι μορφοποίηση.
    const many = Array.from({ length: 60 }, (_, i) => ({
      file: `src/f${i}.ts`, baseline: 0, current: 1, delta: 1, isNew: true,
    }));
    const md = renderMarkdown(reportFor(REAL_SHAPED, many));
    expect(md).toMatch(/artifact `dxf-tsc-report`/);

    const console_ = renderConsoleCensus(reportFor(REAL_SHAPED, RISING), { reportPath: '/tmp/r.json' });
    expect(console_.join('\n')).toMatch(/\/tmp\/r\.json/);
  });

  it('Κ15 — αταξινόμητη γραμμή ΜΕ κωδικό TS φωνάζει ΚΑΙ απαγορεύει το reseed', () => {
    // Η υπογραφή «άλλαξε η μορφή του tsc»: ο μετρητής πέφτει και η πτώση
    // διαβάζεται ως πρόοδος. Είναι η ΜΟΝΗ περίπτωση που δικαιολογεί συναγερμό.
    const md = renderMarkdown(reportFor(
      `${REAL_SHAPED}\nsrc/x.ts:9:9 - error TS2551: Did you mean 'foo'?`,
      RISING,
    ));
    expect(md).toMatch(/φέρουν κωδικό TS/);
    expect(md).toMatch(/ΜΗΝ\*{0,2} κάνεις reseed/);
  });

  it('Κ15β — σκέτος θόρυβος εργαλείου ΔΕΝ ανάβει συναγερμό', () => {
    // Ένα ⚠️ πάνω στο σκέτο πλήθος θα άναβε σε ΚΑΘΕ εκτέλεση (ο `npx` τυπώνει
    // πάντα μια γραμμή) και θα μάθαινε τον αναγνώστη να το προσπερνά — το alert
    // fatigue του ADR-757, μέσα στο όργανο που φτιάχτηκε για να το θεραπεύσει.
    const r = reportFor(REAL_SHAPED, RISING);
    expect(r.ledger.lines.unrecognised).toBe(1); // το `npm info …`
    expect(r.ledger.unrecognisedSuspicious).toBe(0);
    const md = renderMarkdown(r);
    expect(md).not.toMatch(/🔴 \*\*\d+\*\* αταξινόμητες/);
    expect(md).toMatch(/θόρυβος εργαλείων/); // μετριέται· απλώς δεν ουρλιάζει
    expect(renderConsoleCensus(r, {}).join('\n')).not.toMatch(/ΜΗΝ κάνεις reseed/);
  });

  it('Κ16 — καμία κατάσταση δεν διαρρέει από τον διακριτή προς την ετυμηγορία', () => {
    const md = renderMarkdown(reportFor(REAL_SHAPED, RISING));
    expect(md).toMatch(/Συγκέντρωση/);
    expect(md).toMatch(/μέτρηση, όχι ετυμηγορία/);
  });
});

// ═══ Κ (περιβάλλον) ══════════════════════════════════════════════════════════

describe('Κ — το περιβάλλον της μέτρησης', () => {
  it('Κ18 — καταγράφει κριτή, λειτουργικό και εκτελεστή', () => {
    const e = describeEnvironment({ CI: '1' });
    expect(e.typescript).toMatch(/^\d+\.\d+/);
    expect(e.platform).toBe(process.platform);
    expect(e.ci).toBe(true);
  });

  it('Κ19 — baseline ΧΩΡΙΣ περιβάλλον ⇒ ΑΓΝΩΣΤΟ, ποτέ «ίδιο»', () => {
    // Η σημερινή `.dxf-tsc-baseline.json` (15/07) δεν έχει πεδίο environment.
    // Αν το `null` επέστρεφε `comparable: true`, η πύλη θα βεβαίωνε ότι ο κριτής
    // δεν άλλαξε — βεβαίωση για κάτι που δεν ξέρει.
    const r = environmentDrift(null);
    expect(r.comparable).toBeNull();
    expect(r.comparable).not.toBe(true);
    expect(r.drift).toEqual([]);
  });

  it('Κ20 — αλλαγή έκδοσης TS ή λειτουργικού ΟΝΟΜΑΖΕΤΑΙ', () => {
    const base = { typescript: '5.8.2', platform: 'win32', node: 'v20.0.0' };
    const now = { typescript: '5.9.3', platform: 'linux', node: 'v20.0.0' };
    const r = environmentDrift(base, now);
    expect(r.comparable).toBe(false);
    expect(r.drift.map((d) => d.key).sort()).toEqual(['platform', 'typescript']);
  });

  it('Κ21 — το markdown λέει ρητά ότι μέρος της διαφοράς μπορεί να ΜΗΝ είναι κώδικας', () => {
    const md = renderMarkdown(buildReport({
      check: 'CHECK 3.29', adr: 'ADR-663', project: 'p', heapMb: 12288, verdict: 'unknown',
      measurement: { measured: false, outcome: 'killed', detail: 'x' },
      baseline: BASELINE,
      environment: describeEnvironment(),
      environmentDrift: environmentDrift(null),
    }));
    expect(md).toMatch(/δεν κατέγραψε περιβάλλον/);
    expect(md).toMatch(/αλλαγή \*{0,2}κριτή\*{0,2}/);
  });
});

// ═══ Μ — ΜΕΤΑΛΛΑΞΕΙΣ ΤΗΣ ΕΙΣΟΔΟΥ ═════════════════════════════════════════════

describe('Μ — μεταλλάξεις της εξόδου του tsc', () => {
  /** Ο φρουρός του ADR-744/3.44: μετάλλαξη που δεν άλλαξε τίποτα δεν αποδεικνύει τίποτα. */
  function mutate(from, to) {
    const mutated = REAL_SHAPED.replace(from, to);
    if (mutated === REAL_SHAPED) throw new Error(`Η μετάλλαξη δεν άλλαξε τίποτα: ${from}`);
    return mutated;
  }

  it('Μ1 — αλλαγή κωδικού ⇒ αλλάζει η απογραφή', () => {
    const r = parseDiagnostics(mutate('TS2322', 'TS7006'));
    expect(censusByCode(r.errors).map((e) => e.code).sort()).toEqual(['TS2339', 'TS7006']);
  });

  it('Μ2 — σβήσιμο διαγνωστικού ⇒ πέφτει το πλήθος του αρχείου', () => {
    const r = parseDiagnostics(mutate(/^src\/subapps\/dxf-viewer\/utils\/rotation-math\.ts\(80.*$/m, ''));
    expect(countByFile(r.errors, normalize)['src/subapps/dxf-viewer/utils/rotation-math.ts']).toBe(1);
  });

  it('Μ3 — «error» → «warning» ⇒ βγαίνει από τον μετρητή, ΜΕΝΕΙ ορατό', () => {
    const r = parseDiagnostics(mutate('error TS2322', 'warning TS2322'));
    expect(r.errors).toHaveLength(2);
    expect(r.nonErrors).toHaveLength(2);
  });

  it('Μ4 — αλλαγή μορφής του tsc ⇒ ΑΥΞΑΝΕΙ το unrecognised, δεν σιωπά', () => {
    // Η υποθετική μελλοντική μορφή `file:79:13 - error TS2339`. Ο μετρητής
    // πέφτει — και ο ΜΟΝΟΣ λόγος που αυτό δεν διαβάζεται ως «διορθώθηκαν
    // σφάλματα» είναι ότι ο κάδος `unrecognised` φωνάζει.
    const r = parseDiagnostics(mutate(
      "src/subapps/dxf-viewer/utils/rotation-math.ts(79,13): error TS2339: Property 'corner1' does not exist on type 'Partial<EllipseEntity>'.",
      "src/subapps/dxf-viewer/utils/rotation-math.ts:79:13 - error TS2339: Property 'corner1'",
    ));
    expect(r.errors).toHaveLength(2);
    // 3, όχι 2: μαζί με τη μεταλλαγμένη γραμμή αναδύεται και η **συνέχειά** της,
    // που έμεινε ορφανή. Αυτό είναι ο κανόνας του Κ5 να πληρώνει μερίσματα — μια
    // υλοποίηση που δεχόταν συνέχειες χωρίς προηγούμενο διαγνωστικό θα την
    // κατάπινε και θα ανέφερε ΜΙΚΡΟΤΕΡΗ ζημιά από την πραγματική.
    expect(r.ledger[LINE_CLASS.UNRECOGNISED]).toBe(3);
    expect(r.unrecognisedSamples.some((s) => s.includes('rotation-math.ts:79:13'))).toBe(true);
  });

  it('Μ5 — διαδρομή Windows ⇒ ίδιο κλειδί baseline', () => {
    const r = parseDiagnostics('src\\subapps\\dxf-viewer\\a.ts(1,1): error TS2345: x');
    expect(countByFile(r.errors, normalize)['src/subapps/dxf-viewer/a.ts']).toBe(1);
  });

  it('Μ6 — μήνυμα που περιέχει παρενθέσεις δεν κόβει τη διαδρομή', () => {
    const r = parseDiagnostics("src/a.ts(4,9): error TS2554: Expected 1 arguments, but got 2 (see foo(1,2)).");
    expect(r.errors[0]).toMatchObject({ file: 'src/a.ts', line: 4, column: 9, code: 'TS2554' });
    expect(r.errors[0].message).toMatch(/foo\(1,2\)/);
  });

  it('Μ7 — όλα τα διαγνωστικά ίδιου κωδικού ⇒ συγκέντρωση 100%', () => {
    const text = Array.from({ length: 9 }, (_, i) => `src/f${i}.ts(1,1): error TS2339: x`).join('\n');
    expect(concentration(parseDiagnostics(text).errors)).toMatchObject({
      total: 9, distinctCodes: 1, topShare: 1, topFiles: 9,
    });
  });

  it('Μ8 — εννιά διαφορετικοί κωδικοί ⇒ συγκέντρωση ~11%', () => {
    const text = Array.from({ length: 9 }, (_, i) => `src/f${i}.ts(1,1): error TS200${i}: x`).join('\n');
    const c = concentration(parseDiagnostics(text).errors);
    expect(c.distinctCodes).toBe(9);
    expect(c.topShare).toBeCloseTo(1 / 9, 3);
  });
});

// ═══ Π — ΔΕΥΤΕΡΗ ΦΩΝΗ ════════════════════════════════════════════════════════

describe('Π — δεύτερη φωνή', () => {
  it('Π1 — το άθροισμα ανά αρχείο ισούται με το πλήθος διαγνωστικών', () => {
    const { errors } = parseDiagnostics(REAL_SHAPED);
    const sum = Object.values(countByFile(errors, normalize)).reduce((a, b) => a + b, 0);
    expect(sum).toBe(errors.length);
  });

  it('Π2 — το άθροισμα της απογραφής ισούται με το πλήθος διαγνωστικών', () => {
    const { errors } = parseDiagnostics(REAL_SHAPED);
    expect(censusByCode(errors).reduce((a, e) => a + e.count, 0)).toBe(errors.length);
  });

  it('Π3 — τα διαγνωστικά ενός αρχείου που ανέβηκε είναι υποσύνολο των συνολικών', () => {
    const { errors } = parseDiagnostics(REAL_SHAPED);
    const rising = regressionDiagnostics(RISING, errors, normalize);
    expect(rising.length).toBeLessThan(errors.length);
    expect(rising.every((d) => errors.includes(d))).toBe(true);
  });
});
