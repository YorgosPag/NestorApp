/**
 * @fileoverview ΚΟΙΝΟΣ ΔΙΕΡΜΗΝΕΑΣ ΕΚΦΡΑΣΕΩΝ MapLibre — **για άγκυρες που ΕΚΤΕΛΟΥΝ**.
 * @related ADR-777 §8.64 · §8.66 · lib/maps/metric-size.ts · lib/maps/listing-clusters.ts
 *
 * 🔴 **ΥΠΑΡΧΕΙ ΕΠΕΙΔΗ ΜΙΑ ΕΚΦΡΑΣΗ ΣΤΥΛ ΕΙΝΑΙ ΔΕΔΟΜΕΝΑ, ΟΧΙ ΚΩΔΙΚΑΣ.** Καμία σουίτα δεν
 * αποδίδει MapLibre — άρα μια άγκυρα που **συγκρίνει τη δομή** του πίνακα επαληθεύει
 * ότι *«γράψαμε αυτό που γράψαμε»*, ποτέ ότι *«βγάζει το σωστό νούμερο»*. Το ακριβότερο
 * μάθημα του §8.63 ήταν ακριβώς αυτό.
 *
 * 🔑 **ΚΑΙ ΖΕΙ ΕΔΩ, ΟΧΙ ΣΕ ΚΑΘΕ ΣΟΥΙΤΑ ΞΕΧΩΡΙΣΤΑ.** Ήταν γραμμένος μέσα στο
 * `metric-size.test.ts`· η δεύτερη σουίτα που τον χρειάστηκε *(τα συσσωματώματα)* θα
 * τον **αντέγραφε** — και το CHECK 3.28 θα είχε δίκιο να το μπλοκάρει. Δύο διερμηνείς
 * σημαίνει ότι η μέρα που θα διαφωνήσουν είναι μέρα που **και οι δύο** σουίτες είναι
 * πράσινες και **μία** από τις δύο λέει ψέματα.
 *
 * ⚠️ **ΔΕΝ είναι αρχείο test** *(δεν ταιριάζει στο `testMatch`, που απαιτεί `.test.`)*
 * και **δεν** είναι παραγωγικός κώδικας: είναι υποδομή αγκυρών.
 *
 * ⚠️ **Ο διερμηνέας ΦΩΝΑΖΕΙ εκεί που το MapLibre σιωπά** — άγνωστο `get` ή άγνωστος
 * τελεστής **πετά**. Είναι σκόπιμο: η βιβλιοθήκη θα έδινε `null` και θα άφηνε το
 * επίπεδο αζωγράφιστο, δηλαδή η μετάλλαξη «λάθος όνομα πεδίου» θα περνούσε **πράσινη**.
 */

export interface EvalContext {
  readonly zoom: number;
  readonly props: Readonly<Record<string, number>>;
}

export function evaluateExpression(expression: unknown, ctx: EvalContext): number {
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
export function findNestedZoom(expression: unknown, depth: number): boolean {
  if (!Array.isArray(expression)) return false;
  if (expression[0] === 'zoom' && depth > 1) return true;
  return expression.some((child) => findNestedZoom(child, depth + 1));
}

// ============================================================================
// ΣΤΑΘΕΡΕΣ ΤΟΥ ΣΕΝΑΡΙΟΥ
// ============================================================================

// ============================================================================
// Η ΜΗ ΑΡΙΘΜΗΤΙΚΗ ΠΛΕΥΡΑ — για ετικέτες και φίλτρα (ADR-777 §8.66)
// ============================================================================

/** Ό,τι μπορεί να επιστρέψει μια έκφραση στυλ, στο εύρος που μας αφορά. */
export type StyleValue = number | string | boolean | null;

/** Το feature όπως το βλέπει το φίλτρο: πεδία που **μπορεί να λείπουν**. */
export interface ValueContext {
  readonly zoom?: number;
  readonly props: Readonly<Record<string, StyleValue>>;
}

/**
 * **Ο διερμηνέας των ετικετών και των φίλτρων.**
 *
 * 🔴 **Χωριστός από το {@link evaluateExpression}, και ΟΧΙ επειδή ήταν ευκολότερο.**
 * Εκείνος απαντά *«πόσα pixel;»* και **οφείλει** να πετάει σε πεδίο που λείπει — είναι
 * η άγκυρα της μετάλλαξης «λάθος όνομα πεδίου» (§8.64). Αυτός απαντά *«τι γράφει η
 * ετικέτα;»* πάνω σε feature όπου το πεδίο που λείπει είναι **η κανονική περίπτωση**:
 * ένα συσσωμάτωμα **δεν έχει** `shape`, και ένα μεμονωμένο σημείο **δεν έχει**
 * `point_count`. Ένας κοινός διερμηνέας θα έπρεπε να διαλέξει μία από τις δύο
 * σημασιολογίες — δηλαδή να **ψευτίσει** για τη μισή του δουλειά.
 *
 * 🔑 Το `get` σε πεδίο που λείπει δίνει `null`, **ακριβώς όπως το MapLibre**.
 */
export function evaluateValue(expression: unknown, ctx: ValueContext): StyleValue {
  if (typeof expression !== 'object' || expression === null) {
    return expression as StyleValue;
  }
  if (!Array.isArray(expression)) {
    throw new Error(`μη αναγνωρίσιμο φύλλο: ${JSON.stringify(expression)}`);
  }

  const [operator, ...args] = expression as [string, ...unknown[]];
  const val = (a: unknown): StyleValue => evaluateValue(a, ctx);
  const num = (a: unknown): number => Number(val(a));

  switch (operator) {
    case 'zoom':
      if (ctx.zoom === undefined) throw new Error('το πλαίσιο δεν δηλώνει ζουμ');
      return ctx.zoom;
    case 'get': {
      const key = String(args[0]);
      return key in ctx.props ? ctx.props[key] : null;
    }
    case 'has':
      return String(args[0]) in ctx.props;
    case '!':
      return !val(args[0]);
    case 'all':
      return args.every((a) => Boolean(val(a)));
    case 'any':
      return args.some((a) => Boolean(val(a)));
    case '==':
      return val(args[0]) === val(args[1]);
    case '>':
      return num(args[0]) > num(args[1]);
    case '-':
      return num(args[0]) - num(args[1]);
    case '+':
      return args.reduce<number>((acc, a) => acc + num(a), 0);
    case 'to-string':
      return String(val(args[0]));
    case 'concat':
      return args.map((a) => String(val(a))).join('');
    case 'case':
      return evaluateCase(args, val);
    case 'step':
      return evaluateStep(args, val);
    default:
      throw new Error(`ο διερμηνέας τιμών δεν γνωρίζει τον τελεστή "${operator}"`);
  }
}

/** `['case', συνθήκη1, έξοδος1, …, εναλλακτική]` — ζεύγη, με **υποχρεωτική** εναλλακτική. */
function evaluateCase(args: readonly unknown[], val: (a: unknown) => StyleValue): StyleValue {
  if (args.length % 2 === 0) {
    // Χωρίς εναλλακτική, το MapLibre απορρίπτει το στυλ — εδώ φωνάζει η άγκυρα.
    throw new Error('το `case` απαιτεί τελική εναλλακτική (περιττό πλήθος ορισμάτων)');
  }
  for (let i = 0; i + 1 < args.length; i += 2) {
    if (val(args[i])) return val(args[i + 1]);
  }
  return val(args[args.length - 1]);
}

/** `['step', είσοδος, έξοδος₀, όριο₁, έξοδος₁, …]` — η **τελευταία** έξοδος που άνοιξε. */
function evaluateStep(args: readonly unknown[], val: (a: unknown) => StyleValue): StyleValue {
  const input = Number(val(args[0]));
  let result = val(args[1]);
  for (let i = 2; i + 1 < args.length; i += 2) {
    if (input >= Number(val(args[i]))) result = val(args[i + 1]);
    else break;
  }
  return result;
}
