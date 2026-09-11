/**
 * ADR-780 Φάση Δ — Η **ΔΟΜΗ** ΚΑΝΕΙ ΜΙΑ ΣΤΡΩΣΗ ΚΑΘΟΛΙΚΗ, ΟΧΙ Ο ΑΡΙΘΜΟΣ.
 *
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (ADR-332 D27 Ζ3, μετρημένο ζωντανά 2026-09-11): σε πλήρη οθόνη ο διάλογος
 * συρσίματος ήταν αόρατος και το πρώτο κλικ τον ακύρωνε. `FullscreenOverlay` = `fixed inset-0
 * z-[60]`, όλη η οικογένεια Radix = `fixed … z-50`. Και τα δύο είναι **καθολικά** (fixed, portal στο
 * `body`) — όμως κάτω από το `GLOBAL_LAYER_FLOOR`, άρα «local-stacking» για την πύλη. Επιπλέον το
 * **ονομασμένο** `z-50` του Tailwind δεν το έβλεπε ΚΑΝΕΝΑ μοτίβο, ούτε το προφίλτρο του hook.
 *
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΚΑΤΕΒΑΙΝΕΙ ΤΟ ΚΑΤΩΦΛΙ (ADR-780 §9.8): τα `z-index: 1/2/10/50` ΕΙΝΑΙ τοπική στοίβαξη
 * σχεδόν πάντα — ο θόρυβος θα ξεπερνούσε το <10% ψευδώς θετικών μιας μπλοκάρουσας πύλης. Η δομή
 * είναι **δεύτερο, ορθογώνιο** κριτήριο: ένα `position: fixed` στρώνεται απέναντι στο viewport, όχι
 * μέσα σε component — εκτός αν πρόγονος φτιάχνει stacking context, που στατικά δεν φαίνεται (δηλωμένο).
 *
 * ⚠️ ΔΗΛΩΜΕΝΑ ΟΡΙΑ (γραμμένα και ως test, Κ15/Κ16):
 *  - `sticky` ΔΕΝ κρίνεται: είναι καθολικό μόνο στο root context (το header του κελύφους), τοπικό μέσα
 *    σε scroll container — στατικά αδύνατο να ξεχωρίσεις.
 *  - `cn('fixed inset-0', 'z-50')` — το `fixed` και το `z-*` σε ΔΙΑΦΟΡΕΤΙΚΕΣ συμβολοσειρές δεν δένονται.
 *  - Inline style σε component ΑΛΛΟΥ αρχείου (`style={{ zIndex: 50 }}` σε `<DialogContent>`) δεν
 *    ξέρει ότι ο στόχος του είναι `fixed`.
 *
 * @module scripts/lib/zindex/structure
 */

'use strict';

/**
 * Ονομασμένο utility στρώσης του Tailwind: `z-50` · `-z-10` · `hover:z-40` · `z-auto`.
 * Ο φραγμός πριν (`(?<![\w-])`) κόβει το `translate-z-10`/`foo-z-50`· ο φραγμός μετά κόβει το
 * `z-[…]`, που το πιάνει ήδη το μοτίβο arbitrary (μία δήλωση = ένα σημείο).
 */
const NAMED_UTILITY_SOURCE = String.raw`(?<![\w-])(-?)z-(\d+|auto)(?![\w\-[])`;
const namedUtilityRe = () => new RegExp(NAMED_UTILITY_SOURCE, 'g');

/** Τα σημάδια που **δεν** είναι ονομασμένο utility. */
const LAYERING_MARKERS = ['z-index', 'zIndex', 'z-['];

/**
 * Γράφει αυτό το κείμενο **κάποια** δήλωση στρώσης; — το ΕΝΑ προφίλτρο, για τη σάρωση ΚΑΙ το hook.
 * (Ήταν δύο αντίγραφα της λίστας, και κανένα δεν ήξερε το `z-50` — δες την κεφαλίδα.)
 */
function textDeclaresLayering(text) {
  if (LAYERING_MARKERS.some((marker) => text.includes(marker))) return true;
  return new RegExp(NAMED_UTILITY_SOURCE).test(text);
}

/**
 * `zIndex: 'z-50'` / `zIndex: 'z-[var(--x)]'` — η τιμή του κλειδιού είναι **κλάση** Tailwind, όχι
 * αριθμός. Μέχρι τη Φάση Δ έπεφτε στον κλάδο «έκφραση TS» ⇒ ψευδές ✅ `scale-reference`· τώρα το
 * σημείο το κρίνει **μόνο** η διάλεκτος Tailwind που βρίσκει την ίδια κλάση μέσα στη συμβολοσειρά.
 */
const isTailwindClassValue = (raw) => /^-?z-(\d|auto|\[)/.test(raw);

const QUOTES = new Set(["'", '"', '`']);
const LOOKBACK = 800;

/** Η συμβολοσειρά (`'…'`, `"…"`, `` `…` ``) που περιέχει τη θέση — ή `null`. */
function enclosingLiteral(text, index) {
  const floor = Math.max(0, index - LOOKBACK);
  let start = index - 1;
  while (start >= floor && !QUOTES.has(text[start])) start -= 1;
  if (start < floor) return null;
  const end = text.indexOf(text[start], index);
  return end === -1 ? null : text.slice(start + 1, end);
}

/** Το αντικείμενο `{ … }` που περιέχει τη θέση (ισορροπημένες αγκύλες) — ή `null`. */
function enclosingObject(text, index) {
  const floor = Math.max(0, index - LOOKBACK);
  let depth = 0;
  let open = -1;
  for (let i = index - 1; i >= floor; i -= 1) {
    if (text[i] === '}') depth += 1;
    else if (text[i] === '{') {
      if (depth === 0) { open = i; break; }
      depth -= 1;
    }
  }
  if (open === -1) return null;
  depth = 0;
  for (let i = open + 1; i < text.length && i < index + LOOKBACK; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      if (depth === 0) return text.slice(open + 1, i);
      depth -= 1;
    }
  }
  return null;
}

const FIXED_CLASS_RE = /(?<![\w-])fixed(?![\w-])/;
const FIXED_INLINE_RE = /\bposition\s*:\s*['"`]fixed['"`]/;
const FIXED_CSS_RE = /(?:^|[;{\s])position\s*:\s*fixed\b/;

/**
 * Δηλώνει η **ίδια** δομή `position: fixed`; — ανά διάλεκτο, στο μικρότερο δεσμευτικό εύρος:
 * η συμβολοσειρά κλάσης (Tailwind) ή το αντικείμενο style (inline).
 */
function tsSiteIsFixed(text, index, dialect) {
  if (dialect === 'inline') {
    const object = enclosingObject(text, index);
    return object !== null && FIXED_INLINE_RE.test(object);
  }
  const literal = enclosingLiteral(text, index);
  return literal !== null && FIXED_CLASS_RE.test(literal);
}

/**
 * Ο κανόνας CSS που περιέχει μια δήλωση: `{ selector, block }`. Οι δηλώσεις δεν περιέχουν `{`,
 * άρα η πλησιέστερη `{` πριν είναι το άνοιγμα του **δικού** τους κανόνα (και μέσα σε `@media`).
 */
function cssRuleOf(css, index) {
  const open = css.lastIndexOf('{', index);
  if (open === -1) return { selector: '', block: '' };
  const close = css.indexOf('}', index);
  const boundary = Math.max(css.lastIndexOf('}', open), css.lastIndexOf('{', open - 1), css.lastIndexOf(';', open));
  return {
    selector: css.slice(boundary + 1, open).trim(),
    block: css.slice(open + 1, close === -1 ? css.length : close),
  };
}

const cssBlockIsFixed = (block) => FIXED_CSS_RE.test(block);

/**
 * ⛔ Η ΣΚΙΩΔΗΣ ΑΥΘΕΝΤΙΑ. Ο wrapper του `components/ui/*` είναι η **μόνη** αυθεντία της στρώσης του
 * Radix content (κλάση της κλίμακας). Ένας κανόνας με επιλογέα χαρακτηριστικού `[data-radix-…]` έχει
 * ίδια ειδικότητα με την κλάση, και αν γραφτεί αργότερα στο cascade **τη νικά σιωπηλά** — ακόμη κι αν
 * ζητά ρόλο της κλίμακας. Μετρημένο: `[data-radix-select-content]{z-index:var(--z-index-dropdown)}`
 * έριχνε ΚΑΘΕ Select από 1220 σε 1000, δηλαδή πίσω από κάθε διάλογο που θα ανέβαινε στην κλίμακα.
 */
const isShadowAuthoritySelector = (selector) => selector.includes('[data-radix-');

module.exports = {
  NAMED_UTILITY_SOURCE,
  namedUtilityRe,
  LAYERING_MARKERS,
  textDeclaresLayering,
  isTailwindClassValue,
  enclosingLiteral,
  enclosingObject,
  tsSiteIsFixed,
  cssRuleOf,
  cssBlockIsFixed,
  isShadowAuthoritySelector,
};
