/**
 * ADR-718 — CAPABILITY ANCHOR: **το παραδοτέο είναι το αρχείο του τι ΜΕΤΡΗΘΗΚΕ.**
 *
 * Η κοπή στο όριο είναι εργαλείο ΜΕΛΕΤΗΣ — λέει «τι με αφορά από το έδαφος». Το παραδοτέο του
 * τοπογράφου είναι κάτι άλλο: ο πίνακας συντεταγμένων, το εμβαδόν, οι έλεγχοι ανοχής και το DXF
 * που παραδίδεται στον πελάτη είναι **η αποτύπωση**, ολόκληρη. Αν η εξαγωγή κοβόταν:
 *
 *   • ο πελάτης θα έπαιρνε μικρότερη αποτύπωση από αυτήν που πλήρωσε·
 *   • τα σημεία ΕΞΩ από το όριο θα έβγαιναν **χωρίς υψόμετρο** — ο sampler δεν έχει έδαφος εκεί,
 *     άρα `null` — ενώ οι Χ,Υ τους θα εμφανίζονταν κανονικά στον πίνακα. Μισό σημείο, σιωπηλά.
 *
 * Η αστοχία είναι μονόδρομος: κανείς δεν ελέγχει ένα παραδοτέο συγκρίνοντάς το με μια οθόνη που
 * έδειχνε άλλο πράγμα την ώρα της εξαγωγής.
 *
 * Δύο επίπεδα εδώ, σκόπιμα:
 *   1. **Συμπεριφορά** — τι χάνεται συγκεκριμένα αν κάποιος αλλάξει τη μία λέξη·
 *   2. **Ραφή (class-level)** — ΚΑΝΕΝΑ module του φακέλου `deliverables/` δεν φτάνει στην κομμένη
 *      επιφάνεια. Το δεύτερο πιάνει τον ΕΠΟΜΕΝΟ παραγωγό παραδοτέων, όχι μόνο τον σημερινό —
 *      το μάθημα του ADR-650 §M10f: κανόνας που δεν τον **ρωτά** κανείς, δεν ισχύει.
 *
 * @see ../useSurveyExport.ts — ο ΕΝΑΣ αδιάφανος κρίκος (διαβάζει τα stores)
 * @see ../../topo-surface.ts — `getTopoSurfaceFull` (μετρημένη) vs `getTopoSurface` (τρέχουσα)
 */

import * as fs from 'fs';
import * as path from 'path';
import { getTopoSurface, getTopoSurfaceFull, invalidateTopoSurface } from '../../topo-surface';
import { clearTopo, setTopoBoundary, setTopoCrop, setTopoPoints } from '../../TopoPointStore';
import { createTinSampler } from '../../tin-sampler';
import type { Point2D } from '../../../../rendering/types/Types';
import type { TopoPoint } from '../../topo-types';

const DELIVERABLES_DIR = path.join(__dirname, '..');
const M = 1000;

function surveyPoints(): TopoPoint[] {
  const pts: TopoPoint[] = [];
  for (let gx = 0; gx <= 5; gx++) {
    for (let gy = 0; gy <= 5; gy++) {
      pts.push({ x: gx * 4 * M, y: gy * 4 * M, z: 1 * M + gx * 100 });
    }
  }
  return pts;
}

/** Αριστερό μισό — αφήνει ΕΞΩ ολόκληρη τη δεξιά πλευρά της αποτύπωσης. */
const HALF: Point2D[] = [
  { x: 0, y: 0 },
  { x: 10 * M, y: 0 },
  { x: 10 * M, y: 20 * M },
  { x: 0, y: 20 * M },
];

/** Σημείο της αποτύπωσης που πέφτει ΕΞΩ από το όριο κοπής (δεξιά πλευρά). */
const OUTSIDE = { x: 16 * M, y: 8 * M };

beforeEach(() => {
  clearTopo();
  invalidateTopoSurface();
  setTopoPoints(surveyPoints());
  setTopoBoundary({ vertices: HALF });
  setTopoCrop({ enabled: true });
});

describe('ADR-718 — η εξαγωγή δειγματοληπτεί τη ΜΕΤΡΗΜΕΝΗ επιφάνεια', () => {
  it('η πλήρης επιφάνεια δίνει υψόμετρο σε σημείο ΕΞΩ από την κοπή', () => {
    const z = createTinSampler(getTopoSurfaceFull('existing')).zAtMm(OUTSIDE.x, OUTSIDE.y);
    expect(z).not.toBeNull();
  });

  it('🔴 Η ΖΗΜΙΑ: η κομμένη επιφάνεια δίνει `null` εκεί — το σημείο θα έβγαινε ΧΩΡΙΣ υψόμετρο', () => {
    // Αυτός ο έλεγχος περιγράφει τι ΘΑ συνέβαινε αν η εξαγωγή άλλαζε σε `getTopoSurface`.
    // Δεν είναι σφάλμα της κοπής — είναι ο λόγος που η εξαγωγή δεν την ακολουθεί.
    const z = createTinSampler(getTopoSurface('existing')).zAtMm(OUTSIDE.x, OUTSIDE.y);
    expect(z).toBeNull();
  });

  it('ΜΕΣΑ στο όριο οι δύο επιφάνειες συμφωνούν στο υψόμετρο — η κοπή δεν αλλοιώνει το Ζ', () => {
    const inside = { x: 4 * M, y: 8 * M };
    const zFull = createTinSampler(getTopoSurfaceFull('existing')).zAtMm(inside.x, inside.y);
    const zCropped = createTinSampler(getTopoSurface('existing')).zAtMm(inside.x, inside.y);

    expect(zFull).not.toBeNull();
    expect(zCropped).toBeCloseTo(zFull as number, 6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Η ραφή: ο ΕΠΟΜΕΝΟΣ παραγωγός παραδοτέων, όχι μόνο ο σημερινός
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe('ADR-718 — κανένα παραδοτέο δεν φτάνει στην ΚΟΜΜΕΝΗ επιφάνεια', () => {
  /** Κάθε `.ts` module του φακέλου των παραδοτέων (όχι tests). */
  function deliverableModules(): string[] {
    return fs.readdirSync(DELIVERABLES_DIR)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.includes('.test.'));
  }

  const sourceOf = (file: string): string =>
    fs.readFileSync(path.join(DELIVERABLES_DIR, file), 'utf8');

  /**
   * Τα ονόματα που ένα module εισάγει από το `topo-surface`.
   *
   * Ο έλεγχος δένεται στα **imports**, όχι σε αναζήτηση κειμένου, για δύο λόγους. Πρώτον είναι
   * ΑΚΡΙΒΗΣ: η `getTopoSurface` είναι module-scope συνάρτηση — κανένα αρχείο δεν μπορεί να τη
   * χρησιμοποιήσει χωρίς να την εισάγει, οπότε «δεν την εισάγει» σημαίνει «δεν τη χρησιμοποιεί».
   * Δεύτερον δεν αυτοπυροβολείται: ένα σχόλιο που **προειδοποιεί** «ποτέ την κομμένη» πρέπει να
   * μπορεί να την ονομάσει. Έλεγχος που απαγορεύει τη λέξη απαγορεύει και την προειδοποίηση.
   */
  function surfaceImports(file: string): string[] {
    const match = /import\s+\{([^}]*)\}\s+from\s+'[^']*topo-surface'/.exec(sourceOf(file));
    if (!match) return [];
    return match[1]!.split(',').map((s) => s.trim().split(/\s+as\s+/)[0]!.trim()).filter(Boolean);
  }

  it('ο κατάλογος των modules διαβάστηκε (αλλιώς ο έλεγχος από κάτω δεν αποδεικνύει τίποτα)', () => {
    expect(deliverableModules().length).toBeGreaterThanOrEqual(5);
  });

  it('κανένα module των παραδοτέων δεν εισάγει `getTopoSurface` (μόνο το `…Full` επιτρέπεται)', () => {
    const offenders = deliverableModules().filter((f) => surfaceImports(f).includes('getTopoSurface'));
    expect(offenders).toEqual([]);
  });

  it('κανένα module δεν την πιάνει ούτε πλαγίως (namespace import του `topo-surface`)', () => {
    // `import * as S from '../topo-surface'` θα παρέκαμπτε τον από πάνω έλεγχο ολοσχερώς.
    const offenders = deliverableModules()
      .filter((f) => /import\s+\*\s+as\s+\w+\s+from\s+'[^']*topo-surface'/.test(sourceOf(f)));
    expect(offenders).toEqual([]);
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: το `useSurveyExport` όντως δειγματοληπτεί το `getTopoSurfaceFull`', () => {
    // Χωρίς αυτό, ο από πάνω έλεγχος θα ήταν εξίσου πράσινος σε έναν φάκελο που δεν αγγίζει
    // καθόλου την τοπογραφία — δηλαδή θα φύλαγε το τίποτα.
    const source = sourceOf('useSurveyExport.ts');
    expect(source).toMatch(/createTinSampler\(\s*getTopoSurfaceFull\(/);
    expect(source).toMatch(/import\s+\{[^}]*\bgetTopoSurfaceFull\b[^}]*\}\s+from\s+'\.\.\/topo-surface'/);
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: ο αναγνώστης imports ΞΕΧΩΡΙΖΕΙ τις δύο συναρτήσεις', () => {
    // Ο έλεγχος βασίζεται σε ακριβή ταύτιση ονόματος. Αν το `includes('getTopoSurface')` γινόταν
    // ποτέ έλεγχος υπο-συμβολοσειράς, θα κατήγγειλε το `getTopoSurfaceFull` — δηλαδή θα
    // απαγόρευε ακριβώς αυτό που απαιτεί. Εδώ κλειδώνει ότι δεν γίνεται.
    expect(['getTopoSurfaceFull'].includes('getTopoSurface')).toBe(false);
    expect(surfaceImports('useSurveyExport.ts')).toEqual(['getTopoSurfaceFull']);
  });
});
