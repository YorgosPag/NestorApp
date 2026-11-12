/**
 * **Η ΜΗΧΑΝΗ ΤΟΥ TAILWIND, ΟΠΩΣ ΤΗ ΒΛΕΠΕΙ Ο COMPILER** (ADR-940) — το ΕΝΑ σημείο από το οποίο
 * τα εργαλεία του repo ρωτούν το Tailwind.
 *
 * Τρία ερωτήματα, όλα απαντημένα από το **ίδιο το πακέτο `tailwindcss`**, ποτέ από δική μας λίστα:
 *   · `config`      → `loadConfig('tailwind.config.ts')` + `resolveConfig()` (theme, content, …)
 *   · `generates()` → «παράγει CSS αυτή η κλάση;» — `createContext(config).getClassOrder()`,
 *                     το ίδιο API με το επίσημο `prettier-plugin-tailwindcss`: `null` = καμία κανόνα CSS.
 *   · `extract()`   → ποιες λέξεις ενός κειμένου είναι υποψήφιες κλάσεις — ο `defaultExtractor`
 *                     που σαρώνει τα αρχεία του `content` στο build.
 *   · `isContentFile()` → σαρώνει το build αυτό το αρχείο; — τα globs του `content` με το
 *                     `micromatch` του ίδιου του Tailwind.
 *
 * 🔑 ΓΙΑΤΙ ΟΧΙ ΧΕΙΡΟΓΡΑΦΗ ΚΛΙΜΑΚΑ: μετρημένο 2026-11-12 (tailwindcss 3.4.19) — το `bg-primary/12`
 * **δεν** παράγεται (το `/12` δεν είναι βήμα της `theme.opacity`), ενώ το `w-1/12` **παράγεται**
 * (κλάσμα πλάτους). Ένα regex «`/N` εκτός κλίμακας» θα κατηγορούσε το δεύτερο· μια λίστα βημάτων
 * θα αποκλίνει την πρώτη φορά που κάποιος επεκτείνει το `opacity` ή αναβαθμίσει τον Tailwind.
 * Ρωτώντας τη μηχανή, και τα δύο έρχονται «δωρεάν» (ίδια κίνηση με το CHECK 3.42).
 *
 * ⚠️ FAIL-CLOSED: config που δεν φορτώνεται ⇒ `throw` με όνομα. Πύλη που δεν ξέρει τη μηχανή δεν
 * επιτρέπεται να πει «καθαρό» (το σχήμα «0 = κανείς δεν κοίταξε»).
 * ⚠️ Το config ΕΚΤΕΛΕΙΤΑΙ από τον δίσκο (jiti): στην όψη του commit σωστό ΜΟΝΟ αν δεν αποκλίνει
 * (ADR-924 §8.5) — `assertUndivergent`.
 * ⚠️ Επίλυση πακέτων: πρώτα από τη ρίζα που δόθηκε, μετά δίπλα σε αυτό το αρχείο (pnpm symlink store ·
 * μίνι-repo των tests χωρίς `node_modules`).
 *
 * Κόστος: config ~300ms (μία φορά ανά ρίζα) · context μόνο όταν ζητηθεί (`generates`/`extract`).
 *
 * @module scripts/lib/tailwind/engine
 */

'use strict';

const path = require('node:path');

const TAILWIND_CONFIG = 'tailwind.config.ts';

/** ρίζα → { config, context? } */
const cache = new Map();

function requireFrom(root, id) {
  return require(require.resolve(id, { paths: [root, __dirname] }));
}

/**
 * Το επιλυμένο config του έργου, όπως το βλέπει ο compiler.
 * @param {string} [repoRoot]
 * @param {?{assertUndivergent: Function}} [input] η είσοδος της πύλης (ADR-924)
 */
function loadResolvedTailwindConfig(repoRoot = process.cwd(), input = null) {
  if (input) input.assertUndivergent([TAILWIND_CONFIG], 'το εκτελεί το Tailwind (jiti) — η μηχανή θα ερχόταν από τον δίσκο');
  const root = path.resolve(repoRoot);
  const hit = cache.get(root);
  if (hit) return hit.config;
  let config;
  try {
    const loadConfig = requireFrom(root, 'tailwindcss/loadConfig');
    const resolveConfig = requireFrom(root, 'tailwindcss/resolveConfig');
    config = resolveConfig(loadConfig(path.join(root, TAILWIND_CONFIG)));
  } catch (e) {
    throw new Error(`tailwind engine: αδύνατη η ανάγνωση του ${TAILWIND_CONFIG} (${e.message}) — fail-closed.`);
  }
  if (!config || !config.theme) {
    throw new Error(`tailwind engine: το ${TAILWIND_CONFIG} δεν έδωσε theme — fail-closed.`);
  }
  cache.set(root, { config });
  return config;
}

/** Τα globs του `content` χωρισμένα σε include/exclude, σχετικά με τη ρίζα. */
function contentGlobs(config) {
  const files = (config.content && config.content.files) || [];
  const globs = files.filter((f) => typeof f === 'string').map((g) => g.replace(/^(!?)\.\//, '$1'));
  return {
    include: globs.filter((g) => !g.startsWith('!')),
    exclude: globs.filter((g) => g.startsWith('!')).map((g) => g.slice(1)),
  };
}

/** Το context του compiler + ο extractor του build — μία φορά ανά ρίζα (~1s). */
function engineContext(root) {
  const entry = cache.get(root);
  if (!entry.context) {
    try {
      const { createContext } = requireFrom(root, 'tailwindcss/lib/lib/setupContextUtils');
      const { defaultExtractor } = requireFrom(root, 'tailwindcss/lib/lib/defaultExtractor');
      const ctx = createContext(entry.config);
      entry.context = { ctx, extract: defaultExtractor(ctx) };
    } catch (e) {
      throw new Error(`tailwind engine: αδύνατο το στήσιμο του context (${e.message}) — fail-closed.`);
    }
  }
  return entry.context;
}

/** Το `micromatch` ΤΟΥ ΙΔΙΟΥ του Tailwind (pnpm: δεν είναι ορατό από τη ρίζα) — καμία δεύτερη υλοποίηση glob. */
function tailwindMicromatch(root) {
  const tailwindDir = path.dirname(require.resolve('tailwindcss', { paths: [root, __dirname] }));
  return require(require.resolve('micromatch', { paths: [tailwindDir] }));
}

/**
 * Η μηχανή: config + τα ερωτήματα. Το context στήνεται τεμπέλικα.
 * @param {string} [repoRoot]
 * @param {object} [input]
 */
function loadTailwindEngine(repoRoot = process.cwd(), input = null) {
  const root = path.resolve(repoRoot);
  const config = loadResolvedTailwindConfig(root, input);
  const globs = contentGlobs(config);
  let mm = null;
  return {
    config,
    contentGlobs: globs,
    /** @param {string[]} classes @returns {Map<string, boolean>} κλάση → παράγει CSS; */
    generates(classes) {
      const order = engineContext(root).ctx.getClassOrder([...new Set(classes)]);
      return new Map(order.map(([cls, rank]) => [cls, rank !== null]));
    },
    /** @param {string} text @returns {string[]} οι υποψήφιες κλάσεις, όπως τις βγάζει το build */
    extract: (text) => engineContext(root).extract(text),
    /** @param {string} rel διαδρομή σχετική με τη ρίζα, posix */
    isContentFile(rel) {
      mm = mm || tailwindMicromatch(root);
      return mm.isMatch(rel, globs.include, { dot: true }) && !mm.isMatch(rel, globs.exclude, { dot: true });
    },
  };
}

module.exports = { loadResolvedTailwindConfig, loadTailwindEngine, TAILWIND_CONFIG };
