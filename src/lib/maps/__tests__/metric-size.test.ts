/**
 * @fileoverview ΑΓΚΥΡΕΣ — **η αβεβαιότητα ζωγραφίζεται σε μέτρα, όχι σε pixel**.
 * @related ADR-777 §8.64 · lib/maps/metric-size.ts · CHECK 3.54 (άγκυρα που ΕΚΤΕΛΕΙ)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ **ΔΙΕΡΜΗΝΕΑΣ** ΕΔΩ ΜΕΣΑ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΥΠΕΡΒΟΛΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μια έκφραση στυλ MapLibre είναι **δεδομένα που εκτελεί ο χάρτης** — και το
 * ακριβότερο μάθημα του Βήματος 3 ήταν ότι **καμία σουίτα δεν αποδίδει MapLibre**:
 * με 32/32 μεταλλάξεις πράσινες, η οθόνη αποκάλυψε δύο ελαττώματα ακριβώς σε αυτό το
 * σύνορο. Ένα test που έλεγχε μόνο *«η συνάρτηση επιστρέφει πίνακα»* θα ήταν σχόλιο
 * μεταμφιεσμένο σε άγκυρα.
 *
 * ⇒ Εδώ η έκφραση **εκτελείται**: ο διερμηνέας υλοποιεί τους πέντε τελεστές που
 * χρησιμοποιούμε με τη σημασιολογία της προδιαγραφής, και συγκρίνει το αποτέλεσμα με
 * την **ανεξάρτητη** αριθμητική του `metersToPixels`. Δύο δρόμοι προς τον ίδιο
 * αριθμό — αν αποκλίνουν, κάτι έσπασε.
 *
 * ⚠️ **Ο διερμηνέας ΔΕΝ είναι δεύτερη υλοποίηση του προϊόντος.** Είναι το *αντίθετο*
 * της παραγωγής: η παραγωγή **παράγει** έκφραση, αυτός τη **διαβάζει**. Ένα σφάλμα
 * που εμφανιζόταν και στα δύο θα έπρεπε να είναι ταυτόχρονα σφάλμα κατασκευής και
 * σφάλμα ανάγνωσης του **ίδιου** προτύπου.
 */

import {
  mercatorScaleAt,
  metersToPixels,
  metricCircleRadius,
  METERS_PER_PIXEL_AT_ZOOM_0,
  METRIC_SIZE_MAX_ZOOM,
  WEB_MERCATOR_MAX_LATITUDE,
} from '../metric-size';

// ============================================================================
// Ο ΔΙΕΡΜΗΝΕΑΣ — η προδιαγραφή MapLibre, στους τελεστές που χρησιμοποιούμε
// ============================================================================

interface EvalContext {
  readonly zoom: number;
  readonly props: Readonly<Record<string, number>>;
}

function evaluateExpression(expression: unknown, ctx: EvalContext): number {
  if (typeof expression === 'number') return expression;
  if (!Array.isArray(expression)) {
    throw new Error(`μη αριθμητικό φύλλο: ${JSON.stringify(expression)}`);
  }

  const [operator, ...args] = expression as [string, ...unknown[]];

  switch (operator) {
    case 'zoom':
      return ctx.zoom;

    case 'get': {
      const key = args[0];
      if (typeof key !== 'string' || !(key in ctx.props)) {
        // 🔴 Αυτό το `throw` είναι η άγκυρα για τη μετάλλαξη «λάθος όνομα πεδίου».
        //    Το ΙΔΙΟ το MapLibre θα σιωπούσε: άγνωστο `get` δίνει `null`, το επίπεδο
        //    μένει αζωγράφιστο, και κανένα σφάλμα δεν φτάνει σε άνθρωπο.
        throw new Error(`το feature δεν έχει πεδίο "${String(key)}"`);
      }
      return ctx.props[key];
    }

    case '*':
      return args.reduce<number>((acc, arg) => acc * evaluateExpression(arg, ctx), 1);

    case 'min':
      return Math.min(...args.map((arg) => evaluateExpression(arg, ctx)));

    case 'max':
      return Math.max(...args.map((arg) => evaluateExpression(arg, ctx)));

    case 'interpolate':
      return evaluateInterpolate(args, ctx);

    default:
      throw new Error(`ο διερμηνέας δεν γνωρίζει τον τελεστή "${operator}"`);
  }
}

/** `['interpolate', ['exponential', base], input, ...ζεύγη]` — κατά την προδιαγραφή. */
function evaluateInterpolate(args: readonly unknown[], ctx: EvalContext): number {
  const [interpolation, input, ...flatStops] = args;
  if (!Array.isArray(interpolation) || interpolation[0] !== 'exponential') {
    throw new Error('η άγκυρα καλύπτει μόνο εκθετική παρεμβολή');
  }
  const base = interpolation[1] as number;
  const x = evaluateExpression(input, ctx);

  const inputs: number[] = [];
  const outputs: unknown[] = [];
  for (let i = 0; i < flatStops.length; i += 2) {
    inputs.push(flatStops[i] as number);
    outputs.push(flatStops[i + 1]);
  }

  if (x <= inputs[0]) return evaluateExpression(outputs[0], ctx);
  const last = inputs.length - 1;
  if (x >= inputs[last]) return evaluateExpression(outputs[last], ctx);

  let k = 0;
  while (k < last && inputs[k + 1] <= x) k += 1;

  const lower = evaluateExpression(outputs[k], ctx);
  const upper = evaluateExpression(outputs[k + 1], ctx);
  const span = inputs[k + 1] - inputs[k];
  const t = (base ** (x - inputs[k]) - 1) / (base ** span - 1);
  return lower + t * (upper - lower);
}

/** Ψάχνει `['zoom']` **κάτω** από το πρώτο επίπεδο — η απαγόρευση της προδιαγραφής. */
function findNestedZoom(expression: unknown, depth: number): boolean {
  if (!Array.isArray(expression)) return false;
  if (expression[0] === 'zoom' && depth > 1) return true;
  return expression.some((child) => findNestedZoom(child, depth + 1));
}

// ============================================================================
// ΣΤΑΘΕΡΕΣ ΤΟΥ ΣΕΝΑΡΙΟΥ
// ============================================================================

const METERS = 'uncertaintyM';
const SCALE = 'mercatorScale';
const MIN_PX = 12;
const MAX_PX = 3000;

/** ⚠️ **Όχι 1,5 χλμ και όχι 10**: δεν συμπίπτει με κανένα δηλωμένο σκαλί αβεβαιότητας,
 *  ώστε ένα `.slice()` ή μια σύγχυση πίνακα να μη γίνει πράσινο πάνω στο ελάττωμα. */
const SAMPLE_METERS = 2_300;
/** Αθήνα — και **όχι** 0°, όπου ο συντελεστής Mercator είναι ακριβώς `1` και άρα αόρατος. */
const SAMPLE_LATITUDE = 37.9838;

function radiusExpression() {
  return metricCircleRadius({
    metersProperty: METERS,
    scaleProperty: SCALE,
    minPx: MIN_PX,
    maxPx: MAX_PX,
  });
}

function contextAt(zoom: number, meters = SAMPLE_METERS, latitude = SAMPLE_LATITUDE): EvalContext {
  return { zoom, props: { [METERS]: meters, [SCALE]: mercatorScaleAt(latitude) } };
}

// ============================================================================
// Κ1 — Ο ΣΥΝΤΕΛΕΣΤΗΣ MERCATOR
// ============================================================================

describe('Κ1 — ο συντελεστής παραμόρφωσης', () => {
  it('στον ισημερινό δεν παραμορφώνει', () => {
    expect(mercatorScaleAt(0)).toBeCloseTo(1, 12);
  });

  it('στις 60° διπλασιάζει — η τιμή που ξέρει κανείς απ᾽ έξω', () => {
    expect(mercatorScaleAt(60)).toBeCloseTo(2, 10);
  });

  it('στην Αθήνα υποτιμούσαμε την αβεβαιότητα κατά ~21%', () => {
    const scale = mercatorScaleAt(SAMPLE_LATITUDE);
    expect(scale).toBeCloseTo(1.2688, 3);
    // Χωρίς τη διόρθωση, ο κύκλος ζωγραφιζόταν στο `1/scale` του σωστού.
    expect(1 - 1 / scale).toBeGreaterThan(0.2);
  });

  it('είναι συμμετρικός ως προς τον ισημερινό', () => {
    expect(mercatorScaleAt(-SAMPLE_LATITUDE)).toBeCloseTo(mercatorScaleAt(SAMPLE_LATITUDE), 12);
  });

  it('ψαλιδίζεται στο όριο της προβολής αντί να απειρίζεται', () => {
    const atLimit = mercatorScaleAt(WEB_MERCATOR_MAX_LATITUDE);
    expect(mercatorScaleAt(89.9)).toBe(atLimit);
    expect(Number.isFinite(mercatorScaleAt(90))).toBe(true);
  });
});

// ============================================================================
// Κ2 — Η ΑΝΕΞΑΡΤΗΤΗ ΑΡΙΘΜΗΤΙΚΗ
// ============================================================================

describe('Κ2 — μέτρα σε pixel', () => {
  it('στο ζουμ 0 και στον ισημερινό, μία πλάκα είναι ο μισός κόσμος', () => {
    expect(metersToPixels(METERS_PER_PIXEL_AT_ZOOM_0, 0, 0)).toBeCloseTo(1, 9);
  });

  it('κάθε βαθμός ζουμ διπλασιάζει', () => {
    const at10 = metersToPixels(SAMPLE_METERS, 10, SAMPLE_LATITUDE);
    const at11 = metersToPixels(SAMPLE_METERS, 11, SAMPLE_LATITUDE);
    expect(at11 / at10).toBeCloseTo(2, 9);
  });

  it('η πλάκα των 512 είναι μέσα στη σταθερά — 256 θα έδινε τα διπλάσια', () => {
    expect(METERS_PER_PIXEL_AT_ZOOM_0).toBeCloseTo(78_271.5, 1);
  });
});

// ============================================================================
// Κ3 — Η ΕΚΦΡΑΣΗ ΕΙΝΑΙ ΔΟΜΙΚΑ ΝΟΜΙΜΗ  🔴 Η ΚΡΙΣΙΜΗ ΟΜΑΔΑ
// ============================================================================

describe('Κ3 — το ["zoom"] ζει ΜΟΝΟ στην κορυφή', () => {
  it('η εξωτερική έκφραση είναι interpolate με είσοδο το ζουμ', () => {
    const expression = radiusExpression() as unknown[];
    expect(expression[0]).toBe('interpolate');
    expect(expression[1]).toEqual(['exponential', 2]);
    expect(expression[2]).toEqual(['zoom']);
  });

  it('κανένα ["zoom"] δεν είναι φωλιασμένο βαθύτερα', () => {
    // 🔴 Η προδιαγραφή: «σε ιδιότητες layout ή paint, το ["zoom"] μπορεί να εμφανιστεί
    //    ΜΟΝΟ ως είσοδος εξωτερικής interpolate ή step». Φωλιασμένο, το MapLibre
    //    απορρίπτει το στυλ ΣΙΩΠΗΛΑ — το επίπεδο απλώς δεν ζωγραφίζεται.
    expect(findNestedZoom(radiusExpression(), 0)).toBe(false);
  });

  it('υπάρχει στάσιμο σε ΚΑΘΕ ακέραιο ζουμ — αλλιώς το ψαλίδι παραμορφώνει', () => {
    const expression = radiusExpression() as unknown[];
    const stopInputs = expression.slice(3).filter((_, index) => index % 2 === 0);
    expect(stopInputs).toEqual(
      Array.from({ length: METRIC_SIZE_MAX_ZOOM + 1 }, (_unused, zoom) => zoom)
    );
  });

  it('ζητά ΤΑ ΠΕΔΙΑ ΤΟΥ FEATURE, όχι σταθερές του επιπέδου', () => {
    const serialised = JSON.stringify(radiusExpression());
    expect(serialised).toContain(`["get","${METERS}"]`);
    expect(serialised).toContain(`["get","${SCALE}"]`);
  });
});

// ============================================================================
// Κ4 — Η ΕΚΤΕΛΕΣΗ ΣΥΜΦΩΝΕΙ ΜΕ ΤΗΝ ΑΡΙΘΜΗΤΙΚΗ  🔴 Η ΚΡΙΣΙΜΗ ΟΜΑΔΑ
// ============================================================================

describe('Κ4 — η έκφραση, εκτελεσμένη, δίνει τα ίδια μέτρα', () => {
  // Ζουμ **μη ακέραια** επίτηδες: εκεί ζει η παρεμβολή. Σε ακέραια θα διαβαζόταν
  // απευθείας το στάσιμο και το τεστ θα ήταν τυφλό στον τύπο της παρεμβολής.
  //
  // 🔴 **ΚΑΙ ΜΕΣΑ ΣΤΗ ΖΩΝΗ ΟΠΟΥ ΤΟ ΨΑΛΙΔΙ ΔΕΝ ΜΙΛΑΕΙ — ΤΟ ΕΜΑΘΑ ΓΡΑΦΟΝΤΑΣ ΤΟ.**
  //    Η πρώτη γραφή δειγμάτιζε `6.5` και `16.9`, όπου η αλήθεια είναι `3,4 px` και
  //    `4 559 px`: **έξω** από τα όρια `[12, 3000]`. Το test κοκκίνισε πάνω σε **σωστό
  //    κώδικα**, γιατί ζητούσε από τον ψαλιδισμένο κύκλο να είναι απσαλίδιστος.
  //    Ο φρουρός από κάτω κάνει αυτό το λάθος **αδύνατο να ξαναγίνει σιωπηλά**: αν
  //    κάποιος σφίξει τα όρια, το test θα πει *«το δείγμα βγήκε από τη ζώνη»* αντί να
  //    καταγγείλει τον τύπο της παρεμβολής.
  it.each([9.25, 11.7, 13.4, 14.33, 15.8])('ζουμ %s', (zoom) => {
    const expected = metersToPixels(SAMPLE_METERS, zoom, SAMPLE_LATITUDE);

    expect(expected).toBeGreaterThan(MIN_PX);
    expect(expected).toBeLessThan(MAX_PX);

    expect(evaluateExpression(radiusExpression(), contextAt(zoom))).toBeCloseTo(expected, 6);
  });

  it('δύο αγγελίες σε ΔΙΑΦΟΡΕΤΙΚΟ πλάτος παίρνουν διαφορετική ακτίνα στο ΙΔΙΟ ζουμ', () => {
    // 🏆 Αυτό ακριβώς δηλώνει αδύνατο η MapLibre με `global-state`: μία τιμή για όλους.
    const athens = evaluateExpression(radiusExpression(), contextAt(13, SAMPLE_METERS, 37.9838));
    const thessaloniki = evaluateExpression(radiusExpression(), contextAt(13, SAMPLE_METERS, 40.64));
    expect(thessaloniki).toBeGreaterThan(athens);
    expect(thessaloniki / athens).toBeCloseTo(mercatorScaleAt(40.64) / mercatorScaleAt(37.9838), 6);
  });

  it('διπλάσια αβεβαιότητα ⇒ διπλάσια ακτίνα, στο ίδιο ζουμ', () => {
    const single = evaluateExpression(radiusExpression(), contextAt(13, SAMPLE_METERS));
    const double = evaluateExpression(radiusExpression(), contextAt(13, SAMPLE_METERS * 2));
    expect(double / single).toBeCloseTo(2, 6);
  });

  it('λάθος όνομα πεδίου ΔΕΝ περνά σιωπηλά', () => {
    const wrongKeys: EvalContext = { zoom: 13, props: { metres: 1, scale: 1 } };
    expect(() => evaluateExpression(radiusExpression(), wrongKeys)).toThrow(/δεν έχει πεδίο/);
  });
});

// ============================================================================
// Κ5 — ΤΟ ΨΑΛΙΔΙ
// ============================================================================

describe('Κ5 — ο ισχυρισμός ούτε εξαφανίζεται ούτε σπάει', () => {
  it('σε ζουμ χώρας δεν πέφτει κάτω από το κατώφλι ορατότητας', () => {
    const raw = metersToPixels(SAMPLE_METERS, 5, SAMPLE_LATITUDE);
    expect(raw).toBeLessThan(MIN_PX);
    expect(evaluateExpression(radiusExpression(), contextAt(5))).toBe(MIN_PX);
  });

  it('σε ζουμ δρόμου δεν ξεπερνά το όριο απόδοσης', () => {
    const raw = metersToPixels(SAMPLE_METERS, 20, SAMPLE_LATITUDE);
    expect(raw).toBeGreaterThan(MAX_PX);
    expect(evaluateExpression(radiusExpression(), contextAt(20))).toBe(MAX_PX);
  });

  it('🔴 ΤΟ ΨΑΛΙΔΙ ΕΦΑΡΜΟΖΕΤΑΙ ΣΤΗΝ ΤΙΜΗ, ΟΧΙ ΣΤΑ ΑΚΡΑ ΤΗΣ ΠΑΡΕΜΒΟΛΗΣ', () => {
    // Με δύο μόνο στάσιμα (0 και 24) η παρεμβολή θα γινόταν ανάμεσα σε ψαλιδισμένο
    // `min` και ψαλιδισμένο `max`, και το ενδιάμεσο ζουμ θα έβγαινε **τετραπλάσια
    // λάθος**. Το ελάττωμα είναι σιωπηλό: η οθόνη δείχνει κύκλο, απλώς λάθος κύκλο.
    const zoom = 10;
    const truth = metersToPixels(SAMPLE_METERS, zoom, SAMPLE_LATITUDE);
    expect(truth).toBeGreaterThan(MIN_PX);
    expect(truth).toBeLessThan(MAX_PX);

    const actual = evaluateExpression(radiusExpression(), contextAt(zoom));
    expect(actual).toBeCloseTo(truth, 6);
    expect(actual).toBeGreaterThan(MIN_PX * 2);
  });

  it('μηδενική αβεβαιότητα δίνει το κατώφλι, όχι μηδέν — και δεν σκάει', () => {
    expect(evaluateExpression(radiusExpression(), contextAt(13, 0))).toBe(MIN_PX);
  });
});
