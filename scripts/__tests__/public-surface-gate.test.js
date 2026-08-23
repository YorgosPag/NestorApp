/**
 * ADR-796 (CHECK 3.62) — άγκυρες της ΠΥΛΗΣ ΔΗΜΟΣΙΑΣ ΕΠΙΦΑΝΕΙΑΣ.
 *
 * ⚠️ **ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΓΙΝΟΝΤΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ, ΟΧΙ ΣΤΗΝ ΠΥΛΗ** (πρότυπο CHECK 3.44/3.47):
 * μίνι-repo από **πραγματικά σχήματα** αρχείων, μία γραμμή αλλαγή, και ο μεταλλάκτης
 * **ΟΥΡΛΙΑΖΕΙ** αν η μετάλλαξη δεν άλλαξε τίποτα — «RED» πάνω σε ήδη σπασμένο fixture
 * αποδεικνύει σπασμένο fixture, όχι ζωντανό φρουρό.
 *
 * @jest-environment node
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { scanPublicSurface, indexManifest, idOf, assertClosedLedger, STATES, BLOCKING, GUARDED_PREFIX } =
  require('../lib/public-surface/scan');

// ─── Μίνι-repo: ΠΡΑΓΜΑΤΙΚΟ δέντρο στον δίσκο, όχι προσομοίωση ────────────────
let ROOT;

/** Γράφει αρχείο δημιουργώντας τους φακέλους. */
function put(rel, body) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, 'utf8');
}

beforeAll(() => {
  ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'pubsurface-'));
  // Το `readTsPathAliases` διαβάζει `tsconfig.base.json` — χωρίς αυτό ΚΑΝΕΝΑ `@/…` δεν
  // λύνεται και η πύλη θα ήταν μονίμως πράσινη (το τυφλό σημείο που φυλά το Κ7).
  put('tsconfig.base.json', JSON.stringify({
    compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } },
  }));
  put(`${GUARDED_PREFIX}types/pub.ts`, 'export interface Alpha { a: number }\nexport interface Beta { b: number }\n');
  put(`${GUARDED_PREFIX}internal/deep.ts`, 'export const SECRET = 1;\n');
  put(`${GUARDED_PREFIX}internal/sibling.ts`, "import { SECRET } from './deep';\nexport const X = SECRET;\n");
  put('src/app/consumer.ts', "import type { Alpha } from '@/subapps/dxf-viewer/types/pub';\nexport const a: Alpha = { a: 1 };\n");
});

afterAll(() => { try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch { /* καθαρισμός */ } });

const run = (surface) => scanPublicSurface({ projectRoot: ROOT, manifest: { surface } });

const DECLARED_ALPHA = [{
  file: `${GUARDED_PREFIX}types/pub.ts`,
  symbols: ['Alpha'],
  reason: 'ο καταναλωτής της εφαρμογής το χρειάζεται',
}];

// ═════════════════════════════════════════════════════════════════════════════
describe('Μ0 — ο παρονομαστής: το μίνι-repo ΟΝΤΩΣ λειτουργεί', () => {
  it('Μ0α. Με σωστή δήλωση, η πύλη είναι ΠΡΑΣΙΝΗ', () => {
    const m = run(DECLARED_ALPHA);
    expect(m.blocking).toHaveLength(0);
    expect(m.tally[STATES.DECLARED]).toBe(1);
  });

  it('Μ0β. Η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ — κάθε εισαγωγή σε ονομασμένο κάδο', () => {
    const m = run(DECLARED_ALPHA);
    const sum = Object.values(m.tally).reduce((a, b) => a + b, 0);
    expect(sum).toBe(m.inspected + m.tally[STATES.ORPHAN] + m.tally[STATES.REASONLESS]);
  });

  it('Μ0γ. Οι ΕΣΩΤΕΡΙΚΕΣ εισαγωγές ΔΕΝ κρίνονται — αλλιώς κάθε αρχείο του subapp θα ήταν παραβίαση', () => {
    // Το `internal/sibling.ts` εισάγει το `internal/deep.ts`. Αν αυτό μετρούσε, η πύλη θα
    // ήταν άχρηστη: θα ζητούσε δήλωση για ΚΑΘΕ εσωτερική εξάρτηση.
    const m = run(DECLARED_ALPHA);
    expect(m.findings.some((f) => f.file.startsWith(GUARDED_PREFIX))).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Κ — οι τρεις ΑΝΕΞΑΡΤΗΤΟΙ κανόνες (ποτέ ένας με «ή»)', () => {
  it('Κ1. Αδήλωτο σύμβολο ⇒ ⛔ undeclared-import', () => {
    const m = run([]); // κενό μανιφέστο
    expect(m.tally[STATES.UNDECLARED]).toBe(1);
    expect(m.blocking[0].state).toBe(STATES.UNDECLARED);
    expect(m.blocking[0].id).toBe(idOf(`${GUARDED_PREFIX}types/pub.ts`, 'Alpha'));
  });

  it('Κ2. Δηλωμένο που κανείς δεν ζητά ⇒ ⛔ orphan-declaration (το μανιφέστο δεν σαπίζει)', () => {
    const m = run([
      ...DECLARED_ALPHA,
      { file: `${GUARDED_PREFIX}types/pub.ts`, symbols: ['Beta'], reason: 'κανείς δεν το ζητά' },
    ]);
    expect(m.tally[STATES.ORPHAN]).toBe(1);
    expect(m.blocking.map((f) => f.symbol)).toContain('Beta');
  });

  it('Κ3. Δήλωση χωρίς λόγο ⇒ ⛔ reasonless-declaration', () => {
    const m = run([{ file: `${GUARDED_PREFIX}types/pub.ts`, symbols: ['Alpha'], reason: '   ' }]);
    expect(m.tally[STATES.REASONLESS]).toBe(1);
  });

  it('Κ4. ΤΡΕΙΣ ΞΕΧΩΡΙΣΤΕΣ καταστάσεις — ένας κανόνας με «ή» θα έκρυβε δύο θεραπείες', () => {
    // Καθεμία έχει ΑΛΛΗ διόρθωση: δήλωσε / σβήσε / γράψε γιατί. Ένα σκέτο «κάτι χάλασε»
    // θα ανάγκαζε τον επόμενο να μαντέψει ποια από τις τρεις.
    expect(new Set(BLOCKING).size).toBe(3);
    expect(BLOCKING).toEqual(expect.arrayContaining([STATES.UNDECLARED, STATES.ORPHAN, STATES.REASONLESS]));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Μ — μεταλλάξεις ΣΤΙΣ ΕΙΣΟΔΟΥΣ (ο μεταλλάκτης ουρλιάζει αν δεν άλλαξε τίποτα)', () => {
  /** Μεταλλάσσει αρχείο, τρέχει, επαναφέρει — και απαιτεί ότι το κείμενο ΟΝΤΩΣ άλλαξε. */
  function mutate(rel, from, to, surface) {
    const abs = path.join(ROOT, rel);
    const before = fs.readFileSync(abs, 'utf8');
    const after = before.replace(from, to);
    if (after === before) throw new Error(`Η ΜΕΤΑΛΛΑΞΗ ΔΕΝ ΑΛΛΑΞΕ ΤΙΠΟΤΑ σε ${rel}`);
    fs.writeFileSync(abs, after, 'utf8');
    try { return run(surface); } finally { fs.writeFileSync(abs, before, 'utf8'); }
  }

  it('Μ1. ΝΕΑ διαρροή σε δηλωμένο αρχείο, ΑΔΗΛΩΤΟ σύμβολο ⇒ ΜΠΛΟΚ', () => {
    const m = mutate('src/app/consumer.ts',
      "import type { Alpha } from '@/subapps/dxf-viewer/types/pub';",
      "import type { Alpha, Beta } from '@/subapps/dxf-viewer/types/pub';",
      DECLARED_ALPHA);
    expect(m.tally[STATES.UNDECLARED]).toBe(1);
    expect(m.blocking.map((f) => f.symbol)).toEqual(['Beta']);
  });

  it('Μ2. ΝΕΟΣ καταναλωτής ΒΑΘΙΑΣ διαδρομής ⇒ ΜΠΛΟΚ (αυτό ακριβώς φυλά ο κανόνας)', () => {
    put('src/app/leak.ts', "import { SECRET } from '@/subapps/dxf-viewer/internal/deep';\nexport const s = SECRET;\n");
    try {
      const m = run(DECLARED_ALPHA);
      expect(m.tally[STATES.UNDECLARED]).toBe(1);
      expect(m.blocking[0].target).toBe(`${GUARDED_PREFIX}internal/deep.ts`);
    } finally { fs.rmSync(path.join(ROOT, 'src/app/leak.ts')); }
  });

  it('Μ3. `import * as X` ζητά ΤΑ ΠΑΝΤΑ — `*` αδήλωτο ΚΑΙ το `Alpha` γίνεται ορφανό', () => {
    const m = mutate('src/app/consumer.ts',
      "import type { Alpha } from '@/subapps/dxf-viewer/types/pub';",
      "import * as Pub from '@/subapps/dxf-viewer/types/pub';",
      DECLARED_ALPHA);
    // 🔑 ΔΥΟ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ ΠΥΡΟΔΟΤΟΥΝ ΜΑΖΙ, και αυτό είναι η απόδειξη ότι δεν
    // είναι «ένας κανόνας με ή»: το `*` είναι ΝΕΑ αξίωση (undeclared), ενώ το `Alpha`
    // έπαψε να ζητιέται (orphan). Ένας ενιαίος κανόνας θα ανέφερε ΕΝΑ γεγονός και θα
    // έκρυβε ότι η επιφάνεια ταυτόχρονα **μεγάλωσε** και **έπαψε να λέει την αλήθεια**.
    expect(m.tally[STATES.UNDECLARED]).toBe(1);
    expect(m.tally[STATES.ORPHAN]).toBe(1);
    expect(m.blocking.map((f) => f.symbol).sort()).toEqual(['*', 'Alpha']);
  });

  it('Μ4. Το ΣΒΗΣΙΜΟ της εισαγωγής κάνει τη δήλωση ΟΡΦΑΝΗ — η συρρίκνωση είναι ορατή', () => {
    const m = mutate('src/app/consumer.ts',
      "import type { Alpha } from '@/subapps/dxf-viewer/types/pub';\n", '',
      DECLARED_ALPHA);
    expect(m.tally[STATES.ORPHAN]).toBe(1);
  });

  it('Μ5. CSS side-effect ⇒ ΡΗΤΗ κατάσταση, ΟΧΙ «ανεπίλυτο» ούτε σιωπηλό skip', () => {
    put('src/app/styled.ts', "import '@/subapps/dxf-viewer/ui/theme.css';\nexport const z = 1;\n");
    try {
      const m = run(DECLARED_ALPHA);
      expect(m.tally[STATES.STYLESHEET]).toBe(1);
      expect(m.tally[STATES.UNRESOLVABLE]).toBe(0);
      expect(m.blocking).toHaveLength(0);
    } finally { fs.rmSync(path.join(ROOT, 'src/app/styled.ts')); }
  });

  it('Μ6. Ανεπίλυτο specifier ΠΡΟΣ ΤΟ SUBAPP μετριέται ΜΕ ΟΝΟΜΑ (fail-closed)', () => {
    put('src/app/ghost.ts', "import { Nope } from '@/subapps/dxf-viewer/does/not/exist';\nexport const n = Nope;\n");
    try {
      const m = run(DECLARED_ALPHA);
      expect(m.tally[STATES.UNRESOLVABLE]).toBe(1);
      // ⚠️ Δεν είναι μπλοκάρον: μπορεί να είναι υπό συγγραφή. Αλλά ΔΕΝ εξαφανίζεται —
      // ένα σιωπηλό `return` εδώ θα ήταν το σχήμα «0 = κανείς δεν κοίταξε».
      expect(m.blocking).toHaveLength(0);
    } finally { fs.rmSync(path.join(ROOT, 'src/app/ghost.ts')); }
  });

  it('Μ7. Η ταυτότητα είναι `αρχείο#σύμβολο` — ΠΟΤΕ με γραμμή', () => {
    // Με γραμμή, η μετακίνηση μιας εισαγωγής θα φαινόταν add+remove και η πύλη θα
    // μπλόκαρε καθαρή αναδιάταξη (το σφάλμα που το Κ2 του CHECK 3.53 υπάρχει να αποτρέψει).
    const m = mutate('src/app/consumer.ts',
      "import type { Alpha } from '@/subapps/dxf-viewer/types/pub';\nexport const a: Alpha = { a: 1 };\n",
      "export const marker = 1;\nimport type { Alpha } from '@/subapps/dxf-viewer/types/pub';\nexport const a: Alpha = { a: 1 };\n",
      DECLARED_ALPHA);
    expect(m.blocking).toHaveLength(0);
    expect(m.declarations).toEqual([idOf(`${GUARDED_PREFIX}types/pub.ts`, 'Alpha')]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Λ — η λογιστική είναι fail-closed', () => {
  // 🔴 Η ΠΡΩΤΗ ΓΡΑΦΗ ΑΥΤΩΝ ΤΩΝ ΑΓΚΥΡΩΝ ΕΛΕΓΧΕ **ΚΕΙΜΕΝΟ** (`expect(src).toMatch(/ΑΝΟΙΧΤΗ
  // ΛΟΓΙΣΤΙΚΗ/)`) και η μετάλλαξη `throw` → `void` **ΔΙΕΦΥΓΕ** (7/8). Είναι το σφάλμα `Μ6`
  // του CHECK 3.8: μια άγκυρα που ρωτά «αναφέρει τη λέξη;» δεν φυλάει τη συμπεριφορά.
  // Πλέον **ΕΚΤΕΛΟΥΝ** τον φρουρό με τεχνητά δεδομένα.
  it('Λ1α. Άθροισμα που ΔΕΝ κλείνει ⇒ throw ΜΕ ΟΝΟΜΑ', () => {
    expect(() => assertClosedLedger({
      tally: { [STATES.DECLARED]: 1 }, inspected: 99, findings: [],
    })).toThrow(/ΑΝΟΙΧΤΗ ΛΟΓΙΣΤΙΚΗ/);
  });

  it('Λ1β. Άγνωστη κατάσταση ⇒ throw ΜΕ ΟΝΟΜΑ — δεύτερος, ΑΝΕΞΑΡΤΗΤΟΣ έλεγχος', () => {
    // Το άθροισμα εδώ ΚΛΕΙΝΕΙ· μόνο η κατάσταση είναι άγνωστη. Ένας ενιαίος έλεγχος
    // «κάτι δεν πάει καλά» θα άφηνε τη μία από τις δύο βλάβες να περάσει.
    expect(() => assertClosedLedger({
      tally: { [STATES.DECLARED]: 1, [STATES.ORPHAN]: 0, [STATES.REASONLESS]: 0 },
      inspected: 1,
      findings: [{ state: 'κάτι-που-δεν-υπάρχει' }],
    })).toThrow(/ΑΓΝΩΣΤΗ ΚΑΤΑΣΤΑΣΗ/);
  });

  it('Λ1γ (ΠΑΡΟΝΟΜΑΣΤΗΣ). Σωστή λογιστική ⇒ ΔΕΝ ρίχνει', () => {
    expect(assertClosedLedger({
      tally: { [STATES.DECLARED]: 2, [STATES.ORPHAN]: 1, [STATES.REASONLESS]: 0 },
      inspected: 2,
      findings: [{ state: STATES.ORPHAN }],
    })).toBe(true);
  });

  it('Λ2. Το μανιφέστο ευρετηριάζεται ΑΝΑ ΣΥΜΒΟΛΟ, όχι ανά αρχείο', () => {
    const { byId } = indexManifest({
      surface: [{ file: 'f.ts', symbols: ['A', 'B'], reason: 'r' }],
    });
    expect([...byId.keys()]).toEqual(['f.ts#A', 'f.ts#B']);
  });
});
