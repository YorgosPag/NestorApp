/**
 * 🔴 ADR-739 §41 — **Ο ΧΡΩΜΑΤΙΣΜΟΣ ΤΗΣ ΕΠΙΛΕΓΜΕΝΗΣ ΠΕΡΙΟΧΗΣ: ισοτιμία με το Excel.**
 *
 * ## Γιατί χωριστή σουίτα και όχι άλλο ένα `describe` στο `stamp-table-layout.test.ts`
 * Η επιλογή είχε **μηδέν** tests μέχρι τις 04/08 — ήταν η μόνη από τις τέσσερις καταστάσεις
 * δείκτη του πίνακα (δρομέας · λειτουργία · φάντασμα · **επιλογή**) χωρίς anchor, και ήταν
 * ακριβώς αυτή που απέκλινε από το πρότυπο. Οι υπόλοιπες σουίτες ρωτούν «με τι μολύβι
 * χαράχτηκε;»· εδώ το ερώτημα είναι **«ποια pixel έμειναν άβαφα;»**, που είναι άλλη ερώτηση
 * και θέλει άλλα εργαλεία (υποδιαδρομές, κανόνας περιτύλιξης, σύνθεση πάνω στην επιφάνεια).
 *
 * ## 🔴 Η πηγή αλήθειας είναι ΜΕΤΡΗΣΗ, όχι γνώμη
 * Κάθε αριθμός εδώ διαβάστηκε από pixel στιγμιότυπου του **πραγματικού Excel** (04/08,
 * `Βιβλίο1`, επιλογή `B10:C13`, ενεργό `B10`):
 *
 * ```
 *   ενεργό κελί        #FFFFFF   ← ΚΑΘΑΡΟ φόντο φύλλου, σε όλο το εσωτερικό
 *   άλλο κελί          #C6C6C6   ← 255 × (1 − 0,2235)
 *   πλέγμα εκτός       #E1E1E1
 *   πλέγμα εντός       #AFAFAF   ← 225 × (1 − 0,2235) = 174,7 ✓  (η δεύτερη, ανεξάρτητη επαλήθευση)
 *   περίγραμμα         2 px      ← αριστερά x=239..240 · πάνω y=355..356 · δεξιά x=580..581
 *   ακμή ενεργού|διπλανού  #ADADAD ← γραμμή πλέγματος, ΟΧΙ δεύτερο περίγραμμα
 * ```
 *
 * @module rendering/entities/table/__tests__/table-selection-paint.test
 * @see rendering/entities/table/stamp-table-layout.ts — `stampTableSelection`
 * @see bim/table/table-ink.ts — `tableSelectionWashRgba`, ο κανόνας του χρώματος
 */

import { TABLE_CELL_CURSOR, TABLE_CELL_SELECTION } from '../../../../config/color-config';
import { compositeOverHex, parseColor } from '../../../../config/color-math';
import { TABLE_PAPER_HEX } from '../../../../bim/table/table-ink';
import type { TableRectMm } from '../../../../bim/table/table-layout-types';
import { stampTableSelection } from '../stamp-table-layout';
import {
  createPaintLog,
  createRc,
  RECORDER_DARK_SURFACE,
  type PaintLog,
} from './table-paint-recorder';

/** Η περιοχή: 4 στήλες × 3 γραμμές σε sheet-mm. */
const RANGE: TableRectMm = { x: 10, y: 20, w: 40, h: 30 };
/** Το ενεργό κελί, πάνω-αριστερά **μέσα** στην περιοχή — όπως το `B10` του στιγμιότυπου. */
const ACTIVE: TableRectMm = { x: 10, y: 20, w: 10, h: 10 };

/** Η μία γεμισμένη διαδρομή που παράγει η επιλογή — ρητή αποτυχία αν γίνουν δύο. */
function soleFill(log: PaintLog) {
  expect(log.fillPaths).toHaveLength(1);
  return log.fillPaths[0];
}

// ── Το ενεργό κελί ───────────────────────────────────────────────────────────

/**
 * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΕΦΕΡΕ ΤΟ §41.** Η προηγούμενη υλοποίηση χάραζε **ένα** ορθογώνιο και
 * γέμιζε με `nonzero`: το ενεργό κελί σκιαζόταν μαζί με τα υπόλοιπα, οπότε η επιλογή δεν
 * απαντούσε πια «πού θα πάει ό,τι πληκτρολογήσω».
 *
 * Τα δύο πρώτα tests πιάνουν **αντίθετες** αστοχίες, και χρειάζονται και τα δύο: το ένα ότι
 * η τρύπα υπάρχει, το άλλο ότι είναι **τρύπα** και όχι δεύτερο βαμμένο σχήμα (`nonzero` πάνω
 * σε δύο ομόστροφα ορθογώνια βάφει ολόκληρο το εξωτερικό — ίδια εικόνα με το ελάττωμα).
 */
describe('stampTableSelection — η τρύπα του ενεργού κελιού (Excel parity)', () => {
  it('🔴 χαράζει ΔΕΥΤΕΡΗ υποδιαδρομή στο ενεργό κελί — η ίδια διαδρομή, ένα `fill`', () => {
    const log = createPaintLog();
    stampTableSelection(createRc(log), RANGE, ACTIVE);

    const fill = soleFill(log);
    expect(fill.subpaths).toHaveLength(2);
    // Ταυτοτική προβολή ⇒ τα sheet-mm περνούν αυτούσια σε px· η δεύτερη υποδιαδρομή είναι
    // **ακριβώς** το ορθογώνιο του ενεργού κελιού, όχι κάτι κοντινό.
    expect(fill.subpaths[1]).toEqual([
      { x: 10, y: 20 },
      { x: 20, y: 20 },
      { x: 20, y: 30 },
      { x: 10, y: 30 },
    ]);
  });

  it('🔴 γεμίζει με `evenodd` — αλλιώς η δεύτερη υποδιαδρομή ΔΕΝ είναι τρύπα', () => {
    const log = createPaintLog();
    stampTableSelection(createRc(log), RANGE, ACTIVE);

    expect(soleFill(log).rule).toBe('evenodd');
  });

  it('χωρίς ενεργό κελί σκιάζει ΟΛΗ την περιοχή — μία υποδιαδρομή, καμία τρύπα', () => {
    const log = createPaintLog();
    stampTableSelection(createRc(log), RANGE);

    expect(soleFill(log).subpaths).toHaveLength(1);
  });

  it('επιλογή 1×1: τα δύο ορθογώνια ΤΑΥΤΙΖΟΝΤΑΙ ⇒ μηδενική σκίαση, χωρίς ειδική περίπτωση', () => {
    const log = createPaintLog();
    stampTableSelection(createRc(log), ACTIVE, ACTIVE);

    const fill = soleFill(log);
    expect(fill.rule).toBe('evenodd');
    // Ίδια σημεία δύο φορές: με `evenodd` κάθε σημείο είναι μέσα σε **δύο** υποδιαδρομές,
    // άρα άβαφο. Το μονοσύνολο δείχνει μόνο περίγραμμα — ακριβώς όπως στο Excel.
    expect(fill.subpaths[0]).toEqual(fill.subpaths[1]);
  });

  it('περνά και τις ΤΕΣΣΕΡΙΣ γωνίες ΚΑΙ ΤΩΝ ΔΥΟ ορθογωνίων από το `toScreen` — ο πίνακας περιστρέφεται', () => {
    const log = createPaintLog();
    // Στροφή 90°: αν κάποιος «απλοποιούσε» την τρύπα σε `rect()` σε άξονες οθόνης, θα έμενε
    // ορθογώνια ενώ η περιοχή γύρω της γέρνει — δηλαδή τρύπα σε λάθος κελί.
    stampTableSelection(createRc(log, { toScreen: (u, v) => ({ x: -v, y: u }) }), RANGE, ACTIVE);

    expect(soleFill(log).subpaths[1]).toEqual([
      { x: -20, y: 10 },
      { x: -20, y: 20 },
      { x: -30, y: 20 },
      { x: -30, y: 10 },
    ]);
  });
});

// ── Το χρώμα της σκίασης ─────────────────────────────────────────────────────

/**
 * 🔴 **Η ΣΚΙΑΣΗ ΕΙΝΑΙ ΟΥΔΕΤΕΡΗ ΚΑΙ ΡΩΤΑ ΤΗΝ ΕΠΙΦΑΝΕΙΑ.**
 *
 * Το ρίσκο δεν είναι θεωρητικό: μέχρι τις 04/08 το γέμισμα ήταν `INDICATOR_BLUE @ 18%` —
 * σταθερό μπλε. Ένα κίτρινο κελί κάτω από αυτό γινόταν **πράσινο**, δηλαδή ο χρήστης έχανε
 * το χρώμα που ο ίδιος έβαλε τη στιγμή που μάρκαρε το κελί για να το αλλάξει.
 *
 * Τα δύο tests δοκιμάζουν τις **δύο κατευθύνσεις** επίτηδες: μια σουίτα που έβλεπε μόνο τη
 * σκούρα επιφάνεια θα ήταν πράσινη με σπασμένο το χαρτί — και το χαρτί είναι αυτό που φεύγει
 * στον πελάτη.
 */
describe('stampTableSelection — το χρώμα ρωτά την επιφάνεια', () => {
  it('🔴 σε ΧΑΡΤΙ σκουραίνει (μαύρο) — και δίνει ΑΚΡΙΒΩΣ το #C6C6C6 που μετρήθηκε στο Excel', () => {
    const log = createPaintLog();
    stampTableSelection(createRc(log, { surfaceHex: TABLE_PAPER_HEX }), RANGE, ACTIVE);

    const wash = parseColor(soleFill(log).color);
    expect(wash).not.toBeNull();
    expect({ r: wash?.r, g: wash?.g, b: wash?.b }).toEqual({ r: 0, g: 0, b: 0 });
    // Η ισοτιμία, συντεθειμένη: το ίδιο pixel που διαβάστηκε από το στιγμιότυπο.
    expect(compositeOverHex(wash!, TABLE_PAPER_HEX).toLowerCase()).toBe('#c6c6c6');
  });

  it('🔴 σε ΣΚΟΥΡΟ καμβά φωτίζει (λευκό) — μαύρη σκίαση εκεί θα ήταν αόρατη', () => {
    const log = createPaintLog();
    stampTableSelection(createRc(log, { surfaceHex: RECORDER_DARK_SURFACE }), RANGE, ACTIVE);

    const wash = parseColor(soleFill(log).color);
    expect({ r: wash?.r, g: wash?.g, b: wash?.b }).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('🔴 είναι ΟΥΔΕΤΕΡΗ σε κάθε επιφάνεια — καμία απόχρωση να βάψει τα γεμίσματα των κελιών', () => {
    for (const surface of [TABLE_PAPER_HEX, RECORDER_DARK_SURFACE, '#5b5b5b', '#102040']) {
      const log = createPaintLog();
      stampTableSelection(createRc(log, { surfaceHex: surface }), RANGE, ACTIVE);

      const wash = parseColor(soleFill(log).color);
      expect(wash?.r).toBe(wash?.g);
      expect(wash?.g).toBe(wash?.b);
    }
  });

  it('κρατά το ΜΕΤΡΗΜΕΝΟ ποσοστό — ένα νούμερο, από τη σταθερά, ποτέ δεύτερο κυριολεκτικό', () => {
    const log = createPaintLog();
    stampTableSelection(createRc(log, { surfaceHex: TABLE_PAPER_HEX }), RANGE, ACTIVE);

    expect(parseColor(soleFill(log).color)?.a).toBeCloseTo(TABLE_CELL_SELECTION.washAlpha, 4);
  });
});

// ── Το περίγραμμα της περιοχής ───────────────────────────────────────────────

describe('stampTableSelection — το περίγραμμα της περιοχής', () => {
  it('χαράζει ΕΝΑ συμπαγές περίγραμμα γύρω από ΟΛΗ την περιοχή — ποτέ γύρω από την τρύπα', () => {
    const log = createPaintLog();
    stampTableSelection(createRc(log), RANGE, ACTIVE);

    expect(log.strokes).toHaveLength(1);
    expect(log.strokes[0].dashPx).toEqual([]);
    expect(log.strokes[0].points).toEqual([
      { x: 10, y: 20 },
      { x: 50, y: 20 },
      { x: 50, y: 50 },
      { x: 10, y: 50 },
    ]);
  });

  it('🔴 πάχος 1 px — λεπταίνει ώστε να μην πνίγει τα «μυρμήγκια» που κάθονται στην ΙΔΙΑ διαδρομή', () => {
    const log = createPaintLog();
    stampTableSelection(createRc(log), RANGE, ACTIVE);

    // Ήταν 2 px (μετρημένο στο Excel) και **παράγωγο του δρομέα**. Άλλαξε με ρητό αίτημα του
    // ιδιοκτήτη (2026-08-05): αμέσως μετά το `Ctrl+C` η ίδια περιοχή είναι ταυτόχρονα
    // επιλεγμένη και αντιγραμμένη, οπότε αυτό το συμπαγές περίγραμμα και το marquee του §48
    // χαράζονται στην ίδια ακριβώς διαδρομή — το συμπαγές κέρδιζε και η κίνηση χανόταν.
    expect(log.strokes[0].lineWidth).toBe(1);

    // 🔴 Η ΠΡΟΣΤΑΣΙΑ ΠΟΥ ΔΕΝ ΧΑΝΕΤΑΙ: το 1 είναι **πάτωμα**, όχι προτίμηση. Κάθε μη ακέραιη
    // τιμή μοιράζεται σε ημιδιαφανείς σειρές pixel και δίνει θόλωμα αντί για λεπτή γραμμή —
    // έχει ήδη συμβεί μία φορά εδώ (ήταν 1,5). Το «όσο πιο λεπτό γίνεται» σταματά στο 1.
    expect(Number.isInteger(TABLE_CELL_SELECTION.outlineWidthPx)).toBe(true);
    expect(TABLE_CELL_SELECTION.outlineWidthPx).toBeGreaterThanOrEqual(1);

    // ⚠️ ΔΕΝ είναι πια παράγωγο του δρομέα — δηλωμένο, όχι σιωπηλό: σε επιλογή 1×1 τα δύο
    // ορθογώνια συμπίπτουν και πλέον **διαφέρουν** σε πάχος. Αν φανεί διπλή γραμμή εκεί, η
    // αιτία είναι αυτή, και αυτό το test είναι το σημείο που το λέει.
    expect(TABLE_CELL_SELECTION.outlineWidthPx).not.toBe(TABLE_CELL_CURSOR.lineWidthPx);
  });

  it('στο χρώμα δείκτη της εφαρμογής — αντιγράφουμε τον κανόνα του Excel, όχι το πράσινό του', () => {
    const log = createPaintLog();
    stampTableSelection(createRc(log), RANGE, ACTIVE);

    expect(log.strokes[0].color).toBe(TABLE_CELL_CURSOR.colorHex);
  });

  it('ΔΕΝ δέχεται το χρώμα φάσης — δείκτης διεπαφής, όχι κατάσταση οντότητας', () => {
    const log = createPaintLog();
    stampTableSelection(createRc(log, { phaseColor: '#ff00ff' }), RANGE, ACTIVE);

    expect(log.strokes[0].color).toBe(TABLE_CELL_CURSOR.colorHex);
    expect(soleFill(log).color).not.toBe('#ff00ff');
  });
});
