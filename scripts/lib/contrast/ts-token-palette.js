/**
 * Διαβάζει τις **δηλώσεις χρώματος** από τα TypeScript design-token modules
 * (`src/styles/design-tokens/modules/*.ts`).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟ `css-token-themes.js`:
 * η εφαρμογή έχει **δύο** συστήματα χρωμάτων. Το ένα ζει στο `globals.css` και έχει
 * δύο θέματα (`:root` / `.dark`) — αυτό το διαβάζει το `css-token-themes.js`. Το άλλο
 * ζει σε TypeScript, καταναλώνεται από ~744 αρχεία, και καταλήγει σε **inline style**
 * — δηλαδή **νικάει** κάθε κλάση κατά ειδικότητα. Κανένας φύλακας δεν το κοίταζε ποτέ.
 *
 * ⚠️ Ο ΡΟΛΟΣ ΠΡΟΚΥΠΤΕΙ ΑΠΟ ΤΟ ΜΟΝΟΠΑΤΙ, ΔΕΝ ΜΑΝΤΕΥΕΤΑΙ ΑΠΟ ΤΗΝ ΤΙΜΗ. Το `#ffffff`
 * είναι νόμιμο ως `background.primary` και σπασμένο ως `text.inverse` πάνω σε ανοιχτό
 * φόντο — **η ίδια τιμή, άλλη ετυμηγορία**. Μια συνάρτηση που κοιτάζει μόνο την τιμή
 * δεν μπορεί να διακρίνει τα δύο.
 *
 * ⚠️ AST, ΟΧΙ REGEX. Το μονοπάτι μιας ιδιότητας είναι δομή, όχι κείμενο· ένα regex
 * που μετρά άγκιστρα γεννά φαντάσματα (ADR-752 §ΜΗΝ — το `parseConstArray` γέννησε
 * ανύπαρκτο namespace γράφοντας ακριβώς αυτού του είδους διόρθωση).
 *
 * @module scripts/lib/contrast/ts-token-palette
 */

'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

/** Ο φάκελος που ΟΡΙΖΕΙ το TypeScript σύστημα χρωμάτων. */
const TOKEN_MODULES_DIR = 'src/styles/design-tokens/modules';

/**
 * Οι λέξεις-πυρήνες κάθε ρόλου. Ένα τμήμα μονοπατιού ονομάζει ρόλο όταν **είναι** η
 * λέξη, ή είναι η λέξη με `Color(s)`/πληθυντικό, ή **τελειώνει** σε αυτήν σε camelCase.
 *
 * ⚠️ Και τα τρία σχήματα χρειάζονται — μετρημένο, όχι υποθετικό: η πρώτη εκδοχή δεχόταν
 * μόνο το ακριβές τμήμα και άφησε **13 από τις 79** δηλώσεις χωρίς ρόλο —
 * `borderColors.default.light` (πληθυντικός) και `uploadingBackground` (camelCase). Και
 * τα δεκατρία ήταν χρώματα με ολοφάνερο ρόλο. Ένας ταξινομητής που τα λέει «unknown»
 * δεν είναι συντηρητικός· είναι **σιωπηλή απόρριψη** με άλλο όνομα.
 */
const ROLE_WORDS = [
  { role: 'border', words: ['border', 'outline', 'ring', 'divider', 'stroke'] },
  { role: 'foreground', words: ['text', 'icon', 'foreground', 'fg', 'label', 'caption', 'placeholder'] },
  { role: 'surface', words: ['background', 'bg', 'surface', 'overlay', 'fill', 'backdrop'] },
];

/**
 * `border` · `borderColors` · `uploadingBackground` → όλα ονομάζουν τον ίδιο ρόλο.
 *
 * Δύο ξεχωριστά σχήματα, το καθένα με τον δικό του κανόνα πεζών/κεφαλαίων:
 *  1. **ολόκληρο το τμήμα** είναι η λέξη, προαιρετικά + `Color(s)` / πληθυντικό
 *     (ανεξάρτητο πεζών: `border`, `Border`, `borderColors`)
 *  2. **camelCase κατάληξη** — αυστηρά `…<πεζό><Λέξη>` (`uploadingBackground`). Το
 *     κεφαλαίο αρχικό είναι που κάνει το σχήμα ασφαλές: χωρίς αυτό, το `bg` θα έπιανε
 *     κάθε λέξη που απλώς περιέχει αυτά τα γράμματα.
 */
function segmentNamesWord(segment, word) {
  const Word = word[0].toUpperCase() + word.slice(1);
  if (new RegExp(`^${word}(colors?)?s?$`, 'i').test(segment)) return true;
  return new RegExp(`[a-z]${Word}(Colors?)?s?$`).test(segment);
}

const ROLE_SEGMENTS = ROLE_WORDS.map(({ role, words }) => ({
  role,
  test: (s) => words.some((w) => segmentNamesWord(s, w)),
}));

/** Ένα κλειδί που είναι καθαρός αριθμός (`"500"`) είναι σκαλί κλίμακας, όχι ρόλος. */
const isScaleStep = (segment) => /^\d{2,3}$/.test(segment);

/**
 * Κατάταξη ενός μονοπατιού σε ρόλο.
 *
 * `primitive` σημαίνει «σκαλί παλέτας» (`colors.blue.500`) — **δεν κρίνεται**, γιατί δεν
 * ισχυρίζεται τίποτα: δεν είναι ούτε κείμενο ούτε φόντο μέχρι κάποιος να το βάλει
 * κάπου. Το να το χαρακτηρίσουμε σπασμένο θα ήταν ψευδώς θετικό — και οι μεγάλοι
 * παίχτες ρητά ξεχωρίζουν primitives από semantics (Atlassian: «map primitives first,
 * semantics second»).
 *
 * @param {string[]} segments τμήματα μονοπατιού, π.χ. ['colors','text','primary']
 * @returns {'foreground'|'surface'|'border'|'primitive'|'unknown'}
 */
function classifyRole(segments) {
  if (segments.length && isScaleStep(segments[segments.length - 1])) {
    const parent = segments[segments.length - 2];
    // `severity.critical.500` δεν υπάρχει· μια κλίμακα έχει ΧΡΩΜΑ ως γονέα (blue/gray/error).
    if (parent && !ROLE_SEGMENTS.some(({ test }) => test(parent))) return 'primitive';
  }
  for (let i = segments.length - 1; i >= 0; i--) {
    for (const { role, test } of ROLE_SEGMENTS) {
      if (test(segments[i])) return role;
    }
  }
  return 'unknown';
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_KEYWORDS = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'none']);

/**
 * Τι ΕΙΔΟΥΣ δήλωση είναι μια τιμή. Πέντε ονόματα, καμία σιωπηλή κατηγορία «άλλο»:
 * κάθε συμβολοσειρά παίρνει ακριβώς ένα.
 *
 * @param {string} raw
 */
function classifyValue(raw) {
  const v = String(raw).trim();
  if (HEX.test(v)) return { form: 'literal-hex', hex: v.toLowerCase() };
  if (/var\(\s*--[a-z0-9-]+/i.test(v)) return { form: 'css-var', raw: v };
  if (/^rgba?\(/i.test(v)) return { form: 'rgb-literal', raw: v };
  if (/^hsla?\(/i.test(v)) return { form: 'hsl-literal', raw: v };
  if (COLOR_KEYWORDS.has(v.toLowerCase())) return { form: 'keyword', raw: v };
  return { form: 'non-color', raw: v };
}

/** Ξετύλιξε `X as const` → `X`. */
const unwrapAsConst = (e) => (e && ts.isAsExpression(e) ? e.expression : e);

/** Το όνομα μιας ιδιότητας, είτε είναι ταυτοποιητής είτε συμβολοσειρά (`"500":`). */
function propertyName(prop) {
  const n = prop.name;
  if (!n) return null;
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
  return null;
}

/**
 * Ένα αντικείμενο είναι **δηλωμένο ζεύγος** όταν ορίζει ταυτόχρονα ό,τι μπαίνει ΜΠΡΟΣΤΑ
 * και ό,τι μπαίνει ΠΙΣΩ — π.χ. `severity.critical = { background, icon, border }`.
 *
 * 🔑 Αυτό είναι το σημείο όπου η πύλη ξέρει κάτι που **ούτε το Material 3 ούτε το
 * Leonardo** ξέρουν: ότι το ζεύγος **συμβαίνει**. Παντού αλλού μπορούμε μόνο να πούμε
 * «αυτός ο συνδυασμός θα ήταν αδύνατος»· εδώ ο ίδιος ο κώδικας δηλώνει ότι τα δύο
 * χρώματα προορίζονται να συνυπάρξουν, οπότε η αποτυχία είναι **βεβαιότητα**, όχι
 * πιθανότητα — και γι' αυτό κρίνεται με μηδενική ανοχή.
 *
 * @param {{key:string, value:{form:string,hex?:string}}[]} leaves φύλλα του ίδιου επιπέδου
 */
function detectDeclaredPair(leaves) {
  const pick = (role) =>
    leaves.find((l) => classifyRole([l.key]) === role && l.value.form === 'literal-hex');
  const surface = pick('surface');
  if (!surface) return null;
  const foregrounds = leaves.filter(
    (l) => classifyRole([l.key]) === 'foreground' && l.value.form === 'literal-hex',
  );
  const borders = leaves.filter(
    (l) => classifyRole([l.key]) === 'border' && l.value.form === 'literal-hex',
  );
  if (!foregrounds.length && !borders.length) return null;
  return { surface, foregrounds, borders };
}

/**
 * Περπάτησε ένα object literal και μάζεψε κάθε φύλλο-συμβολοσειρά με το ΠΛΗΡΕΣ μονοπάτι
 * του, μαζί με τα δηλωμένα ζεύγη που συναντά στην πορεία.
 */
function walkObject(node, prefix, file, sourceFile, out) {
  const leaves = [];
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = propertyName(prop);
    if (key === null) continue;
    const init = unwrapAsConst(prop.initializer);
    const segments = [...prefix, key];

    if (ts.isObjectLiteralExpression(init)) {
      walkObject(init, segments, file, sourceFile, out);
      continue;
    }
    if (!ts.isStringLiteral(init) && !ts.isNoSubstitutionTemplateLiteral(init)) continue;

    const value = classifyValue(init.text);
    const line = sourceFile.getLineAndCharacterOfPosition(init.getStart(sourceFile)).line + 1;
    const entry = {
      file,
      path: segments.join('.'),
      key,
      segments,
      role: classifyRole(segments),
      line,
      ...value,
    };
    out.entries.push(entry);
    leaves.push({ key, entry, value });
  }

  const pair = detectDeclaredPair(leaves);
  if (pair) {
    out.declaredPairs.push({
      file,
      path: prefix.join('.'),
      surface: pair.surface.entry,
      foregrounds: pair.foregrounds.map((l) => l.entry),
      borders: pair.borders.map((l) => l.entry),
    });
  }
}

/**
 * Ένα αντικείμενο `{ light: '#…', dark: '#…' }` είναι **θεματική** δήλωση: λέει ρητά
 * τι ισχύει σε κάθε θέμα. Αυτό είναι το ΣΩΣΤΟ μοτίβο και υπάρχει ήδη στο `borders.ts` —
 * το ίδιο σύστημα περιέχει και τον σωστό και τον λάθος τρόπο.
 */
function collectThemedPairs(entries) {
  const byParent = new Map();
  for (const e of entries) {
    if (e.form !== 'literal-hex') continue;
    if (e.key !== 'light' && e.key !== 'dark') continue;
    const parent = `${e.file}::${e.segments.slice(0, -1).join('.')}`;
    if (!byParent.has(parent)) byParent.set(parent, {});
    byParent.get(parent)[e.key] = e;
  }
  const pairs = [];
  for (const [, sides] of byParent) {
    if (sides.light && sides.dark) pairs.push({ light: sides.light, dark: sides.dark });
  }
  return pairs;
}

/**
 * Διάβασε ΟΛΑ τα design-token modules.
 *
 * @param {string} [repoRoot]
 * @returns {{source:string, files:string[], entries:object[], declaredPairs:object[], themedPairs:object[]}}
 */
function readTokenPalette(repoRoot = process.cwd()) {
  const dir = path.join(repoRoot, TOKEN_MODULES_DIR);
  if (!fs.existsSync(dir)) {
    throw new Error(`ts-token-palette: δεν βρέθηκε ο φάκελος ${TOKEN_MODULES_DIR} — fail-closed.`);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort();

  const out = { source: TOKEN_MODULES_DIR, files: [], entries: [], declaredPairs: [] };
  for (const name of files) {
    const rel = `${TOKEN_MODULES_DIR}/${name}`;
    const src = fs.readFileSync(path.join(dir, name), 'utf8');
    const sourceFile = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true);
    out.files.push(rel);

    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer && node.name) {
        const init = unwrapAsConst(node.initializer);
        if (ts.isObjectLiteralExpression(init)) {
          walkObject(init, [node.name.getText(sourceFile)], rel, sourceFile, out);
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }

  out.themedPairs = collectThemedPairs(out.entries);
  return out;
}

/** Οι καταχωρήσεις που ισχυρίζονται ΣΗΜΑΣΙΟΛΟΓΙΚΟ ρόλο — οι μόνες που κρίνονται. */
function semanticEntries(palette) {
  return palette.entries.filter(
    (e) => e.form === 'literal-hex' && ['foreground', 'surface', 'border'].includes(e.role),
  );
}

module.exports = {
  readTokenPalette,
  semanticEntries,
  classifyRole,
  classifyValue,
  TOKEN_MODULES_DIR,
};
