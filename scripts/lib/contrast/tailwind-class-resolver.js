/**
 * Λύνει μια **κλάση Tailwind** σε χρώμα — και, κυρίως, απαντά αν το χρώμα αυτό είναι
 * **θεματικό** ή σταθερό.
 *
 * 🔑 ΚΑΜΙΑ ΧΑΡΤΟΓΡΑΦΗΣΗ «ΚΛΙΜΑΚΑ → HEX» ΔΕΝ ΓΡΑΦΤΗΚΕ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΣΗΜΕΙΟ.
 * Η προφανής υλοποίηση θα αντέγραφε τις 22 παλέτες × 11 σκαλιά σε έναν πίνακα — μια
 * **δεύτερη αλήθεια** που θα απέκλινε από το build την πρώτη φορά που κάποιος αγγίξει
 * το `tailwind.config.ts`. Αντ' αυτού ρωτάμε το **ίδιο το Tailwind**, με τον ίδιο
 * φορτωτή που χρησιμοποιεί ο compiler:
 *
 *     loadConfig('tailwind.config.ts') → resolveConfig() → theme.colors
 *
 * Έτσι η ίδια κλήση απαντά **και τα δύο** ερωτήματα:
 *   `slate-900` → `"#0f172a"`             σταθερό hex  ⇒ ΜΟΝΟΘΕΜΑΤΙΚΟ
 *   `primary`   → `"hsl(var(--primary))"` αναφορά      ⇒ ΘΕΜΑΤΙΚΟ
 *
 * Επαληθεύτηκε με εκτέλεση (tailwindcss 3.4.19): το `tailwind.config.ts` χρησιμοποιεί
 * `theme.extend`, άρα η προεπιλεγμένη παλέτα μένει **ακέραιη** και τα σημασιολογικά
 * ονόματα προστίθενται. Αν κάποιος αύριο κάνει override το `slate`, αυτός ο κώδικας
 * **το μαθαίνει δωρεάν** — ένας πίνακας δεν θα το μάθαινε ποτέ.
 *
 * ⚠️ Ο ΡΟΛΟΣ ΔΕΝ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟ ΠΡΟΘΕΜΑ. Μπαίνει στον πειρασμό κανείς να πει «το
 * `text-` σημαίνει κείμενο» — και τότε το `file-icons.ts` (57 κλάσεις για τύπους
 * αρχείων) και τα `debugBlue`/`debugRed` γίνονται 100+ ψευδώς θετικά, γιατί ένα
 * **κατηγορικό** χρώμα ταυτότητας δεν οφείλει να είναι θεματικό. Ο ρόλος βγαίνει από
 * το **μονοπάτι** (`classifyRole`), όπως στο CHECK 3.39 — το πρόθεμα είναι μέρος της
 * **τιμής**, όχι της δήλωσης.
 *
 * @module scripts/lib/contrast/tailwind-class-resolver
 */

'use strict';

const path = require('path');
const { hslToRgb, parseHslToken, parseComputedColor, toHex } = require('./wcag-contrast');
const { parseColorUtility, tokenize } = require('./tailwind-classes');

const TAILWIND_CONFIG = 'tailwind.config.ts';

/** Το φόρτωμα κοστίζει ~300ms· γίνεται μία φορά ανά ρίζα. */
const paletteCache = new Map();

/**
 * Η παλέτα του **έργου**, όπως τη βλέπει ο compiler.
 *
 * Fail-closed: αν το config δεν φορτώνεται, η πύλη **σκάει**. Μια πύλη χρωμάτων που
 * δεν ξέρει τα χρώματα δεν επιτρέπεται να αναφέρει «καθαρό» — είναι κυριολεκτικά το
 * σχήμα «0 = κανείς δεν κοίταξε» που αυτό το έργο έχει συναντήσει εννέα φορές.
 */
function loadTailwindColors(repoRoot = process.cwd()) {
  const key = path.resolve(repoRoot);
  if (paletteCache.has(key)) return paletteCache.get(key);

  const configPath = path.join(key, TAILWIND_CONFIG);
  let colors;
  try {
    // Ο ΙΔΙΟΣ φορτωτής που χρησιμοποιεί το Tailwind για TS configs (jiti).
    // ⚠️ Η επίλυση ψάχνει ΠΡΩΤΑ στη ρίζα που δόθηκε και μετά δίπλα σε αυτό το αρχείο:
    // με pnpm το πακέτο ζει σε symlink store, και ένα μίνι-repo των tests δεν έχει
    // δικό του `node_modules`. Ένα σκέτο `path.join(root, 'node_modules/…')` θα
    // έσκαγε εκεί — δηλαδή η πύλη θα ήταν αδοκίμαστη ακριβώς όπου δοκιμάζεται.
    const from = { paths: [key, __dirname] };
    const loadConfig = require(require.resolve('tailwindcss/loadConfig', from));
    const resolveConfig = require(require.resolve('tailwindcss/resolveConfig', from));
    colors = resolveConfig(loadConfig(configPath)).theme.colors;
  } catch (e) {
    throw new Error(
      `tailwind-class-resolver: αδύνατη η ανάγνωση του ${TAILWIND_CONFIG} (${e.message}) — fail-closed.`,
    );
  }
  if (!colors || typeof colors !== 'object') {
    throw new Error(`tailwind-class-resolver: το ${TAILWIND_CONFIG} δεν έδωσε theme.colors — fail-closed.`);
  }

  const result = { colors, source: TAILWIND_CONFIG };
  paletteCache.set(key, result);
  return result;
}

/** `{DEFAULT: x}` → `x`. Ένα κλαδί χωρίς `DEFAULT` δεν είναι χρώμα από μόνο του. */
function normalizeNode(node) {
  if (typeof node === 'string') return node;
  if (node && typeof node === 'object' && typeof node.DEFAULT === 'string') return node.DEFAULT;
  return null;
}

/**
 * Βρες την τιμή ενός ονόματος χρώματος στο δέντρο του theme.
 *
 * ⚠️ Η ΑΝΑΖΗΤΗΣΗ ΠΑΕΙ ΑΠΟ ΤΟ **ΜΑΚΡΥΤΕΡΟ** ΠΡΟΘΕΜΑ ΠΡΟΣ ΤΟ ΚΟΝΤΟΤΕΡΟ, γιατί τα κλειδιά
 * του **ίδιου** αυτού config περιέχουν παύλες: `bg-enterprise-success` είναι
 * `colors['bg-enterprise'].success`, όχι `colors.bg['enterprise-success']`. Ένα σκέτο
 * `split('-')` θα αστοχούσε σε 14 σημασιολογικές επιφάνειες που **υπάρχουν**.
 *
 * @returns {{value:string|null, familyKnown:boolean}} `familyKnown` = υπάρχει η
 *   οικογένεια αλλά όχι το σκαλί ⇒ η κλάση **δεν παράγει CSS** (περιστατικό `green-707`).
 */
function lookupColor(colors, name) {
  let familyKnown = false;

  /**
   * ⚠️ ΑΝΑΔΡΟΜΙΚΑ, ΟΧΙ ΔΥΟ ΕΠΙΠΕΔΩΝ. Η πρώτη εκδοχή έσπαγε το όνομα **μία** φορά σε
   * κεφαλή/ουρά και αστοχούσε στο `performance-success-bg`
   * (= `colors.performance.success.bg`), γυρίζοντας `not-a-color` για μια κλάση που
   * **υπάρχει**. Το Tailwind ισοπεδώνει **αυθαίρετο** βάθος· η αναζήτηση οφείλει το ίδιο.
   */
  const walk = (node, rest) => {
    if (typeof node === 'string') return rest === '' ? node : null;
    if (!node || typeof node !== 'object') return null;
    if (rest === '') return normalizeNode(node);

    if (Object.prototype.hasOwnProperty.call(node, rest)) {
      const direct = normalizeNode(node[rest]);
      if (direct !== null) return direct;
    }
    for (let i = rest.length - 1; i >= 0; i--) {
      if (rest[i] !== '-') continue;
      const head = rest.slice(0, i);
      if (!Object.prototype.hasOwnProperty.call(node, head)) continue;
      familyKnown = true;
      const found = walk(node[head], rest.slice(i + 1));
      if (found !== null) return found;
    }
    return null;
  };

  const value = walk(colors, name);
  if (value !== null || Object.prototype.hasOwnProperty.call(colors, name)) familyKnown = true;
  return { value, familyKnown };
}

const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const VAR_RE = /var\(\s*(--[a-z0-9-]+)/i;

/**
 * Λέξεις-κλειδιά χρώματος. **Δεν** είναι «όχι χρώμα» — είναι χρώμα για το οποίο **καμία
 * ετυμηγορία αντίθεσης δεν είναι δυνατή**: το `transparent` δεν βάφει τίποτα και το
 * `currentColor` παίρνει την τιμή του από αλλού. Η διάκριση έχει σημασία γιατί
 * «δεν είναι χρώμα» και «είναι χρώμα που δεν κρίνεται» δεν είναι το ίδιο εύρημα.
 */
const COLOR_KEYWORDS = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'none']);

/**
 * Μια **τιμή** CSS (από το theme ή από αυθαίρετη αγκύλη) → κανονική μορφή.
 *
 * Πέντε μορφές, καμία σιωπηλή κατηγορία «άλλο»: `literal-hex` · `css-var` ·
 * `rgb-literal` · `hsl-literal` · `not-a-color`.
 */
function normalizeColorValue(raw) {
  const v = String(raw).trim();
  if (HEX_RE.test(v)) return { form: 'literal-hex', hex: v.toLowerCase() };
  if (COLOR_KEYWORDS.has(v.toLowerCase())) return { form: 'keyword', raw: v };

  const varMatch = VAR_RE.exec(v);
  if (varMatch) return { form: 'css-var', varName: varMatch[1], raw: v };

  const rgb = parseComputedColor(v);
  if (rgb) return { form: 'literal-hex', hex: toHex(rgb.rgb), alphaFromValue: rgb.alpha };

  const hslInner = /^hsla?\(([^)]*)\)$/i.exec(v);
  if (hslInner) {
    const parts = hslInner[1].split('/');
    const hsl = parseHslToken(parts[0].replace(/,/g, ' ').replace(/\s+/g, ' ').trim());
    if (hsl) {
      const alpha = parts[1] !== undefined ? parseFloat(parts[1]) : 1;
      return {
        form: 'literal-hex',
        hex: toHex(hslToRgb(hsl)),
        alphaFromValue: Number.isFinite(alpha) ? alpha : 1,
      };
    }
  }
  return { form: 'not-a-color', raw: v };
}

/**
 * Λύσε ΕΝΑ λεκτικό κλάσης σε χρώμα.
 *
 * @returns {null|{form:string, ...}} `null` όταν το λεκτικό δεν είναι utility χρώματος.
 *   Μορφές: `literal-hex` · `css-var` · `class-unknown` · `not-a-color` · `gradient`.
 */
function resolveClassToken(token, colors) {
  const parsed = parseColorUtility(token);
  if (!parsed) return null;

  const base = { util: parsed.util, dark: parsed.dark, variants: parsed.variants, alpha: parsed.alpha, token };
  if (parsed.gradient) return { ...base, form: 'gradient' };

  // Αυθαίρετη τιμή: `bg-[hsl(var(--bg-success))]`, `bg-[#262626]`, `border-[1px]`.
  // Στο Tailwind η κάτω παύλα ΕΙΝΑΙ κενό μέσα σε αγκύλες.
  if (parsed.value.startsWith('[') && parsed.value.endsWith(']')) {
    const inner = parsed.value.slice(1, -1).replace(/_/g, ' ');
    const value = normalizeColorValue(inner);
    return { ...base, ...value, alpha: parsed.alpha * (value.alphaFromValue ?? 1), arbitrary: true };
  }

  const { value, familyKnown } = lookupColor(colors, parsed.value);
  if (value === null) {
    // Η οικογένεια υπάρχει αλλά το σκαλί όχι ⇒ η κλάση **δεν παράγει CSS**.
    // Οτιδήποτε άλλο (`text-xs`, `border-[1px]`, `text-center`) απλώς δεν είναι χρώμα.
    return { ...base, form: familyKnown ? 'class-unknown' : 'not-a-color', value: parsed.value };
  }

  const normalized = normalizeColorValue(value);
  return { ...base, ...normalized, alpha: parsed.alpha * (normalized.alphaFromValue ?? 1) };
}

/**
 * Λύσε μια ΣΥΜΒΟΛΟΣΕΙΡΑ κλάσεων (μπορεί να έχει πολλές).
 *
 * @returns {{colors:object[], nonColor:number, total:number}} `colors` = μόνο τα
 *   λεκτικά που είναι utilities χρώματος, με σειρά εμφάνισης.
 */
function resolveClassString(raw, colors) {
  const tokens = tokenize(raw);
  const resolved = [];
  let nonColor = 0;
  for (const t of tokens) {
    const r = resolveClassToken(t, colors);
    if (r === null) nonColor++;
    else resolved.push(r);
  }
  return { colors: resolved, nonColor, total: tokens.length };
}

module.exports = {
  loadTailwindColors,
  lookupColor,
  normalizeColorValue,
  resolveClassToken,
  resolveClassString,
  TAILWIND_CONFIG,
};
