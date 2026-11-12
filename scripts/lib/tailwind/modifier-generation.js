/**
 * **Ο ΚΡΙΤΗΣ ΤΟΥ ΣΙΩΠΗΛΑ ΠΕΤΑΜΕΝΟΥ MODIFIER** (CHECK 3.116 · ADR-940) — καθαρή συνάρτηση πάνω σε κείμενο.
 *
 * Ερώτημα: «η κλάση **χωρίς** τον modifier παράγει CSS, αλλά **με** τον modifier όχι;»
 * Αυτό είναι ακριβώς το `bg-[hsl(var(--hue-purple))]/12` (ADR-770 §11, 2026-11-12): ο Tailwind 3.4 παράγει
 * modifier διαφάνειας μόνο για βήματα της `theme.opacity` και πετά τα υπόλοιπα **χωρίς καμία προειδοποίηση** —
 * διάφανο φόντο, στην παραγωγή, χωρίς καμία από τις 105 πύλες να το δει.
 *
 * 🔑 ΚΑΙ ΟΙ ΔΥΟ ΠΛΕΥΡΕΣ ΚΡΙΝΟΝΤΑΙ ΑΠΟ ΤΟΝ COMPILER (`engine.generates`). Γι' αυτό δεν υπάρχουν ψευδώς θετικά
 * από δικές μας κλάσεις, διαδρομές ή κλάσματα: το `w-1/12` παράγεται (κλάσμα)· το `foo/12` δεν έχει βάση που
 * παράγεται, άρα δεν είναι κλάση Tailwind και δεν μας αφορά. Το ίδιο κριτήριο πιάνει **κάθε** modifier τιμής
 * που πετιέται (διαφάνεια, αριθμητικό line-height `text-sm/…`), όχι μόνο το `/12` — δες `VALUE_MODIFIER`.
 *
 * ⚠️ Ο modifier αναζητείται ΜΟΝΟ στο utility, μετά τις παραλλαγές (`splitVariants`, με επίγνωση αγκυλών):
 * το `group-hover/card:` είναι **ονομασμένη ομάδα**, όχι modifier· και το `bg-[rgb(0_0_0/0.5)]` έχει κάθετο
 * **μέσα** στην αυθαίρετη τιμή.
 *
 * Καταστάσεις (κλειστή λογιστική — κάθε υποψήφια με modifier σε ΕΝΑΝ κάδο):
 *   ⛔ `dropped`          η βάση παράγεται, η κλάση με τον modifier ΟΧΙ
 *   ✅ `generated`        η κλάση με τον modifier παράγεται
 *   ➖ `not-tailwind`     ούτε η βάση παράγεται — δεν είναι κλάση Tailwind (κείμενο, διαδρομή, δική μας κλάση)
 *
 * @module scripts/lib/tailwind/modifier-generation
 */

'use strict';

const { splitVariants } = require('../contrast/tailwind-classes');

const STATES = Object.freeze({ DROPPED: 'dropped', GENERATED: 'generated', NOT_TAILWIND: 'not-tailwind' });
const BLOCKING = Object.freeze([STATES.DROPPED]);

/** Η θέση της τελευταίας `/` στο ΒΑΘΟΣ 0 (έξω από `[…]`/`(…)`), ή -1. */
function topLevelSlash(utility) {
  let depth = 0;
  let idx = -1;
  for (let i = 0; i < utility.length; i++) {
    const c = utility[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth = Math.max(0, depth - 1);
    else if (c === '/' && depth === 0) idx = i;
  }
  return idx;
}

/**
 * Modifier **ΤΙΜΗΣ**: αριθμός (`/12`, `/7`, `/2.5`) ή αυθαίρετη τιμή (`/[0.12]`).
 *
 * ⚠️ ΜΕΤΡΗΜΕΝΟ ΓΙΑΤΙ (2026-11-12): χωρίς αυτό το φίλτρο η πλήρης σάρωση έδωσε **242 ψευδώς θετικά, 0 αληθινά**.
 * Ο extractor του build σαρώνει **ΟΛΟ** το αρχείο, άρα και πρόζα σε σχόλια (`grid/tile`, `dark/light`,
 * `resize/tilt`)· και το `group/card` · `peer/menu-button` είναι **έγκυρες ονομασμένες ομάδες** (Tailwind 3.2+),
 * κλάσεις-σημάδια χωρίς CSS — η βάση `group` «παράγεται», το `group/card` όχι, και ο κριτής θα τις κατηγορούσε.
 * Ένας αριθμός ή μια `[…]` μετά από βάση που ο compiler ξέρει **δεν** είναι πρόζα.
 * ⚠️ ΔΗΛΩΜΕΝΟ ΚΕΝΟ: modifier-ΛΕΞΗ (`text-sm/tight` έγκυρο · `text-sm/foo` πετιέται) δεν κρίνεται.
 */
const VALUE_MODIFIER = /^(\d+(\.\d+)?|\[[^\]]+\])$/;
const MODIFIER_HINT = /\/(\d|\[)/;

/**
 * Σπάσε μια υποψήφια σε βάση + modifier τιμής. `null` αν δεν έχει modifier τιμής στο utility.
 * @returns {{base: string, modifier: string}|null}
 */
function splitModifier(candidate) {
  const { variants, utility } = splitVariants(candidate);
  const idx = topLevelSlash(utility);
  if (idx <= 0) return null;
  const modifier = utility.slice(idx + 1);
  if (!VALUE_MODIFIER.test(modifier)) return null;
  const prefix = variants.length ? `${variants.join(':')}:` : '';
  return { base: prefix + utility.slice(0, idx), modifier };
}

/** Γραμμή (1-based) της πρώτης εμφάνισης του `token` στο κείμενο. */
function lineOf(text, token) {
  const at = text.indexOf(token);
  return at < 0 ? 0 : text.slice(0, at).split('\n').length;
}

/**
 * Κρίνε ΕΝΑ κείμενο.
 * @param {string} text
 * @param {{extract: (t: string) => string[], generates: (c: string[]) => Map<string, boolean>}} engine
 * @returns {{candidates: Array<{token: string, base: string, modifier: string, state: string, line: number}>}}
 */
function judgeText(text, engine) {
  // Προφίλτρο ΑΣΦΑΛΕΣ δομικά: modifier τιμής ⇒ το κείμενο περιέχει `/` + ψηφίο ή `/[`. Γλιτώνει τον extractor.
  if (!MODIFIER_HINT.test(text)) return { candidates: [] };
  const split = [];
  for (const token of new Set(engine.extract(text))) {
    const parts = splitModifier(token);
    if (parts) split.push({ token, ...parts });
  }
  if (!split.length) return { candidates: [] };
  const gen = engine.generates(split.flatMap((s) => [s.token, s.base]));
  const candidates = split.map((s) => {
    let state = STATES.NOT_TAILWIND;
    if (gen.get(s.token)) state = STATES.GENERATED;
    else if (gen.get(s.base)) state = STATES.DROPPED;
    return { ...s, state, line: state === STATES.DROPPED ? lineOf(text, s.token) : 0 };
  });
  return { candidates };
}

module.exports = { judgeText, splitModifier, STATES, BLOCKING, VALUE_MODIFIER };
