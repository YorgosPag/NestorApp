/**
 * 🔴 Contract test — «πού είναι η περιοχή σχεδίασης» έχει **ΜΙΑ** απάντηση.
 *
 * Γιατί υπάρχει: μέχρι τις 2026-07-31 η ερώτηση απαντιόταν σε **επτά** σημεία, με **δύο**
 * ασύνδετες γραφές πάνω στο ίδιο αντικείμενο (`MARGINS.{left,top}` έναντι `MARGINS.{left,bottom}`)
 * και μία τρίτη πηγή (`rulerSettings.width/height`). Δύο ακόμη αντίγραφα ζούσαν σε άλλο
 * υποσύστημα (`floorplan-background/providers`), και δύο νεκρές σταθερές (`RULER_LEFT_PAD`,
 * `RULER_BOTTOM_PAD`) περίμεναν τον επόμενο. Καμία απόκλιση δεν κοκκίνιζε τίποτα.
 *
 * 🔑 Ο λόγος που ο φρουρός κοιτά **πηγή** και όχι συμπεριφορά: ένα λάθος ορθογώνιο **δεν
 * πιάνεται στατικά**. Ο τύπος `{x, y, width, height}` είναι νόμιμος όποιοι κι αν είναι οι
 * αριθμοί, και κάθε αριθμητική πάνω σε `viewport.width/height` μεταγλωττίζεται μια χαρά. Το
 * μόνο πράγμα που μπορεί να ελεγχθεί μηχανικά είναι **ποιος επιτρέπεται να ρωτήσει**.
 *
 * Ίδιο μοτίβο με το `rendering/utils/__tests__/main-canvas-element.test.ts`.
 */

import fs from 'fs';
import path from 'path';
import { DRAWING_AREA_CHROME, getDrawingAreaRect } from '../drawing-area';
import { COORDINATE_LAYOUT } from '../CoordinateTransforms';
import { RULERS_GRID_CONFIG } from '../../../systems/rulers-grid/config';

const SUBAPP_ROOT = path.resolve(__dirname, '../../..');

/**
 * Τα ΜΟΝΑ αρχεία που επιτρέπεται να αναφέρουν το legacy `MARGINS`:
 * ο ορισμός + δύο deprecated shims συμβατότητας που απλώς το re-export-άρουν.
 */
const MARGINS_ALLOWED = [
  path.join('rendering', 'core', 'CoordinateTransforms.ts'),
  path.join('rendering', 'core', 'drawing-area.ts'),
  path.join('constants.ts'),
  path.join('systems', 'rulers-grid', 'config.ts'),
];

const EXCLUDED_DIRS = ['__tests__', 'debug', 'e2e', 'testing', 'docs', 'node_modules'];

/**
 * Ο φρουρός κοιτά **κώδικα**, όχι πεζά — αλλιώς η ίδια η τεκμηρίωση του σφάλματος (που
 * παραθέτει τις παλιές γραφές για να εξηγήσει τι πήγε στραβά) θα τον κοκκίνιζε, και ο επόμενος
 * θα «διόρθωνε» το σχόλιο αντί για το πρόβλημα.
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

const SOURCES = collectSourceFiles(SUBAPP_ROOT).map((file) => ({
  rel: path.relative(SUBAPP_ROOT, file),
  code: stripComments(fs.readFileSync(file, 'utf8')),
}));

describe('περιοχή σχεδίασης — ΜΙΑ απάντηση, ένας ορισμός', () => {
  it('🔴 κανείς εκτός του ορισμού + των shims δεν αναφέρει το legacy `MARGINS`', () => {
    const offenders = SOURCES.filter(
      ({ rel, code }) => !MARGINS_ALLOWED.includes(rel) && /\bMARGINS\b/.test(code),
    ).map(({ rel }) => rel);

    // Αν κοκκινίσει: ΜΗΝ προσθέσεις το αρχείο στη λίστα — χρησιμοποίησε `getDrawingAreaRect()`.
    // Η λίστα υπάρχει για συμβατότητα, όχι για επέκταση.
    expect(offenders).toEqual([]);
  });

  it('🔴 κανείς δεν χτίζει την περιοχή σχεδίασης από `rulerSettings.width/height`', () => {
    // Αυτή ήταν η ΤΡΙΤΗ πηγή (`LayerRenderer`) — runtime settings, ενώ οι μετασχηματισμοί
    // χρησιμοποιούσαν σταθερές. Οι δύο μπορούσαν να αποκλίνουν σιωπηλά.
    const offenders = SOURCES.filter(({ code }) =>
      /rulerSettings\s*\.\s*(width|height)\s*\|\|/.test(code),
    ).map(({ rel }) => rel);
    expect(offenders).toEqual([]);
  });

  it('🔴 κανείς δεν ξαναδηλώνει hardcoded ζώνη χάρακα (RULER_*_PAD)', () => {
    const offenders = SOURCES.filter(({ code }) => /RULER_(LEFT|BOTTOM)_PAD/.test(code)).map(
      ({ rel }) => rel,
    );
    expect(offenders).toEqual([]);
  });

  it('το `floorplan-background` δεν κρατά δικό του «margins» για την άγκυρα', () => {
    // Ήταν `cad.margins.{left,top}` — αντίγραφο της άγκυρας ΜΑΖΙ με το λάθος όνομα.
    const offenders = SOURCES.filter(({ code }) => /cad\s*\.\s*margins/.test(code)).map(
      ({ rel }) => rel,
    );
    expect(offenders).toEqual([]);
  });
});

describe('συνέπεια των παραγώγων — δεν επιτρέπεται σιωπηλή απόκλιση', () => {
  it('το legacy `COORDINATE_LAYOUT` παραμένει ακριβής προβολή του SSoT', () => {
    expect(COORDINATE_LAYOUT.MARGINS.left).toBe(DRAWING_AREA_CHROME.leftRulerWidth);
    expect(COORDINATE_LAYOUT.MARGINS.bottom).toBe(DRAWING_AREA_CHROME.bottomRulerHeight);
    // 🔑 Το ιστορικά κακώς ονομασμένο `top` ΠΡΕΠΕΙ να ισούται με το ύψος του ΚΑΤΩ χάρακα:
    // αυτή είναι η ταυτότητα πάνω στην οποία στηρίζεται όλη η ενοποίηση.
    expect(COORDINATE_LAYOUT.MARGINS.top).toBe(DRAWING_AREA_CHROME.bottomRulerHeight);
    expect(COORDINATE_LAYOUT.RULER_LEFT_WIDTH).toBe(DRAWING_AREA_CHROME.leftRulerWidth);
  });

  it('🔴 οι ρυθμίσεις των χαράκων συμφωνούν με το chrome του SSoT', () => {
    // Αν κάποιος προσθέσει UI που αλλάζει το μέγεθος χάρακα, ΑΥΤΟ θα κοκκινίσει πρώτο — και
    // η σωστή κίνηση είναι να τραφεί το `DRAWING_AREA_CHROME` από τις ρυθμίσεις (μία πηγή),
    // ΟΧΙ να ξαναδιακλαδωθεί η γεωμετρία ανά καταναλωτή (αυτό ήταν το αρχικό χρέος).
    expect(RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH).toBe(DRAWING_AREA_CHROME.leftRulerWidth);
    expect(RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT).toBe(DRAWING_AREA_CHROME.bottomRulerHeight);
  });

  it('το ορθογώνιο δεν εξαρτάται από τίποτα εκτός του viewport (καθαρή συνάρτηση)', () => {
    const vp = { width: 800, height: 600 };
    expect(getDrawingAreaRect(vp)).toEqual(getDrawingAreaRect({ ...vp }));
  });
});
