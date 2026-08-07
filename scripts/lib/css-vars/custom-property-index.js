'use strict';
/**
 * SSoT — **«υπάρχει στ' αλήθεια αυτό το custom property;»** (ADR-774)
 *
 * Απαντά **μία** ερώτηση για τα `.css` του `src/` και αρνείται να μαντέψει πέρα από αυτήν:
 * κάθε `var(--x, …)` δείχνει σε όνομα που **ορίζεται κάπου**, ή σε **τίποτα**;
 *
 * ## Γιατί ΔΕΝ επεκτάθηκε το `lib/contrast/css-token-themes.js`
 * Εκείνο ρωτά «*ποια είναι η HSL τιμή του `--card` σε καθένα από τα δύο θέματα;*» και για να
 * την απαντήσει διαβάζει **μόνο** το `globals.css`, **μόνο** τους επιλογείς `:root` και `.dark`.
 * Εδώ η ερώτηση είναι «*ορίζεται το `--x` ΟΠΟΥΔΗΠΟΤΕ;*» — άλλο εύρος (όλο το δέντρο, κάθε
 * επιλογέας, **και** οι δηλώσεις από TS), άλλη έξοδος (σύνολο ονομάτων, όχι τιμές). Δύο
 * λειτουργίες με κοινό ένα regex τριών γραμμών δεν είναι κλώνος· ένα module που απαντά και τα
 * δύο θα ήταν module χωρίς ερώτηση.
 *
 * ## 🔴 Γιατί είμαστε ΑΥΣΤΗΡΟΤΕΡΟΙ από το βιομηχανικό πρότυπο
 * Ο κανόνας `no-unknown-custom-properties` του **stylelint** τεκμηριώνει κατά λέξη:
 *
 *     "The following patterns are *not* considered problems:  a { color: var(--foo, #f00); }"
 *
 * Δηλαδή το πρότυπο θεωρεί το fallback **απόδειξη πρόθεσης** και σταματά να ρωτά. Σε εφαρμογή
 * **δύο θεμάτων** ισχύει το αντίστροφο: όταν το `--foo` δεν υπάρχει, το `#f00` **δεν** είναι
 * εφεδρεία — είναι **η τιμή, πάντα**, μονοθεματική, και το `var()` γύρω της είναι ακριβώς αυτό
 * που την κάνει αόρατη στον αναγνώστη *και* στον linter. Το μετρημένο κόστος αυτής της
 * τυφλότητας εδώ: **126 χρήσεις / 54 ονόματα / 19 αρχεία**, όλα πράσινα στο stylelint.
 *
 * ## Τι ΔΕΝ κάνει
 * · Δεν κοιτάζει `var()` μέσα σε `.ts`/`.tsx` — αυτό είναι το ερώτημα του CHECK 3.40, που το
 *   απαντά **εκτελώντας** τα token modules στον browser. Δηλωμένο όριο, όχι παράλειψη.
 * · Δεν κρίνει **αντίθεση**. Ένα ορισμένο token μπορεί κάλλιστα να είναι αόρατο· αυτό το
 *   ρωτούν τα CHECK 3.38/3.39/3.40.
 * · Δεν λύνει αλυσίδες (`--a: var(--b)`). Κρίνει **ύπαρξη ονόματος**, όχι τιμή.
 */

const fs = require('node:fs');
const path = require('node:path');

/** Οι φάκελοι που δεν είναι πηγή. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage']);

/**
 * Ονόματα που **παρέχονται σε χρόνο εκτέλεσης από τρίτους** και γι' αυτό δεν βρίσκονται ποτέ
 * ως δήλωση στον κώδικά μας. Ρητά και **με λόγο** — μια σιωπηλή παράλειψη εδώ θα ήταν το ίδιο
 * σφάλμα που κυνηγά η πύλη. Επαληθεύτηκε από το `package.json` (2026-08-07).
 */
const RUNTIME_NAMESPACES = [
  { prefix: '--radix-', reason: '23 πακέτα @radix-ui/* — ο Popper γράφει διαστάσεις στο στοιχείο' },
  { prefix: '--tw-', reason: 'Tailwind — εσωτερικά (ring, shadow, gradient)' },
  { prefix: '--rmg-', reason: 'react-modern-gantt' },
  { prefix: '--gantt-', reason: 'react-modern-gantt' },
];

/** Καθεμία είναι **ρητή**· δεν υπάρχει «άλλο». Δες `classifyUsage`. */
const USAGE_STATES = Object.freeze({
  DEFINED: 'defined',
  RUNTIME_NAMESPACE: 'runtime-namespace',
  DANGLING_NO_FALLBACK: 'dangling-no-fallback',
  DANGLING_LITERAL_COLOR: 'dangling-literal-color',
  DANGLING_TOKEN_FALLBACK: 'dangling-token-fallback',
  DANGLING_NON_COLOR: 'dangling-non-color',
});

const OS_THEME_STATES = Object.freeze({
  CHROMATIC: 'os-theme-chromatic',
  NON_CHROMATIC: 'os-theme-non-chromatic',
});

// ---------------------------------------------------------------------------
// Αναγνώριση χρώματος
// ---------------------------------------------------------------------------

/**
 * Είναι αυτή η τιμή **σταθερό χρώμα**, γραμμένο κυριολεκτικά;
 *
 * ⚠️ Το `currentColor` **δεν** είναι σταθερό — κληρονομεί το `color` του προγόνου, άρα
 * ακολουθεί το θέμα. Το `transparent` επίσης δεν είναι μονοθεματικό. Και τα δύο **εξαιρούνται
 * επίτηδες**: θα ήταν ψευδώς θετικά, και ένα ψευδώς θετικό σε blocking πύλη κοστίζει
 * περισσότερο από μια χαμένη παραβίαση (πήχης ≤10%, ADR-294).
 */
const LITERAL_COLOR_RE =
  /^(#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[\d.]|hsla?\(\s*[\d.]|hwb\(|lab\(|lch\(|oklab\(|oklch\(|color\(|(black|white|red|green|blue|gray|grey|silver|maroon|olive|lime|aqua|teal|navy|fuchsia|purple|yellow|orange)\s*$)/i;

/** Περιέχει η τιμή αναφορά σε άλλο token; Τότε η τιμή **έρχεται από token**, όχι από hex. */
const REFERENCES_TOKEN_RE = /var\(\s*--/;

function isLiteralColor(value) {
  return LITERAL_COLOR_RE.test(String(value).trim());
}

// ---------------------------------------------------------------------------
// Περιήγηση αρχείων
// ---------------------------------------------------------------------------

function walk(dir, extensions, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, extensions, out);
    else if (extensions.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const toPosix = (p) => p.split(path.sep).join('/');
const relative = (repoRoot, file) => toPosix(path.relative(repoRoot, file));

/** Κάθε `.css` κάτω από το `src/`. Ο ΜΟΝΟΣ τύπος αρχείου που κρίνει αυτή η πύλη. */
function listCssFiles(repoRoot) {
  return walk(path.join(repoRoot, 'src'), ['.css']).map((f) => relative(repoRoot, f));
}

// ---------------------------------------------------------------------------
// Ο δείκτης ΟΡΙΣΜΩΝ
// ---------------------------------------------------------------------------

/** `--name: value` σε CSS, **και** `@property --name`. */
const CSS_DEFINITION_RE = /(--[A-Za-z0-9_-]+)\s*:/g;
const AT_PROPERTY_RE = /@property\s+(--[A-Za-z0-9_-]+)/g;
/** `{ '--name': value }` σε αντικείμενο στυλ React — **ορίζει** τη μεταβλητή στο στοιχείο. */
const TS_OBJECT_KEY_RE = /['"](--[A-Za-z0-9_-]+)['"]\s*:/g;
/** `el.style.setProperty('--name', …)` — ορισμός σε χρόνο εκτέλεσης. */
const TS_SET_PROPERTY_RE = /setProperty\(\s*['"`](--[A-Za-z0-9_-]+)/g;

function collectInto(names, text, regexes, source) {
  for (const re of regexes) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!names.has(m[1])) names.set(m[1], source);
    }
  }
}

/**
 * Το σύνολο **κάθε** custom property που ορίζεται οπουδήποτε στην πηγή.
 *
 * 🔴 Ο δείκτης είναι **καθολικός εκ κατασκευής**. Το ερώτημα «ορίζεται το `--x`;» δεν έχει
 * τοπική απάντηση: μια διαγραφή στο `globals.css` κάνει αδέσποτα αρχεία που κανείς δεν άγγιξε.
 * Γι' αυτό δεν υπάρχει «staged δείκτης» — υπάρχει **στενή σκανδάλη** (ο καλών τρέχει την πύλη
 * μόνο όταν έχει σταδιοποιηθεί `.css`), και τότε πληρώνει τον πλήρη δείκτη.
 *
 * Κόστος μετρημένο (2026-08-07): 34 CSS → 6 ms · 14.709 TS/TSX → 2,3 s για **139** ορισμούς σε
 * **18** αρχεία. Η ασυμμετρία είναι γνωστή και **δεν** «βελτιστοποιήθηκε» με λίστα φακέλων:
 * μια χειρόγραφη λίστα πηγών αποκλίνει σιωπηλά (CHECK 3.34 §δύο λίστες namespace, CHECK 3.37
 * §χειρόγραφη λίστα 18 έναντι 26). Προτιμάμε 2,3 s σε σπάνια σκανδάλη από έναν σωστό-σήμερα
 * κατάλογο που κανείς δεν θα ξαναδεί.
 */
function buildDefinitionIndex(repoRoot) {
  const names = new Map();
  const src = path.join(repoRoot, 'src');

  for (const file of walk(src, ['.css'])) {
    collectInto(names, fs.readFileSync(file, 'utf8'), [CSS_DEFINITION_RE, AT_PROPERTY_RE], relative(repoRoot, file));
  }
  for (const file of walk(src, ['.ts', '.tsx'])) {
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('--')) continue;
    collectInto(names, text, [TS_OBJECT_KEY_RE, TS_SET_PROPERTY_RE], relative(repoRoot, file));
  }
  // Το `tailwind.config.*` μπορεί να παράγει ονόματα· φθηνό, οπότε δεν το υποθέτουμε.
  for (const candidate of ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs']) {
    const full = path.join(repoRoot, candidate);
    if (fs.existsSync(full)) {
      collectInto(names, fs.readFileSync(full, 'utf8'), [CSS_DEFINITION_RE, TS_OBJECT_KEY_RE], candidate);
    }
  }
  return names;
}

function runtimeNamespaceOf(name) {
  return RUNTIME_NAMESPACES.find((ns) => name.startsWith(ns.prefix)) || null;
}

// ---------------------------------------------------------------------------
// Ο σαρωτής ΧΡΗΣΕΩΝ
// ---------------------------------------------------------------------------

/** Αφαιρεί σχόλια `/* … *\/` διατηρώντας τους αριθμούς γραμμών (κάθε νέα γραμμή μένει). */
function stripCommentsKeepingLines(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
}

/**
 * Ο δείκτης του κλεισίματος που ταιριάζει στο άνοιγμα στη θέση `openIndex`, με **μέτρημα
 * βάθους**. `-1` αν δεν κλείνει ποτέ (μη τερματισμένο — ο καλών αποφασίζει).
 *
 * Μία υλοποίηση για **δύο** ερωτήσεις — παρενθέσεις του `var()` και αγκύλες του `@media`.
 * Γραμμένες χωριστά ήταν token-κλώνος και τις έπιασε το CHECK 3.28 (N.18) πάνω στο ίδιο
 * commit που τις γέννησε.
 */
function matchingCloseIndex(text, openIndex, open, close) {
  let depth = 0;
  for (let j = openIndex; j < text.length; j += 1) {
    if (text[j] === open) depth += 1;
    else if (text[j] === close) {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return -1;
}

/**
 * Βρίσκει κάθε `var(...)` με **μέτρημα παρενθέσεων**, όχι με regex.
 *
 * ⚠️ Ένα regex `var\(([^)]*)\)` κόβει το `var(--x, hsl(var(--y)))` στην **πρώτη** κλειστή
 * παρένθεση και επιστρέφει fallback `hsl(var(--y` — δηλαδή θα το ταξινομούσε ως «όχι token».
 * Αυτό είναι ακριβώς το ζεύγος καταστάσεων που πρέπει να ξεχωρίζει η πύλη, οπότε το φθηνό
 * regex θα έβαφε **λάθος κατάσταση με βεβαιότητα**.
 */
function findVarCalls(css) {
  const calls = [];
  const nameRe = /var\(\s*(--[A-Za-z0-9_-]+)\s*/g;
  let m;
  while ((m = nameRe.exec(css)) !== null) {
    const name = m[1];
    let i = m.index + 3; // στο '(' του var(
    while (css[i] !== '(') i += 1;
    const end = matchingCloseIndex(css, i, '(', ')');
    if (end === -1) continue; // μη τερματισμένο — αφήνεται στον καλούντα ως μη-εύρημα
    const inner = css.slice(i + 1, end);
    const comma = inner.indexOf(',');
    calls.push({
      name,
      hasFallback: comma !== -1,
      fallback: comma === -1 ? null : inner.slice(comma + 1).trim(),
      index: m.index,
    });
    // ⚠️ ΔΕΝ μετακινούμε το `lastIndex` στο `end`. Στο `var(--a, var(--b, #fff))` το `--b`
    // είναι **δική του** χρήση με **δική της** κατάσταση: το εξωτερικό κρίνεται ως
    // `dangling-token-fallback` (η τιμή έρχεται από token), αλλά το εσωτερικό μπορεί κάλλιστα
    // να είναι `dangling-literal-color`. Ένα άλμα ως το `end` θα έκρυβε ακριβώς τη χειρότερη
    // περίπτωση πίσω από την πιο αθώα ταξινόμηση της εξωτερικής.
  }
  return calls;
}

/**
 * Η **μοναδική** συνάρτηση που αποδίδει κατάσταση σε μια χρήση. Κάθε κλάδος επιστρέφει ρητή
 * κατάσταση· δεν υπάρχει διαδρομή που να επιστρέφει `undefined`.
 */
function classifyUsage(call, definedNames) {
  if (definedNames.has(call.name)) return USAGE_STATES.DEFINED;
  const ns = runtimeNamespaceOf(call.name);
  if (ns) return USAGE_STATES.RUNTIME_NAMESPACE;
  if (!call.hasFallback) return USAGE_STATES.DANGLING_NO_FALLBACK;
  if (REFERENCES_TOKEN_RE.test(call.fallback)) return USAGE_STATES.DANGLING_TOKEN_FALLBACK;
  if (isLiteralColor(call.fallback)) return USAGE_STATES.DANGLING_LITERAL_COLOR;
  return USAGE_STATES.DANGLING_NON_COLOR;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * Διαβάζει τα δοσμένα `.css` (σχετικές διαδρομές), αφαιρεί σχόλια, και μαζεύει ό,τι επιστρέφει
 * ο `visit(css, file)`. Ένα αρχείο που δεν υπάρχει **παραλείπεται σιωπηλά εδώ επίτηδες**: το
 * Layer 1 παίρνει τη λίστα από το `git diff --cached`, που περιλαμβάνει και διαγραφές.
 *
 * Ο μοναδικός βρόχος ανάγνωσης — γραμμένος δύο φορές ήταν token-κλώνος (CHECK 3.28 / N.18).
 */
function forEachCss(repoRoot, files, visit) {
  const out = [];
  for (const file of files) {
    const full = path.join(repoRoot, file);
    if (!fs.existsSync(full)) continue;
    out.push(...visit(stripCommentsKeepingLines(fs.readFileSync(full, 'utf8')), file));
  }
  return out;
}

/** Σαρώνει τα δοσμένα `.css` και επιστρέφει μία εγγραφή ανά `var()`. */
function scanCssUsages(repoRoot, files, definedNames) {
  return forEachCss(repoRoot, files, (css, file) =>
    findVarCalls(css).map((call) => ({
      file,
      line: lineOf(css, call.index),
      name: call.name,
      fallback: call.fallback,
      state: classifyUsage(call, definedNames),
    })),
  );
}

// ---------------------------------------------------------------------------
// Κ3 — τα μπλοκ που ρωτούν το ΛΕΙΤΟΥΡΓΙΚΟ
// ---------------------------------------------------------------------------

/** Ιδιότητες CSS που βάφουν. */
const CHROMATIC_PROPERTY_RE =
  /(?:^|[\s;{])(color|background|background-color|border|border-color|border-(?:top|right|bottom|left)-color|outline|outline-color|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration-color|column-rule-color)\s*:/gi;

/**
 * Κάθε μπλοκ `@media (prefers-color-scheme: …)` του αρχείου, με μέτρημα αγκυλών.
 * Επιστρέφει `{ line, body }` — το `body` περιλαμβάνει τυχόν εμφωλευμένους επιλογείς.
 */
function findOsThemeBlocks(css) {
  const blocks = [];
  const re = /@media[^{]*prefers-color-scheme[^{]*\{/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const open = css.indexOf('{', m.index);
    const end = matchingCloseIndex(css, open, '{', '}');
    if (end === -1) continue;
    blocks.push({ line: lineOf(css, m.index), body: css.slice(open + 1, end) });
    re.lastIndex = end;
  }
  return blocks;
}

/**
 * Βάφει αυτό το μπλοκ;
 *
 * 🔴 **ΔΥΟ τρόποι, όχι ένας.** Η πρώτη εκδοχή αυτής της συνάρτησης μετρούσε μόνο ιδιότητες CSS
 * και ανέφερε «**0** χρωματικές δηλώσεις» για το `theme/tokens.color.css` — ένα αρχείο που
 * **ξαναορίζει 19 χρωματικά tokens** μέσα σε αυτό ακριβώς το μπλοκ. Δηλαδή το όργανο απάντησε
 * «καθαρό» εκεί που η βλάβη ήταν **μεγαλύτερη**, επειδή ήταν ένα επίπεδο πιο πάνω: το σχήμα
 * «0 = κανείς δεν κοίταξε», μέσα στην πύλη που υπάρχει για να το κυνηγά.
 */
function chromaticDeclarationsIn(body) {
  const hits = [];
  CHROMATIC_PROPERTY_RE.lastIndex = 0;
  let m;
  while ((m = CHROMATIC_PROPERTY_RE.exec(body)) !== null) hits.push(m[1].toLowerCase());

  const customRe = /(--[A-Za-z0-9_-]+)\s*:\s*([^;}]+)/g;
  let c;
  while ((c = customRe.exec(body)) !== null) {
    const value = c[2].trim();
    if (isLiteralColor(value) || REFERENCES_TOKEN_RE.test(value)) hits.push(c[1]);
  }
  return hits;
}

/** Μία εγγραφή ανά μπλοκ `prefers-color-scheme`, με ρητή κατάσταση. */
function scanOsThemeBlocks(repoRoot, files) {
  return forEachCss(repoRoot, files, (css, file) =>
    findOsThemeBlocks(css).map((block) => {
      const chromatic = chromaticDeclarationsIn(block.body);
      return {
        file,
        line: block.line,
        chromatic: chromatic.length,
        sample: [...new Set(chromatic)].slice(0, 4),
        state: chromatic.length > 0 ? OS_THEME_STATES.CHROMATIC : OS_THEME_STATES.NON_CHROMATIC,
      };
    }),
  );
}

module.exports = {
  RUNTIME_NAMESPACES,
  USAGE_STATES,
  OS_THEME_STATES,
  buildDefinitionIndex,
  listCssFiles,
  scanCssUsages,
  scanOsThemeBlocks,
  classifyUsage,
  findVarCalls,
  findOsThemeBlocks,
  chromaticDeclarationsIn,
  isLiteralColor,
  stripCommentsKeepingLines,
  matchingCloseIndex,
  forEachCss,
};
