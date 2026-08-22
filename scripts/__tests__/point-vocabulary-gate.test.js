/**
 * @jest-environment node
 *
 * CHECK 3.59 — άγκυρες της πύλης ενικού λεξιλογίου σημείου (ADR-792).
 *
 * ⚠️ **ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ, ΟΧΙ ΣΤΗΝ ΠΥΛΗ.** Ένα ψεύτικο δέντρο
 * αρχείων περνιέται με ένεση (`opts.files` / `opts.readFile`), οπότε κάθε άγκυρα
 * εκτελεί τη **ΠΡΑΓΜΑΤΙΚΗ** μηχανή πάνω σε ελεγχόμενη είσοδο.
 *
 * ⚠️ **Η ΒΑΘΜΟΝΟΜΗΣΗ (Π) ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ**: τρέχει την πύλη πάνω στον **πραγματικό
 * κώδικα** ενός **ΚΑΡΦΩΜΕΝΟΥ** commit — ποτέ `HEAD`, γιατί το `HEAD` μετακινείται και
 * η άγκυρα θα αυτοακυρωνόταν σιωπηλά (μάθημα CHECK 3.41/3.50). Το `Π2` αποδεικνύει τον
 * **ΠΑΡΟΝΟΜΑΣΤΗ**: χωρίς αυτό, το «κόκκινο στο χθες» θα μπορούσε να είναι κόκκινο για
 * λόγο άσχετο με το ελάττωμα.
 */

'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const gate = require('../check-point-vocabulary');
const {
  declaresType, loadRegistry, vocabularyOf, scanDeclarations, classify, tally,
  measure, buildPayload, ledgerLine, triggers, STATES,
} = gate;

/** Commit ΠΡΙΝ το ADR-792 — ΚΑΡΦΩΜΕΝΟ. Το `gitShow` σκάει σε κενή απάντηση. */
const BEFORE_ADR792 = 'dbd89df8';

function gitShow(commit, relPath) {
  const out = execFileSync('git', ['show', `${commit}:${relPath}`], {
    cwd: path.join(__dirname, '..', '..'),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (!out || out.trim().length === 0) {
    throw new Error(`gitShow κενό για ${commit}:${relPath} — η άγκυρα θα ήταν ψεύτικη`);
  }
  return out;
}

/** Ψεύτικο δέντρο: `{ 'src/a.ts': '…' }` → μορφή που δέχεται το `scanDeclarations`. */
function tree(files, root = '/repo') {
  return {
    root,
    files: Object.keys(files).map((f) => `${root}/${f}`),
    readFile: (abs) => {
      const key = abs.slice(root.length + 1);
      if (!(key in files)) throw new Error(`δεν υπάρχει: ${abs}`);
      return files[key];
    },
  };
}

const REG = {
  owners: [
    { file: 'src/vocab.ts', names: ['Point2D', 'Point3D'], reason: 'η κανονική ρίζα του δοκιμαστικού δέντρου' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Μ0 — η πύλη είναι ΠΡΑΣΙΝΗ στο πραγματικό δέντρο (πριν ΚΑΙ μετά κάθε μετάλλαξη)
// ─────────────────────────────────────────────────────────────────────────────
describe('Μ0 — κατάσταση του πραγματικού δέντρου', () => {
  test('Μ0.1 — το μητρώο φορτώνει και δηλώνει ρίζες', () => {
    const r = loadRegistry();
    expect(r.owners.length).toBeGreaterThan(0);
    expect(vocabularyOf(r).size).toBeGreaterThan(0);
  });

  test('Μ0.2 — μηδέν zero-tolerance παραβιάσεις σήμερα', () => {
    const m = measure();
    expect(m.blocking).toEqual([]);
    expect(m.ledger['undeclared-owner']).toBe(0);
    expect(m.ledger['orphan-declaration']).toBe(0);
  });

  test('Μ0.3 — `Point3D` έχει ΑΚΡΙΒΩΣ μία ρίζα (αυτό ήταν όλο το ADR-792)', () => {
    const m = measure();
    const owners = m.declarations.filter((d) => d.endsWith('#Point3D'));
    expect(owners).toEqual(['src/subapps/dxf-viewer/rendering/types/Types.ts#Point3D']);
  });

  test('Μ0.4 — η λογιστική κλείνει και τυπώνεται ΚΑΙ ΣΤΟ ΜΗΔΕΝ', () => {
    const m = measure();
    const line = ledgerLine(m);
    // ένα «0» που δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος»
    expect(line).toContain('⛔ 0 αδήλωτες');
    expect(line).toContain('⛔ 0 ορφανές');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Π — ΒΑΘΜΟΝΟΜΗΣΗ σε πραγματικό ιστορικό κώδικα (καρφωμένο commit)
// ─────────────────────────────────────────────────────────────────────────────
describe('Π — βαθμονόμηση στον πραγματικό κώδικα πριν το ADR-792', () => {
  const BIM_BASE = 'src/subapps/dxf-viewer/bim/types/bim-base.ts';
  const registry = loadRegistry();

  test('Π1 — το ΧΘΕΣΙΝΟ bim-base.ts κρίνεται ⛔ `undeclared-owner` για το `Point3D`', () => {
    const before = gitShow(BEFORE_ADR792, BIM_BASE);
    const t = tree({ [BIM_BASE]: before });
    const found = scanDeclarations(registry, t);
    const { entries } = classify(found, registry);
    const bad = entries.filter((e) => e.state === 'undeclared-owner' && e.name === 'Point3D');
    expect(bad).toHaveLength(1);
    expect(bad[0].file).toBe(BIM_BASE);
  });

  test('Π2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: το ΣΗΜΕΡΙΝΟ bim-base.ts είναι καθαρό στο ίδιο κριτήριο', () => {
    const fs = require('node:fs');
    const now = fs.readFileSync(path.join(__dirname, '..', '..', BIM_BASE), 'utf8');
    const t = tree({ [BIM_BASE]: now });
    const found = scanDeclarations(registry, t);
    const { entries } = classify(found, registry);
    expect(entries.filter((e) => e.state === 'undeclared-owner')).toEqual([]);
    expect(found.map((f) => f.name).sort()).toEqual(
      ['BimBounds', 'BimPoint', 'BimPolygon', 'BimPolyline', 'PlanProfile', 'PlanarPoint'],
    );
  });

  test('Π3 — το ΧΘΕΣΙΝΟ SnapOverrideOrchestrator κρύβει τοπικό `Point2D`', () => {
    const p = 'src/subapps/dxf-viewer/snapping/overrides/SnapOverrideOrchestrator.ts';
    const before = gitShow(BEFORE_ADR792, p);
    expect(declaresType(before, 'Point2D')).toBe(true);
    const fs = require('node:fs');
    const now = fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
    expect(declaresType(now, 'Point2D')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Κ — το κριτήριο ανίχνευσης
// ─────────────────────────────────────────────────────────────────────────────
describe('Κ — τι μετράει ως δήλωση τύπου', () => {
  test.each([
    ['export interface Point2D {', true],
    ['interface Point2D {', true],
    ['export type Point2D = { x: number };', true],
    ['type Point2D = import("./x").Point2D;', true],
    ['export class Point2D {', true],
    ['declare class Point2D {', true],
    ['export interface Point3D extends Point2D {', true],
    ['export type Point2D<T> = T;', true],
  ])('Κ1 — «%s» ⇒ δήλωση: %s', (line, want) => {
    expect(declaresType(`\n${line}\n`, 'Point2D') || declaresType(`\n${line}\n`, 'Point3D')).toBe(want);
  });

  test('Κ2 — στοιχείο πολυγραμμικού import ΔΕΝ είναι δήλωση (μετρημένα 2 ψευδώς θετικά)', () => {
    const code = 'import {\n  type OverlayGeometry,\n  type Point2D,\n} from "./x";\n';
    expect(declaresType(code, 'Point2D')).toBe(false);
  });

  test('Κ3 — στοιχείο πολυγραμμικού export ΔΕΝ είναι δήλωση', () => {
    const code = 'export {\n  resolveAttachmentPoint,\n  type Point2D,\n} from "./y";\n';
    expect(declaresType(code, 'Point2D')).toBe(false);
  });

  test('Κ4 — `const Point2D = …` ΔΕΝ είναι λεξιλόγιο τύπων', () => {
    expect(declaresType('\nexport const Point2D = 1;\n', 'Point2D')).toBe(false);
  });

  test('Κ5 — πρόθεμα δεν αρκεί: `Point2DLike` δεν είναι `Point2D`', () => {
    expect(declaresType('\nexport interface Point2DLike {\n', 'Point2D')).toBe(false);
  });

  /**
   * ⚠️ Η ΠΡΩΤΗ ΓΡΑΦΗ ΑΥΤΗΣ ΤΗΣ ΑΓΚΥΡΑΣ ΒΓΗΚΕ ΠΡΑΣΙΝΗ ΣΤΗ ΜΕΤΑΛΛΑΞΗ. Χρησιμοποιούσε το
   * **ίδιο το αρχείο της πύλης** ως fixture — που αναφέρει τα ονόματα σε πρόζα
   * («`Point3D` 216 vs 49»), ΠΟΤΕ σε **μορφή δήλωσης**. Άρα το `stripComments` δεν
   * ασκούνταν καθόλου: σβήνοντάς το, η άγκυρα έμενε πράσινη. Το fixture πρέπει να
   * περιέχει **δήλωση μέσα σε σχόλιο** — αλλιώς ο φρουρός δεν έχει απόδειξη ζωής.
   */
  test('Κ6 — δήλωση ΜΕΣΑ ΣΕ ΣΧΟΛΙΟ δεν μετράει (το `stripComments` ασκείται όντως)', () => {
    // ⚠️ Η γραμμή πρέπει να ξεκινά ΧΩΡΙΣ πρόθεμα `*`, αλλιώς δεν μοιάζει καν με δήλωση
    //    και η άγκυρα δεν ασκεί τίποτα (πρώτη γραφή: απέτυχε ούτως ή άλλως, και η
    //    μετάλλαξη Μμ6 έδειχνε «RED» για λάθος λόγο).
    const code = [
      '/*',
      'Παράδειγμα της βλάβης που τεκμηριώνει αυτό το αρχείο:',
      'export interface Point2D { x: number; y: number }',
      '*/',
      '// type Point3D = { x: number; y: number; z: number };',
      'export const ok = 1;',
      '',
    ].join('\n');
    expect(declaresType(code, 'Point2D')).toBe(true);        // ωμό κείμενο: μοιάζει με δήλωση…
    expect(scanDeclarations(REG, tree({ 'src/doc.ts': code }))).toEqual([]); // …αλλά είναι σχόλιο
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Μ — ΜΕΤΑΛΛΑΞΕΙΣ ΣΤΙΣ ΕΙΣΟΔΟΥΣ: κάθε μία πρέπει να ΚΟΚΚΙΝΙΣΕΙ
// ─────────────────────────────────────────────────────────────────────────────
describe('Μ — μεταλλάξεις στις εισόδους', () => {
  const CLEAN = {
    'src/vocab.ts': 'export interface Point2D { x: number; y: number }\nexport interface Point3D extends Point2D { z: number }\n',
  };

  test('Μ0-base — το καθαρό δέντρο δεν έχει καμία παραβίαση', () => {
    const m = measure({ registry: REG, ...tree(CLEAN) });
    expect(m.blocking).toEqual([]);
    expect(m.violationIds).toEqual([]);
  });

  test('Μ1 — δεύτερος ορισμός `Point2D` αλλού ⇒ ⛔ undeclared-owner', () => {
    const m = measure({
      registry: REG,
      ...tree({ ...CLEAN, 'src/other.ts': 'type Point2D = { x: number; y: number };\n' }),
    });
    expect(m.blocking).toHaveLength(1);
    expect(m.blocking[0]).toMatchObject({ state: 'undeclared-owner', file: 'src/other.ts', name: 'Point2D' });
  });

  test('Μ2 — η ρίζα σταματά να ορίζει δηλωμένο όνομα ⇒ ⛔ orphan-declaration', () => {
    const m = measure({
      registry: REG,
      ...tree({ 'src/vocab.ts': 'export interface Point2D { x: number; y: number }\n' }),
    });
    expect(m.blocking).toHaveLength(1);
    expect(m.blocking[0]).toMatchObject({ state: 'orphan-declaration', name: 'Point3D' });
  });

  test('Μ3 — ΜΕΤΟΝΟΜΑΣΙΑ στη ρίζα πιάνεται ΚΑΙ ΩΣ ΟΡΦΑΝΗ (όχι μόνο ως αδήλωτη)', () => {
    const m = measure({
      registry: REG,
      ...tree({ 'src/vocab.ts': 'export interface Point2D { x: number; y: number }\nexport interface Vec3 { z: number }\n' }),
    });
    // το `Point3D` έφυγε ⇒ ορφανή δήλωση· το `Vec3` δεν είναι στο λεξιλόγιο ⇒ σιωπή
    expect(m.blocking.map((b) => b.state)).toEqual(['orphan-declaration']);
  });

  test('Μ4 — ΤΕΤΑΡΤΗ ρίζα δηλωμένη στο μητρώο ⇒ αλλάζει το ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ (μπλοκάρει το ratchet)', () => {
    const reg2 = { owners: [...REG.owners, { file: 'src/extra.ts', names: ['Point2D'], reason: 'δεύτερη ρίζα για την άγκυρα Μ4' }] };
    const m = measure({
      registry: reg2,
      ...tree({ ...CLEAN, 'src/extra.ts': 'export interface Point2D { x: number; y: number }\n' }),
    });
    expect(m.blocking).toEqual([]);                       // δηλωμένη ⇒ όχι zero-tol
    expect(m.declarations).toContain('src/extra.ts#Point2D'); // …αλλά ΝΕΑ δήλωση ⇒ το ratchet θα μπλοκάρει
    expect(m.violationIds).toEqual([                       // …και γίνεται κοινό όνομα
      'Point2D@src/extra.ts', 'Point2D@src/vocab.ts',
    ]);
  });

  test('Μ5 — ΤΑΥΤΟΤΗΤΑ Κ3: αφαίρεση ρίζας ΔΕΝ γεννά νέα ταυτότητα (δεν μπλοκάρει τη θεραπεία)', () => {
    const reg2 = { owners: [...REG.owners, { file: 'src/extra.ts', names: ['Point2D'], reason: 'δεύτερη ρίζα για την άγκυρα Μ5' }] };
    const withBoth = measure({
      registry: reg2,
      ...tree({ ...CLEAN, 'src/extra.ts': 'export interface Point2D { x: number; y: number }\n' }),
    });
    const cured = measure({ registry: REG, ...tree(CLEAN) });
    // κάθε ταυτότητα της θεραπευμένης κατάστασης υπήρχε ήδη ⇒ καθαρή αφαίρεση ⇒ ratchet PASS
    for (const id of cured.violationIds) expect(withBoth.violationIds).toContain(id);
    expect(cured.violationIds.length).toBeLessThan(withBoth.violationIds.length);
  });

  test('Μ6 — μητρώο χωρίς λόγο ⇒ ΑΡΝΗΣΗ (ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ)', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const p = path.join(os.tmpdir(), `pv-noreason-${process.pid}.json`);
    fs.writeFileSync(p, JSON.stringify({ owners: [{ file: 'src/vocab.ts', names: ['Point2D'], reason: 'μικρό' }] }));
    expect(() => loadRegistry(p)).toThrow(/ΟΥΣΙΑΣΤΙΚΟ λόγο/);
    fs.unlinkSync(p);
  });

  test('Μ7 — άδειο μητρώο ⇒ ΑΡΝΗΣΗ (fail-closed· ποτέ «καθαρό» με κενή εμβέλεια)', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const p = path.join(os.tmpdir(), `pv-empty-${process.pid}.json`);
    fs.writeFileSync(p, JSON.stringify({ owners: [] }));
    expect(() => loadRegistry(p)).toThrow(/καμία ρίζα/);
    fs.unlinkSync(p);
  });

  test('Μ8 — άγνωστη κατάσταση ⇒ `throw` ΜΕ ΟΝΟΜΑ (η λογιστική δεν χάνεται σιωπηλά)', () => {
    expect(() => tally([{ state: 'φαντασμα' }])).toThrow(/άγνωστη κατάσταση: φαντασμα/);
  });

  test('Μ9 — `buildPayload` ΑΡΝΕΙΤΑΙ να κλειδώσει zero-tolerance παραβίαση', () => {
    const m = measure({
      registry: REG,
      ...tree({ ...CLEAN, 'src/other.ts': 'type Point2D = { x: number };\n' }),
    });
    expect(m.blocking.length).toBeGreaterThan(0);
    expect(() => buildPayload(m)).toThrow(/ΑΡΝΗΣΗ baseline/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Σ — η σκανδάλη (Layer 1)
// ─────────────────────────────────────────────────────────────────────────────
describe('Σ — σκανδάλη', () => {
  const registry = loadRegistry();

  test('Σ1 — άσχετο σταδιοποιημένο αρχείο ΔΕΝ πυροδοτεί', () => {
    expect(triggers(['README.md', 'package.json'], registry)).toBe(false);
  });

  test('Σ2 — το ίδιο το μητρώο πυροδοτεί', () => {
    expect(triggers(['.point-vocabulary.json'], registry)).toBe(true);
  });

  test('Σ3 — η ίδια η πύλη πυροδοτεί (αλλιώς αλλαγή κριτηρίου περνά χωρίς να ασκηθεί)', () => {
    expect(triggers(['scripts/check-point-vocabulary.js'], registry)).toBe(true);
  });

  /**
   * ⚠️ Η ΠΡΩΤΗ ΓΡΑΦΗ ΑΥΤΗΣ ΤΗΣ ΑΓΚΥΡΑΣ ΒΓΗΚΕ ΠΡΑΣΙΝΗ ΣΤΗ ΜΕΤΑΛΛΑΞΗ. Περνούσε το
   * `bim-base.ts`, που **δηλώνει** ονόματα του λεξιλογίου — άρα πυροδοτούσε από τον
   * ΤΡΙΤΟ κλάδο (`declaresType`) και ο κλάδος «είναι δηλωμένη ρίζα;» δεν ασκούνταν
   * ποτέ. Ο κλάδος υπάρχει ακριβώς για την **ΑΝΤΙΣΤΡΟΦΗ** περίπτωση: ρίζα που
   * **έπαψε** να δηλώνει (μετονομασία) — τότε μόνο αυτός πιάνει την ορφανή δήλωση.
   */
  test('Σ4 — δηλωμένη ΡΙΖΑ πυροδοτεί ΑΚΟΜΑ ΚΙ ΟΤΑΝ δεν δηλώνει πια τίποτα', () => {
    const renamedAway = 'src/subapps/dxf-viewer/bim/transforms/bim-mirror-geometry.ts';
    // το αρχείο υπάρχει και ΔΕΝ δηλώνει κανένα όνομα του λεξιλογίου…
    expect(triggers([renamedAway], registry)).toBe(false);
    // …αλλά αν το μητρώο το δηλώνει ρίζα, η σκανδάλη ΠΡΕΠΕΙ να πυροδοτήσει
    const asOwner = { owners: [{ file: renamedAway, names: ['Point2D'], reason: 'ρίζα που μετονομάστηκε — άγκυρα Σ4' }] };
    expect(triggers([renamedAway], asOwner)).toBe(true);
  });

  test('Σ4β — και το πραγματικό `bim-base.ts` πυροδοτεί (ρίζα ΚΑΙ δηλώνων)', () => {
    expect(triggers(['src/subapps/dxf-viewer/bim/types/bim-base.ts'], registry)).toBe(true);
  });

  test('Σ5 — αρχείο που ΔΗΛΩΝΕΙ όνομα του λεξιλογίου πυροδοτεί', () => {
    expect(triggers(['src/subapps/dxf-viewer/rendering/types/Types.ts'], registry)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Λ — συμβόλαιο λογιστικής
// ─────────────────────────────────────────────────────────────────────────────
describe('Λ — κλειστή λογιστική', () => {
  test('Λ1 — κάθε καταχώριση μπαίνει σε ονομασμένο κάδο, και το άθροισμα κλείνει', () => {
    const m = measure();
    const sum = STATES.reduce((a, s) => a + m.ledger[s], 0);
    expect(sum).toBe(m.entries.length);
  });

  test('Λ2 — κάθε δηλωμένο όνομα εμφανίζεται στο `declarations`', () => {
    const r = loadRegistry();
    const m = measure();
    const expected = r.owners.flatMap((o) => o.names.map((n) => `${o.file}#${n}`)).sort();
    expect(m.declarations).toEqual(expected);
  });
});
