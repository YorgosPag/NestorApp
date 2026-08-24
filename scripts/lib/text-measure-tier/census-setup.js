/**
 * CHECK 3.64 — Ο ΣΥΛΛΕΚΤΗΣ ΤΗΣ ΑΠΟΓΡΑΦΗΣ ΒΑΘΜΙΔΑΣ (ADR-799 Φάση 2)
 *
 * Τρέχει ως `setupFilesAfterEnv` **μόνο** στην εκτέλεση της απογραφής. Ανοίγει το sink του
 * `text-advance.ts` και γράφει, ανά **αρχείο test**, τι βαθμίδα απάντησε όντως.
 *
 * ⚠️ **ΦΟΡΤΩΝΕΙ ΠΡΩΤΑ ΤΟ ΚΑΝΟΝΙΚΟ `jest.setup.js`.** Το `--setupFilesAfterEnv` του CLI
 * **αντικαθιστά** τη ρύθμιση του config — δεν την επεκτείνει. Χωρίς αυτή τη γραμμή, η
 * απογραφή θα έτρεχε σε **άλλο περιβάλλον** από την κανονική σουίτα, δηλαδή θα μετρούσε
 * κάτι που κανείς δεν εκτελεί: ακριβώς το σχήμα ADR-749 που η ίδια η πύλη κυνηγά.
 *
 * ⚠️ **ΕΝΑ ΑΡΧΕΙΟ ΑΝΑ WORKER.** Ο jest τρέχει παράλληλα· κοινό αρχείο με `appendFileSync`
 * μπορεί να μπλέξει γραμμές σε Windows και η απογραφή θα έχανε **σιωπηλά** παρατηρήσεις.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = path.join(REPO_ROOT, '.text-measure-census');

require(path.join(REPO_ROOT, 'jest.setup.js'));

/**
 * 🔴 **ΤΕΜΠΕΛΙΚΟ `require`, ΚΑΙ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ** (διόρθωση 2026-08-25, ADR-799 Φάση 3).
 *
 * Σε εμβέλεια module, αυτό το `require` φόρτωνε **μεταβατικά ολόκληρο τον glyph pipeline**
 * (`text-advance` → `font-resolver` → `glyph-path-cache` → `glyph-renderer`) **πριν** προλάβει
 * να ισχύσει το `jest.mock` του αρχείου test — οπότε μια σουίτα που mockάρει τον renderer
 * έτρεχε τον **πραγματικό**. Μετρημένο: **3** σουίτες κοκκίνιζαν **μόνο μέσα στην απογραφή**,
 * και ο εκτελεστής **αγνοεί επίτηδες** τις κόκκινες σουίτες ⇒ **κανείς δεν το είδε**.
 *
 * ⚠️ Ήταν ακριβώς αυτό που η κεφαλίδα από πάνω υπόσχεται ότι **δεν** θα συμβεί: «*θα μετρούσε
 * κάτι που κανείς δεν εκτελεί*». Μέσα στο `beforeAll` το αρχείο test έχει ήδη αποτιμηθεί, άρα
 * τα mocks του **προηγούνται** — και το στιγμιότυπο του module είναι το **ίδιο** που βλέπει
 * ο κώδικας υπό δοκιμή (κοινό registry ανά αρχείο), οπότε το sink μπαίνει στο σωστό.
 */
function loadAdvance() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const advance = require(path.join(
    REPO_ROOT,
    'src/subapps/dxf-viewer/text-engine/fonts/text-advance.ts',
  ));
  if (typeof advance.__installAdvanceCensus !== 'function') {
    throw new Error(
      'CHECK 3.64 — το `__installAdvanceCensus` λείπει από το text-advance.ts. Η απογραφή δεν έχει όργανο.',
    );
  }
  return advance;
}

/** Παρατηρήσεις του **τρέχοντος** αρχείου test. */
let tiers = null;

beforeAll(() => {
  tiers = { glyph: 0, css: 0, nominal: 0 };
  tiers.droppedAxes = new Set();
  loadAdvance().__installAdvanceCensus((entry) => {
    tiers[entry.tier] = (tiers[entry.tier] || 0) + 1;
    for (const axis of entry.dropped) tiers.droppedAxes.add(axis);
  });
});

afterAll(() => {
  loadAdvance().__installAdvanceCensus(null);
  const total = tiers.glyph + tiers.css + tiers.nominal;
  if (total === 0) return; // δεν άγγιξε τον μετρητή — δεν είναι μέλος του πληθυσμού

  const testPath = expect.getState().testPath || '<άγνωστο>';
  const row = {
    file: path.relative(REPO_ROOT, testPath).split(path.sep).join('/'),
    glyph: tiers.glyph,
    css: tiers.css,
    nominal: tiers.nominal,
    dropped: [...tiers.droppedAxes].sort(),
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.appendFileSync(path.join(OUT_DIR, `w${process.pid}.ndjson`), `${JSON.stringify(row)}\n`, 'utf8');
});
