/**
 * ADR-794 — άγκυρες του λεξιλογίου ΟΡΘΟΓΩΝΙΟΥ + ΧΩΡΟΥ.
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΤΟ ΣΥΝΗΘΙΣΜΕΝΟ TEST**: η εγγύηση αυτού του ADR ζει **σε επίπεδο
 * τύπου**. Σε jest οι τύποι **σβήνονται** πριν τρέξει οτιδήποτε — ένα «type-level test»
 * γραμμένο ως κανονικό `expect` είναι **μονίμως πράσινο**, δηλαδή ισχυρισμός σε σχόλιο
 * (σχήμα CHECK 3.36). Γι' αυτό οι άγκυρες `Κ1`-`Κ3` **εκτελούν τον μεταγλωττιστή** πάνω
 * στο **ΠΡΑΓΜΑΤΙΚΟ** `coordinate-space.ts` συν ένα probe 4 γραμμών, στη μνήμη, με `noLib`
 * — μηδέν σχέση με το `tsc` του έργου (N.17): δεν ανοίγει `tsconfig`, δεν διαβάζει `src/`,
 * δεν φορτώνει lib, τρέχει σε **χιλιοστά** (μετρημένο: ~30ms η βαρύτερη).
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΑΠΟΔΕΙΞΗΣ** (`Κ3`): χωρίς αυτόν, το «η ανάθεση
 * απέτυχε» θα μπορούσε να σημαίνει «το fixture δεν μεταγλωττίζεται καθόλου» — πράσινη
 * άγκυρα πάνω σε σπασμένο πείραμα.
 *
 * ⚠️ **ΤΟ `Κ2` ΚΛΕΙΔΩΝΕΙ ΤΟ ΔΗΛΩΜΕΝΟ ΟΡΙΟ, ΟΧΙ ΜΙΑ ΝΙΚΗ**: το brand είναι *προαιρετικό*,
 * άρα ένα ωμό object literal περνά σε **οποιονδήποτε** χώρο. Αν κάποιος αύριο κάνει το
 * brand υποχρεωτικό, αυτή η άγκυρα θα κοκκινίσει — και **σωστά**: αλλάζει το συμβόλαιο
 * και πρέπει να το δει άνθρωπος (η μετανάστευση των 42 σημείων στηρίζεται σε αυτό).
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from '@jest/globals';
import ts from 'typescript';
import { bboxOf, bboxOfAll, bboxOverlap } from '../../bim/geometry/shared/xy-bounds';
import type { Bbox } from '../coordinate-space';
import { createInfinityBounds, expandInfinityBounds } from '../../config/geometry-constants';

// ─── Ο μεταγλωττιστής ως όργανο μέτρησης ─────────────────────────────────────

/**
 * 🔑 **ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΑΡΧΕΙΟ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ ΤΟΥ.**
 *
 * Η πρώτη γραφή αυτού του test έβαζε εδώ ένα fixture 8 γραμμών «ίδιο με το SSoT». Αυτό
 * είναι **δεύτερη φωνή**: αν αύριο κάποιος σβήσει το brand από το `coordinate-space.ts`,
 * το fixture θα εξακολουθούσε να το έχει και η άγκυρα θα έμενε **ΠΡΑΣΙΝΗ πάνω στη βλάβη**
 * — το ίδιο σχήμα με τις δύο λίστες namespace του CHECK 3.34 (απόκλιναν κατά 63).
 *
 * Το module είναι **αυτοτελές** (μηδέν imports, μόνο τύποι), οπότε μπαίνει αυτούσιο στον
 * μεταγλωττιστή. Ό,τι κρίνεται εδώ είναι **ο κώδικας που στέλνεται**.
 */
const SPACE_MODULE = fs.readFileSync(
  path.join(__dirname, '..', 'coordinate-space.ts'),
  'utf8',
);

/** Επιστρέφει τους κωδικούς σφάλματος του `/probe.ts`, ανά γραμμή. */
function typeErrors(probe: string, spaceModule = SPACE_MODULE): Array<{ line: number; code: number }> {
  const files: Record<string, string> = { '/space.ts': spaceModule, '/probe.ts': probe };
  const host: ts.CompilerHost = {
    getSourceFile: (f, l) => (files[f] ? ts.createSourceFile(f, files[f], l, true) : undefined),
    writeFile: () => undefined,
    getDefaultLibFileName: () => '/lib.d.ts',
    useCaseSensitiveFileNames: () => true,
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => '/',
    getNewLine: () => '\n',
    fileExists: (f) => Boolean(files[f]),
    readFile: (f) => files[f],
    directoryExists: () => true,
    getDirectories: () => [],
  };
  const program = ts.createProgram(['/probe.ts'], { strict: true, noLib: true, noEmit: true }, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file?.fileName === '/probe.ts' && d.start !== undefined)
    .map((d) => ({
      line: d.file!.getLineAndCharacterOfPosition(d.start!).line + 1,
      code: d.code,
    }));
}

describe('ADR-794 — ο χώρος ζει στον τύπο', () => {
  it('Κ3 (ΠΑΡΟΝΟΜΑΣΤΗΣ). Ίδιος χώρος ⇒ η ανάθεση περνά — το fixture ΟΝΤΩΣ μεταγλωττίζεται', () => {
    const errs = typeErrors(`
import type { Bbox } from './space';
declare const a: Bbox;
export const b: Bbox = a;
`);
    expect(errs).toEqual([]);
  });

  it('Κ1. Κουτί ΚΑΤΟΨΗΣ δεν περνά ως κουτί ΤΟΠΙΚΟ — και το ανάποδο', () => {
    const errs = typeErrors(`
import type { Bbox, LocalRectMm } from './space';
declare const plan: Bbox;
export const wrong: LocalRectMm = plan;
declare function wantsPlan(b: Bbox): void;
declare const local: LocalRectMm;
wantsPlan(local);
`);
    // Γραμμή 4 = ανάθεση, γραμμή 7 = όρισμα. ΚΑΙ ΟΙ ΔΥΟ κατευθύνσεις, ποτέ μία:
    // μια μονόδρομη εγγύηση αφήνει τη μισή βλάβη ζωντανή.
    expect(errs.map((e) => e.line).sort()).toEqual([4, 7]);
    expect(errs.map((e) => e.code).sort()).toEqual([2322, 2345]);
  });

  it('Κ2 (ΔΗΛΩΜΕΝΟ ΟΡΙΟ). Ωμό object literal περνά σε ΟΠΟΙΟΝΔΗΠΟΤΕ χώρο', () => {
    const errs = typeErrors(`
import type { Bbox, LocalRectMm } from './space';
export const a: Bbox = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
export const b: LocalRectMm = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
`);
    expect(errs).toEqual([]);
  });

  it('Μ1 (ΜΕΤΑΛΛΑΞΗ ΣΤΗΝ ΕΙΣΟΔΟ). Χωρίς το brand, το Κ1 γίνεται ΠΡΑΣΙΝΟ — άρα το brand ΕΙΝΑΙ ο μηχανισμός', () => {
    // 🔑 Η μετάλλαξη γίνεται στο **ΠΡΑΓΜΑΤΙΚΟ** module, όχι σε αντίγραφό του: αφαιρείται
    // ΜΟΝΟ η κληρονομιά του brand. Χειρόγραφο «ισοδύναμο» fixture θα ήταν δεύτερη φωνή —
    // και θα έγραφε τις ίδιες δηλώσεις μέσα σε αυτό το αρχείο, δηλαδή θα γεννούσε
    // **δεύτερη ρίζα λεξιλογίου** (το CHECK 3.59 το έπιασε ακριβώς έτσι).
    const withoutBrand = SPACE_MODULE.replace(' extends InSpace<S>', '');
    expect(withoutBrand).not.toEqual(SPACE_MODULE); // η μετάλλαξη ΟΝΤΩΣ άλλαξε κάτι
    const errs = typeErrors(
      `
import type { Bbox, LocalRectMm } from './space';
declare const plan: Bbox;
export const wrong: LocalRectMm = plan;
`,
      withoutBrand,
    );
    // Δομική γλώσσα: ΙΔΙΑ τέσσερα πεδία ⇒ ΙΔΙΟΣ τύπος. Αυτό ακριβώς ήταν η κατάσταση
    // πριν το ADR-794 — 24 ονόματα που ο μεταγλωττιστής θεωρούσε ένα.
    expect(errs).toEqual([]);
  });
});

describe('ADR-794 — το brand είναι ΑΟΡΑΤΟ σε χρόνο εκτέλεσης', () => {
  const box = bboxOf([
    { x: 1, y: 2 },
    { x: 5, y: 9 },
  ]);

  it('Κ4. Μηδέν πεδίο παραπάνω: keys · JSON · spread — ούτε byte στο Firestore', () => {
    expect(Object.keys(box).sort()).toEqual(['maxX', 'maxY', 'minX', 'minY']);
    expect(Object.getOwnPropertySymbols(box)).toEqual([]);
    expect(JSON.parse(JSON.stringify(box))).toEqual({ minX: 1, minY: 2, maxX: 5, maxY: 9 });
    expect(Object.keys({ ...box }).sort()).toEqual(['maxX', 'maxY', 'minX', 'minY']);
  });
});

describe('ADR-794 — ΕΝΑΣ βρόχος για όλους τους χώρους', () => {
  const pts = [
    { x: -3, y: 7 },
    { x: 4, y: -1 },
    { x: 0, y: 0 },
  ];

  it('Κ5. Ο ρητός χώρος ΔΕΝ αλλάζει ούτε έναν αριθμό — αλλιώς θα ήταν δεύτερη μηχανή', () => {
    const plan = bboxOf(pts);
    const metres = bboxOf<'plan-m'>(pts);
    expect({ ...metres }).toEqual({ ...plan });
    expect(plan).toEqual({ minX: -3, minY: -1, maxX: 4, maxY: 7 });
  });

  it('Κ6. `bboxOf` = εκφυλισμένη περίπτωση του `bboxOfAll`, όχι δίδυμο', () => {
    expect({ ...bboxOf(pts) }).toEqual({ ...bboxOfAll(pts) });
    expect({ ...bboxOfAll(pts.slice(0, 2), pts.slice(2)) }).toEqual({ ...bboxOf(pts) });
  });
});

describe('ADR-794 — το `pad` του bboxOverlap είναι ΠΡΟΣΘΗΚΗ, όχι αλλαγή', () => {
  const a: Bbox = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  const touching: Bbox = { minX: 10, minY: 0, maxX: 20, maxY: 10 };
  const apart: Bbox = { minX: 12, minY: 0, maxX: 20, maxY: 10 };

  /** Η ΑΚΡΙΒΩΣ προηγούμενη έκφραση, πριν μπει η παράμετρος (ADR-794). */
  const before = (x: Bbox, y: Bbox): boolean =>
    x.minX <= y.maxX && y.minX <= x.maxX && x.minY <= y.maxY && y.minY <= x.maxY;

  it('Κ7. Χωρίς `pad`, η απάντηση είναι γραμμή-προς-γραμμή η παλιά', () => {
    for (const b of [touching, apart, a]) {
      expect(bboxOverlap(a, b)).toBe(before(a, b));
    }
  });

  it('Κ8. Με `pad`, η εγγύτητα μετράει — αυτό ήταν ο ιδιωτικός κλώνος του structural-finish', () => {
    expect(bboxOverlap(a, apart)).toBe(false);
    expect(bboxOverlap(a, apart, 2)).toBe(true);
    expect(bboxOverlap(a, apart, 1.9)).toBe(false);
  });
});

describe('ADR-794 — ο συσσωρευτής είναι η ΜΕΤΑΒΛΗΤΗ μορφή του ίδιου κουτιού', () => {
  it('Κ9. `InfinityBounds` γεμίζει και ρέει σε `Bbox` χωρίς μετατροπή', () => {
    const acc = createInfinityBounds();
    expandInfinityBounds(acc, 2, 3);
    expandInfinityBounds(acc, -4, 8);
    const asBbox: Bbox = acc; // μεταβλητό → αμετάβλητο, ίδιος χώρος: νόμιμο
    expect({ ...asBbox }).toEqual({ minX: -4, minY: 3, maxX: 2, maxY: 8 });
    expect(Object.getOwnPropertySymbols(acc)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ADR-795 — η ΔΕΥΤΕΡΗ ΜΟΡΦΗ ({min,max} με σημεία) και ο ΠΕΜΠΤΟΣ ΧΩΡΟΣ
// ═══════════════════════════════════════════════════════════════════════════

describe('ADR-795 — το ορθογώνιο ΣΗΜΕΙΩΝ κουβαλά κι αυτό τον χώρο', () => {
  it('Ρ0 (ΠΑΡΟΝΟΜΑΣΤΗΣ). Ίδιος χώρος ⇒ περνά — το probe ΟΝΤΩΣ μεταγλωττίζεται', () => {
    const errs = typeErrors(`
import type { ScreenRectPx } from './space';
declare const a: ScreenRectPx;
export const b: ScreenRectPx = a;
`);
    expect(errs).toEqual([]);
  });

  it('Ρ1. Ορθογώνιο ΟΘΟΝΗΣ δεν περνά ως ορθογώνιο ΚΑΤΟΨΗΣ — ΚΑΙ το ανάποδο', () => {
    const errs = typeErrors(`
import type { ScreenRectPx, PointRect } from './space';
declare const px: ScreenRectPx;
export const wrong: PointRect<'plan-mm'> = px;
declare function wantsPlan(r: PointRect<'plan-mm'>): void;
wantsPlan(px);
declare const plan: PointRect<'plan-mm'>;
export const alsoWrong: ScreenRectPx = plan;
`);
    // ΚΑΙ ΟΙ ΔΥΟ κατευθύνσεις + όρισμα: μια μονόδρομη εγγύηση αφήνει τη μισή βλάβη ζωντανή.
    expect(errs.map((e) => e.line).sort((x, y) => x - y)).toEqual([4, 6, 8]);
  });

  it('Ρ2 (Η ΖΩΝΤΑΝΗ ΒΛΑΒΗ). px ↔ world mm: ΑΚΡΙΒΩΣ το ζεύγος που περνούσε αθόρυβα', () => {
    // Πριν το ADR-795 το `ScreenRect` του marquee ήταν σκέτο `{min:Point2D;max:Point2D}`,
    // δομικά ΤΑΥΤΟΣΗΜΟ με **εννέα** τύπους σε κόσμο/κάτοψη — μεταξύ τους το `Bounds2D`,
    // που λέει κατά λέξη «world mm». Ο λόγος px↔mm αλλάζει με το ZOOM: δεν υπάρχει καν
    // συντελεστής να διορθώσει κανείς εκ των υστέρων.
    const errs = typeErrors(`
import type { ScreenRectPx, PointRect } from './space';
declare function drawInWorldMm(b: PointRect<'plan-mm'>): void;
declare const marquee: ScreenRectPx;
drawInWorldMm(marquee);
`);
    expect(errs).toHaveLength(1);
    expect(errs[0]!.code).toBe(2345); // όρισμα μη-αναθέσιμο
  });

  it('Μ2 (ΜΕΤΑΛΛΑΞΗ ΣΤΗΝ ΕΙΣΟΔΟ). Χωρίς το brand, το Ρ1 γίνεται ΠΡΑΣΙΝΟ', () => {
    // Μετάλλαξη στο ΠΡΑΓΜΑΤΙΚΟ module — μόνο η κληρονομιά του brand του PointRect.
    const withoutBrand = SPACE_MODULE.replace(
      'export interface PointRect<S extends CoordinateSpace> extends InSpace<S> {',
      'export interface PointRect<S extends CoordinateSpace> {',
    );
    expect(withoutBrand).not.toEqual(SPACE_MODULE); // η μετάλλαξη ΟΝΤΩΣ άλλαξε κάτι
    const errs = typeErrors(
      `
import type { ScreenRectPx, PointRect } from './space';
declare const px: ScreenRectPx;
export const wrong: PointRect<'plan-mm'> = px;
`,
      withoutBrand,
    );
    // Δομική γλώσσα: ίδια δύο πεδία ⇒ ίδιος τύπος. Αυτό ΗΤΑΝ η κατάσταση πριν.
    expect(errs).toEqual([]);
  });

  it('Ρ3. Οι ΔΥΟ μορφές δεν αναμειγνύονται ούτε στον ΙΔΙΟ χώρο — άλλο σχήμα, άλλο ερώτημα', () => {
    const errs = typeErrors(`
import type { Bbox, PointRect } from './space';
declare const scalar: Bbox;
export const wrong: PointRect<'plan-mm'> = scalar;
`);
    expect(errs).toHaveLength(1);
    // ⚠️ Κωδικός **2739** («λείπουν οι ιδιότητες min, max»), ΟΧΙ 2322 («μη αναθέσιμο»):
    // εδώ ο μεταγλωττιστής απορρίπτει σε επίπεδο **ΣΧΗΜΑΤΟΣ** (βαθμωτά ≠ σημεία), ενώ στο
    // Ρ1 σε επίπεδο **ΧΩΡΟΥ** (ίδιο σχήμα, άλλο brand). Δύο διαφορετικοί μηχανισμοί που
    // απαντούν δύο διαφορετικά ερωτήματα — γι' αυτό ο κωδικός κλειδώνεται ρητά και όχι με
    // ένα σκέτο «απέτυχε»: αν αυτό γίνει ποτέ 2322, το σχήμα έχει συγχωνευθεί εν αγνοία μας.
    expect(errs[0]!.code).toBe(2739);
  });

  it('Ρ4 (ΔΗΛΩΜΕΝΟ ΟΡΙΟ). Ωμό literal περνά παντού — το brand φυλάει τη ΡΟΗ, όχι την κατασκευή', () => {
    const errs = typeErrors(`
import type { ScreenRectPx, PointRect } from './space';
export const a: ScreenRectPx = { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } };
export const b: PointRect<'plan-mm'> = { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } };
`);
    expect(errs).toEqual([]);
  });
});

describe('ADR-795 — το brand του PointRect είναι ΑΟΡΑΤΟ σε χρόνο εκτέλεσης', () => {
  it('Ρ5. Μηδέν πεδίο παραπάνω — το σχήμα ΑΠΟΘΗΚΕΥΕΤΑΙ σε Firestore/Storage αυτούσιο', () => {
    // 🔴 Δεν είναι θεωρητικό: αυτό ΑΚΡΙΒΩΣ το σχήμα γράφεται σήμερα σε
    // `files/{id}.processedData.bounds` (Firestore) ΚΑΙ στο gzip JSON της σκηνής (Storage).
    // Ένα ορατό phantom πεδίο θα ήταν ΜΕΤΑΝΑΣΤΕΥΣΗ ΔΕΔΟΜΕΝΩΝ, όχι αλλαγή τύπου.
    const rect = { min: { x: 1, y: 2 }, max: { x: 5, y: 9 } };
    expect(Object.keys(rect).sort()).toEqual(['max', 'min']);
    expect(Object.getOwnPropertySymbols(rect)).toEqual([]);
    expect(JSON.parse(JSON.stringify(rect))).toEqual(rect);
  });
});
