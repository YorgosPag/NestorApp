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
const { withMutation: mutateRealFile } = require('./_mutate');

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
  /**
   * Μεταλλάσσει αρχείο, τρέχει, επαναφέρει.
   *
   * 🔑 **Ο κανόνας ζει στο `./_mutate` (2026-08-30)** — μαζί με άλλα έξι σημεία που έκαναν
   * το ίδιο με έξι διαφορετικά συμβόλαια. Εδώ κερδίζει δύο πράγματα που δεν είχε: εύρεση
   * **ανεξάρτητη από τα τέλη γραμμής**, και **φρουρό ασάφειας** (το `String.replace` χτυπούσε
   * σιωπηλά την 1η εμφάνιση, άρα μια μετάλλαξη μπορούσε να δοκιμάζει σημείο που κανείς
   * δεν διάλεξε).
   */
  function mutate(rel, from, to, surface) {
    return mutateRealFile(path.join(ROOT, rel), from, to, () => run(surface));
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
describe('Δ — οι αξιώσεις ΧΡΟΝΟΥ ΕΚΤΕΛΕΣΗΣ: `import()` και `import(\'x\').T` (ADR-954 §2)', () => {
  // 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (2026-11-28): ο `BuildingFloorplanService` πέρασε το `DxfFirestoreService` από
  // στατική εισαγωγή σε `await import()` (για να μη φέρνει 360 αρχεία σε κάθε σελίδα ακινήτων). Η πύλη
  // απάντησε «κανείς δεν ζητά πια το σύμβολο — σβήσε τη γραμμή»: ΨΕΜΑ, και η θεραπεία της θα άφηνε σε
  // χρήση σύμβολο που κανείς δεν φυλάει. Μετρημένα: 15 `import()` + 3 αναφορές τύπου ήταν αόρατα.
  const DEEP = '@/subapps/dxf-viewer/internal/deep';
  const DECLARED_SECRET = [
    ...DECLARED_ALPHA,
    { file: `${GUARDED_PREFIX}internal/deep.ts`, symbols: ['SECRET'], reason: 'ο καταναλωτής το φορτώνει στη χρήση' },
  ];

  /** Γράφει καταναλωτή, τρέχει, σβήνει — ο καταναλωτής ζει μόνο όσο το test. */
  function withConsumer(body, surface) {
    put('src/app/dyn.ts', body);
    try { return run(surface); } finally { fs.rmSync(path.join(ROOT, 'src/app/dyn.ts')); }
  }
  const claimsOf = (m) => m.findings.filter((f) => f.file === 'src/app/dyn.ts').map((f) => f.symbol).sort();

  it('Δ1 (ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ). Δηλωμένο σύμβολο σε χρήση ΜΟΝΟ με `await import()` ⇒ ΔΕΝ είναι ορφανό', () => {
    const m = withConsumer(`export async function f() {\n  const { SECRET } = await import('${DEEP}');\n  return SECRET;\n}\n`,
      DECLARED_SECRET);
    expect(m.tally[STATES.ORPHAN]).toBe(0);
    expect(m.blocking).toHaveLength(0);
    expect(m.usedIds).toContain(idOf(`${GUARDED_PREFIX}internal/deep.ts`, 'SECRET'));
  });

  it('Δ1′ (ΠΑΡΟΝΟΜΑΣΤΗΣ του Δ1). ΧΩΡΙΣ τον καταναλωτή, η ίδια δήλωση ΕΙΝΑΙ ορφανή — το Δ1 δεν περνά από τύχη', () => {
    const m = run(DECLARED_SECRET);
    expect(m.blocking.map((f) => `${f.state}:${f.symbol}`)).toEqual([`${STATES.ORPHAN}:SECRET`]);
  });

  it('Δ2. ΑΔΗΛΩΤΟ σύμβολο μέσω `await import()` ⇒ ⛔ ΜΠΛΟΚ, και η αναφορά λέει «dynamic»', () => {
    const m = withConsumer(`export async function f() {\n  const { SECRET } = await import('${DEEP}');\n  return SECRET;\n}\n`,
      DECLARED_ALPHA);
    expect(m.blocking).toHaveLength(1);
    expect(m.blocking[0]).toMatchObject({ state: STATES.UNDECLARED, symbol: 'SECRET', via: 'dynamic' });
    expect(m.blocking[0].detail).toMatch(/\(dynamic\)/);
  });

  it('Δ3. Αναφορά τύπου `import(\'x\').T` είναι αξίωση — όπως το `import type { T }`', () => {
    const m = withConsumer("export type A = import('@/subapps/dxf-viewer/types/pub').Beta;\n", DECLARED_ALPHA);
    expect(m.blocking).toHaveLength(1);
    expect(m.blocking[0]).toMatchObject({ state: STATES.UNDECLARED, symbol: 'Beta', via: 'type-query' });
  });

  // Ο πίνακας των σχημάτων — ίδια σημασία με το tree-shaking του `import()` στους bundlers.
  it.each([
    ['`.then((m) => m.X)`', `export const p = import('${DEEP}').then((m) => m.SECRET);\n`, ['SECRET']],
    ['`.then(({ X }) => …)`', `export const p = import('${DEEP}').then(({ SECRET }) => SECRET);\n`, ['SECRET']],
    ['`(await import(x)).X`', `export async function f() { return (await import('${DEEP}')).SECRET; }\n`, ['SECRET']],
    ['`const m = await import(x); m.X`', `export async function f() {\n  const m = await import('${DEEP}');\n  return m.SECRET;\n}\n`, ['SECRET']],
    ['ολόκληρο το module διαφεύγει (lazy loader)', `export const load = () => import('${DEEP}');\n`, ['*']],
    ['το όνομα του module διαφεύγει (`use(m)`)', `declare function use(x: unknown): void;\nexport async function f() {\n  const m = await import('${DEEP}');\n  use(m);\n}\n`, ['*']],
    ['`...rest` στο destructuring', `export async function f() {\n  const { ...all } = await import('${DEEP}');\n  return all;\n}\n`, ['*']],
    ['`.then(() => …)` — φορτώνει, δεν διαβάζει', `export const p = import('${DEEP}').then(() => 1);\n`, []],
  ])('Δ4. %s', (_label, body, expected) => {
    expect(claimsOf(withConsumer(body, DECLARED_ALPHA))).toEqual(expected);
  });

  it('Δ5. Μη κυριολεκτικό specifier ΠΡΟΣ ΤΟ SUBAPP ⇒ 🔶 μετριέται ΜΕ ΟΝΟΜΑ (fail-closed, όπως το Μ6)', () => {
    const m = withConsumer("export const f = (n: string) => import(`@/subapps/dxf-viewer/internal/${n}`);\n", DECLARED_ALPHA);
    expect(m.tally[STATES.UNRESOLVABLE]).toBe(1);
    expect(m.blocking).toHaveLength(0);
  });

  it('Δ6 (ΠΑΡΟΝΟΜΑΣΤΗΣ). `import()` ΕΚΤΟΣ υποσυστήματος ⇒ καμία αξίωση — αλλιώς η πύλη θα ούρλιαζε παντού', () => {
    put('src/app/other.ts', 'export const Z = 1;\n');
    try {
      const m = withConsumer("export const p = import('./other').then((m) => m.Z);\n", DECLARED_ALPHA);
      expect(m.findings).toHaveLength(0);
    } finally { fs.rmSync(path.join(ROOT, 'src/app/other.ts')); }
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
