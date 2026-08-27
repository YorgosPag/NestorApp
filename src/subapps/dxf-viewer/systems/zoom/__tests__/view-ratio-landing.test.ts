/**
 * ΑΓΚΥΡΑ — ADR-418: «διάλεξα 1:N· ΠΟΥ προσγειώθηκα;»
 *
 * Γιατί υπάρχει: το `view-scale.test.ts` επαλήθευε τα ΜΑΘΗΜΑΤΙΚΑ (`ratioToScale ↔ scaleToRatio`)
 * και ήταν πράσινο — ενώ το widget του ribbon ήταν σπασμένο επί μήνες. Κανείς δεν είχε γράψει
 * τεστ για την ερώτηση που κάνει ο άνθρωπος. Πράσινο που σήμαινε «κανείς δεν κοίταξε».
 *
 * Το περιστατικό: το `set-view-ratio` μετέτρεπε την ΑΠΟΛΥΤΗ κλίμακα σε *factor* και τον περνούσε
 * από τον δρόμο του ροδακιού, όπου το anti-fling clamp (`WHEEL_MAX_DELTA`) κόβει κάθε άλμα εκτός
 * [÷1.73, ×1.73]. Από 1:32 το «1:500» προσγειωνόταν στο 1:55 — και το ίδιο για 1:100 και 1:200,
 * και τα τρία στην ΙΔΙΑ τιμή, που είναι και η υπογραφή του κορεσμού.
 *
 * @see ../ZoomManager — zoomToRatio (ο ΕΝΑΣ απόλυτος δρόμος)
 * @see ../utils/calculations — wheelDeltaForFactor (ο δρόμος που ΔΕΝ κάνει για προορισμούς)
 */

import { ZoomManager } from '../ZoomManager';
import { computeWheelZoomFactor, wheelDeltaForFactor } from '../utils/calculations';
import { scaleToRatio, VIEW_SCALE_MENU_PRESETS } from '../../../utils/view-scale';
import type { ViewTransform } from '../../../rendering/types/Types';

const VIEWPORT = { width: 1200, height: 800 };

/** Η κλίμακα στην οποία ΠΡΑΓΜΑΤΙΚΑ προσγειώθηκε ο manager, διαβασμένη με το ίδιο SSoT με το UI. */
function landedRatio(transform: ViewTransform): number {
  return scaleToRatio({ scaleCss: transform.scale, sceneUnits: 'm' });
}

function managerAt(scale: number, offsetX = 0, offsetY = 0): ZoomManager {
  return new ZoomManager({ scale, offsetX, offsetY }, undefined, VIEWPORT);
}

describe('ADR-418 — η κλίμακα 1:N είναι ΠΡΟΟΡΙΣΜΟΣ, όχι βήμα', () => {
  // Αφετηρίες σε CSS px ανά μέτρο. Η 118 είναι το μετρημένο «1:32» του περιστατικού.
  const STARTS = [3779.5 /* 1:1 */, 118 /* ~1:32 */, 75.6 /* 1:50 */, 7.6 /* ~1:500 */];

  it.each(VIEW_SCALE_MENU_PRESETS)('προσγειώνεται ΑΚΡΙΒΩΣ στο 1:%s από κάθε αφετηρία', (presetN) => {
    for (const start of STARTS) {
      const zm = managerAt(start);
      const result = zm.zoomToRatio(presetN, 'm');
      // 0.5% ανοχή: μόνο για αριθμητικό θόρυβο διπλής ακρίβειας — ο κορεσμός αστοχεί κατά 10×.
      expect(landedRatio(result.transform)).toBeCloseTo(presetN, Math.max(0, 2 - Math.log10(presetN)));
      expect(Math.abs(landedRatio(result.transform) - presetN) / presetN).toBeLessThan(0.005);
    }
  });

  it('το ακραίο άλμα 1:1 → 1:500 φτάνει με ΜΙΑ κλήση (όχι σταδιακά)', () => {
    const zm = managerAt(3779.5);
    expect(landedRatio(zm.zoomToRatio(500, 'm').transform)).toBeCloseTo(500, 0);
  });

  it('είναι ταυτοδύναμο: δεύτερη κλήση στο ίδιο N δεν μετακινεί την κλίμακα', () => {
    const zm = managerAt(118);
    const once = zm.zoomToRatio(100, 'm').transform.scale;
    const twice = zm.zoomToRatio(100, 'm').transform.scale;
    expect(twice).toBeCloseTo(once, 10);
  });
});

describe('ΦΡΟΥΡΟΣ — ο δρόμος του ροδακιού ΔΕΝ μπορεί να εξυπηρετήσει προορισμό', () => {
  /**
   * Αυτό το group κοκκινίζει αν κάποιος ξαναδρομολογήσει την κλίμακα μέσα από τον
   * `wheelDeltaForFactor`. ΜΗΝ το «διορθώσεις» χαλαρώνοντας το κατώφλι: το ίδιο το γεγονός ότι
   * ο κορεσμός υπάρχει είναι ο λόγος που η κλίμακα ΔΕΝ περνά από εδώ.
   */
  it('κορένεται: τρεις διαφορετικοί στόχοι καταλήγουν στην ΙΔΙΑ κλίμακα', () => {
    const from = 32;
    const landed = [100, 200, 500].map((target) => {
      const requested = from / target;
      const delivered = computeWheelZoomFactor(wheelDeltaForFactor(requested));
      return from / delivered;
    });
    // Και οι τρεις πέφτουν στο ίδιο σημείο κορεσμού — η υπογραφή του σφάλματος.
    expect(landed[1]).toBeCloseTo(landed[0], 6);
    expect(landed[2]).toBeCloseTo(landed[0], 6);
    // ...και ΚΑΝΕΝΑΣ τους δεν είναι ο στόχος του.
    expect(landed[0]).toBeLessThan(60);
  });

  it('τιμά μόνο βήματα εντός του anti-fling εύρους (τα κουμπιά ±20% μένουν σωστά)', () => {
    expect(computeWheelZoomFactor(wheelDeltaForFactor(1.2))).toBeCloseTo(1.2, 10);
    expect(computeWheelZoomFactor(wheelDeltaForFactor(1 / 1.2))).toBeCloseTo(1 / 1.2, 10);
  });
});

describe('ADR-418 — ο ZoomManager χτίζει πάνω στη ΖΩΝΤΑΝΗ κατάσταση, όχι σε αντίγραφο', () => {
  it('βλέπει ένα pan που γράφτηκε ΕΞΩ από αυτόν', () => {
    // Ο κάτοχος (useZoom) δίνει getter· εδώ τον παίζει ένα κελί που το «pan» μεταλλάσσει.
    let live: ViewTransform = { scale: 100, offsetX: 0, offsetY: 0 };
    const zm = new ZoomManager({ ...live }, undefined, VIEWPORT, () => live);

    // Το pan γράφει κατευθείαν στο SSoT (useCentralizedMouseHandlers → onTransformChange).
    live = { scale: 100, offsetX: 640, offsetY: -220 };

    const after = zm.zoomToRatio(50, 'm').transform;

    // Χωρίς τον getter, η βάση θα ήταν offset 0 και το αποτέλεσμα θα κουβαλούσε το ΠΑΛΙΟ κέντρο.
    const staleManager = new ZoomManager({ scale: 100, offsetX: 0, offsetY: 0 }, undefined, VIEWPORT);
    const stale = staleManager.zoomToRatio(50, 'm').transform;

    expect(after.offsetX).not.toBeCloseTo(stale.offsetX, 3);
    // Η κλίμακα είναι προορισμός και στις δύο περιπτώσεις — μόνο η ΑΓΚΥΡΩΣΗ διέφερε.
    expect(after.scale).toBeCloseTo(stale.scale, 10);
  });

  it('χωρίς getter κρατά την παλιά συμπεριφορά (καμία ρήξη για τους υπάρχοντες καλούντες)', () => {
    const zm = managerAt(100, 15, 25);
    expect(zm.getCurrentTransform()).toEqual({ scale: 100, offsetX: 15, offsetY: 25 });
  });

  it('αγνοεί getter που επιστρέφει σκουπίδια (αμυντικό — δεν δηλητηριάζεται η βάση)', () => {
    const poison = { scale: NaN, offsetX: 0, offsetY: 0 } as ViewTransform;
    const zm = new ZoomManager({ scale: 100, offsetX: 7, offsetY: 9 }, undefined, VIEWPORT, () => poison);
    expect(zm.getCurrentTransform()).toEqual({ scale: 100, offsetX: 7, offsetY: 9 });
  });
});
