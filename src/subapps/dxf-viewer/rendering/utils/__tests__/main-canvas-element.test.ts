/**
 * 🔴 Contract test — «ποιο στοιχείο DOM είναι ο κύριος καμβάς» έχει **ΜΙΑ** απάντηση.
 *
 * Γιατί υπάρχει: μέχρι τις 2026-07-31 το `use-selection-cycling` έψαχνε
 * `getElementById('dxf-canvas')` — **id που δεν υπάρχει πουθενά**. Έβγαινε `null`, ο handler έκανε
 * `return`, και το Shift+Space (κύκλος επιλογής) δεν πυροδοτούσε ΠΟΤΕ. Μηδέν εξαιρέσεις, μηδέν
 * κόκκινα tests, μηδέν ένδειξη στην οθόνη — μια σιωπηλή πρόωρη έξοδος είναι δυσδιάκριτη από
 * «δεν βρέθηκαν υποψήφιοι». Ένα λάθος `id` **δεν πιάνεται στατικά**: ο τύπος `| null` είναι
 * νόμιμος και κάθε καλών τον χειρίζεται «σωστά».
 *
 * Ο μόνος φρουρός που πιάνει αυτή την κλάση είναι ο έλεγχος **πηγής**: κανείς εκτός του ενός
 * σημείου ορισμού δεν επιτρέπεται να ξαναγράψει τον επιλογέα.
 */

import fs from 'fs';
import path from 'path';
import {
  getMainDxfCanvas,
  MAIN_DXF_CANVAS_SELECTOR,
  MAIN_DXF_CANVAS_TYPE,
} from '../main-canvas-element';

const SUBAPP_ROOT = path.resolve(__dirname, '../../..');

/** Το ΜΟΝΟ αρχείο που θέτει το attribute + το ΜΟΝΟ που το διαβάζει. */
const ALLOWED = [
  path.join('canvas-v2', 'dxf-canvas', 'DxfCanvas.tsx'),
  path.join('rendering', 'utils', 'main-canvas-element.ts'),
];

/** Εργαλεία διάγνωσης/e2e: ζωγραφίζουν πάνω σε ΟΛΟΥΣ τους καμβάδες — εκτός συμβολαίου by design. */
const EXCLUDED_DIRS = ['__tests__', 'debug', 'e2e', 'testing', 'docs'];

/**
 * In-app διαγνωστική σουίτα («Εκτέλεση Ελέγχων»): συγκρίνει ΟΛΟΥΣ τους καμβάδες μεταξύ τους για
 * alignment/stacking. Ίδια οικογένεια με το `debug/` — απλώς ζει κάτω από `ui/`.
 */
const EXCLUDED_FILES = [path.join('ui', 'components', 'tests-modal', 'constants', 'automatedTests.ts')];

/**
 * Ο φρουρός κοιτά **κώδικα**, όχι πεζά. Χωρίς αυτό, η ίδια η τεκμηρίωση του σφάλματος (που
 * παραθέτει τη λάθος κλήση για να εξηγήσει τι πήγε στραβά) θα κοκκίνιζε τον έλεγχο — και ο
 * επόμενος θα «διόρθωνε» το σχόλιο αντί για το πρόβλημα.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.includes(entry.name)) continue;
      collectSourceFiles(path.join(dir, entry.name), out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

describe('getMainDxfCanvas — ένα στοιχείο, ένας επιλογέας', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('βρίσκει τον καμβά από το attribute που όντως φοράει', () => {
    document.body.innerHTML =
      `<canvas data-canvas-type="layer"></canvas><canvas data-canvas-type="${MAIN_DXF_CANVAS_TYPE}"></canvas>`;
    const canvas = getMainDxfCanvas();
    expect(canvas).not.toBeNull();
    expect(canvas!.dataset.canvasType).toBe(MAIN_DXF_CANVAS_TYPE);
  });

  it('🔴 ΤΟ ΑΚΡΙΒΕΣ ΣΦΑΛΜΑ: `id="dxf-canvas"` ΔΕΝ υπάρχει — μόνο του δεν εντοπίζει τίποτα', () => {
    document.body.innerHTML = '<canvas id="dxf-canvas"></canvas>';
    expect(document.getElementById('dxf-canvas')).not.toBeNull(); // το id υπάρχει στο fixture…
    expect(getMainDxfCanvas()).toBeNull(); // …αλλά ΔΕΝ είναι έτσι που αναγνωρίζεται ο καμβάς
  });

  it('χωρίς καμβά επιστρέφει null (πραγματική κατάσταση: πριν το mount)', () => {
    expect(getMainDxfCanvas()).toBeNull();
  });
});

describe('🔴 κανείς δεν ξαναγράφει τον επιλογέα του κύριου καμβά', () => {
  const files = collectSourceFiles(SUBAPP_ROOT);

  it('σαρώνει πραγματικά αρχεία (ο φρουρός δεν είναι κενός)', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('κανένα αρχείο δεν ψάχνει τον καμβά με `id`', () => {
    const offenders = files.filter((f) =>
      /getElementById\(\s*['"]dxf-canvas['"]\s*\)/.test(stripComments(fs.readFileSync(f, 'utf8'))),
    );
    expect(offenders.map((f) => path.relative(SUBAPP_ROOT, f))).toEqual([]);
  });

  it('μόνο ο ορισμός και ο setter αναφέρουν το raw `data-canvas-type="dxf"`', () => {
    const offenders = files
      .filter((f) => /data-canvas-type\s*=\s*["'`]?dxf["'`]?/.test(stripComments(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(SUBAPP_ROOT, f))
      .filter((rel) => !ALLOWED.includes(rel) && !EXCLUDED_FILES.includes(rel));
    expect(offenders).toEqual([]);
  });

  it('ο επιλογέας παράγεται από τον τύπο (καμία δεύτερη συμβολοσειρά)', () => {
    expect(MAIN_DXF_CANVAS_SELECTOR).toBe(`canvas[data-canvas-type="${MAIN_DXF_CANVAS_TYPE}"]`);
  });
});
