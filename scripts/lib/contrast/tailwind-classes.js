/**
 * Η **γραμματική** μιας κλάσης Tailwind που κουβαλά χρώμα — χωρίς καμία γνώση για το
 * ποια χρώματα υπάρχουν.
 *
 * ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΟΝ RESOLVER: ο resolver φορτώνει το πραγματικό
 * `tailwind.config.ts` (μετρημένο **303ms**: 228 require + 52 loadConfig + 23 resolve).
 * Το CHECK 3.26 χρειάζεται **μόνο** το λεξιλόγιο των utilities και τρέχει σε κάθε
 * commit — δεν επιτρέπεται να πληρώνει αυτό το κόστος για μια σταθερά. Δύο επίπεδα:
 * εδώ η γραμματική (μηδέν εξαρτήσεις), δίπλα η αυθεντία των τιμών.
 *
 * ⚠️ ΤΟ `COLOR_UTILITIES` ΕΙΝΑΙ SSoT — καταναλώνεται από **δύο** πύλες (3.26 και 3.42).
 * Ήταν σκληροκωδικοποιημένο και στις δύο· δύο αντίγραφα του ίδιου λεξιλογίου είναι
 * ακριβώς το σχήμα που το ADR-749 αποσυναρμολόγησε. Αν προσθέσεις utility εδώ, **και οι
 * δύο** πύλες αρχίζουν να το βλέπουν — αυτό είναι το ζητούμενο, όχι παρενέργεια.
 *
 * @module scripts/lib/contrast/tailwind-classes
 */

'use strict';

/**
 * Οι utilities που παίρνουν **χρώμα** ως τιμή (ADR-365 §3.2 — το ίδιο σύνολο που
 * φρουρεί το CHECK 3.26).
 */
const COLOR_UTILITIES = ['bg', 'text', 'border', 'ring', 'fill', 'stroke'];

/**
 * Στάσεις διαβάθμισης. Παίρνουν χρώμα, αλλά μια διαβάθμιση **δεν έχει ένα χρώμα** —
 * έχει τουλάχιστον δύο και ό,τι υπάρχει ανάμεσά τους. Αναγνωρίζονται ώστε να
 * **ονομάζονται** εκτός εμβέλειας, όχι για να κριθούν: το «αλλάζει η ετυμηγορία;»
 * προϋποθέτει **μία** ετυμηγορία.
 */
const GRADIENT_STOPS = ['from', 'via', 'to'];

/** Το `border` δέχεται κατευθυντικό ένθεμα (`border-l-red-500`). */
const DIRECTIONAL_UTILITIES = new Set(['border', 'divide']);
const DIRECTION_INFIX = /^([lrtbxyse])-/;

/**
 * Σπάσε `dark:hover:bg-red-500` σε παραλλαγές + utility.
 *
 * ⚠️ ΜΕ ΕΠΙΓΝΩΣΗ ΑΓΚΥΛΩΝ, ΟΧΙ `split(':')`. Το `supports-[display:grid]:bg-card` και το
 * `data-[state=checked]:bg-primary` έχουν παραλλαγές που **περιέχουν** τον διαχωριστή.
 * Ένα `split(':')` τα κόβει στη μέση και γεννά utility «grid]` — δηλαδή φάντασμα, το
 * ίδιο σχήμα με το `parseConstArray` του ADR-752.
 */
function splitVariants(token) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth = Math.max(0, depth - 1);
    else if (c === ':' && depth === 0) {
      parts.push(token.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(token.slice(start));
  const utility = parts.pop();
  return { variants: parts, utility };
}

/**
 * Ξεχώρισε τον τροποποιητή διαφάνειας (`/30`, `/[0.06]`) από τη βάση.
 *
 * ⚠️ Η αυθαίρετη τιμή μπορεί να **περιέχει** κάθετο: `bg-[rgb(0_0_0/0.5)]`. Γι' αυτό ο
 * τροποποιητής αναζητείται **μετά** το κλείσιμο της αγκύλης, ποτέ με `lastIndexOf` σε
 * ολόκληρη τη συμβολοσειρά.
 */
function splitOpacity(value) {
  let idx = -1;
  if (value.startsWith('[')) {
    let depth = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] === '[') depth++;
      else if (value[i] === ']') {
        depth--;
        if (depth === 0) { idx = value.indexOf('/', i); break; }
      }
    }
  } else {
    idx = value.lastIndexOf('/');
  }
  if (idx < 0) return { base: value, alpha: 1 };

  const modifier = value.slice(idx + 1);
  const arbitrary = /^\[([\d.]+)\]$/.exec(modifier);
  const percent = /^(\d{1,3})$/.exec(modifier);
  if (!arbitrary && !percent) return { base: value, alpha: 1 };

  const alpha = arbitrary ? parseFloat(arbitrary[1]) : parseFloat(percent[1]) / 100;
  if (!Number.isFinite(alpha)) return { base: value, alpha: 1 };
  return { base: value.slice(0, idx), alpha: Math.min(1, Math.max(0, alpha)) };
}

/**
 * Ανάλυσε ΕΝΑ λεκτικό κλάσης. Επιστρέφει `null` όταν δεν είναι utility χρώματος —
 * `rounded-md`, `flex`, `p-4` δεν είναι ευρήματα, είναι **άλλο πράγμα**.
 *
 * @returns {{variants:string[], dark:boolean, util:string, value:string, alpha:number, gradient:boolean}|null}
 */
function parseColorUtility(rawToken) {
  const token = String(rawToken).replace(/^!+/, '');
  const { variants, utility } = splitVariants(token);
  const dash = utility.indexOf('-');
  if (dash < 0) return null;

  const util = utility.slice(0, dash);
  const isColorUtil = COLOR_UTILITIES.includes(util);
  const isGradient = GRADIENT_STOPS.includes(util);
  if (!isColorUtil && !isGradient) return null;

  let value = utility.slice(dash + 1);
  if (DIRECTIONAL_UTILITIES.has(util)) value = value.replace(DIRECTION_INFIX, '');

  const { base, alpha } = splitOpacity(value);
  return {
    variants,
    dark: variants.includes('dark'),
    util,
    value: base,
    alpha,
    gradient: isGradient,
  };
}

/** Τα λεκτικά μιας συμβολοσειράς κλάσεων, χωρίς κενά. */
const tokenize = (raw) => String(raw).trim().split(/\s+/).filter(Boolean);

module.exports = {
  COLOR_UTILITIES,
  GRADIENT_STOPS,
  splitVariants,
  splitOpacity,
  parseColorUtility,
  tokenize,
};
