/**
 * Enumerates every place the codebase asks for `text-primary` (the TEXT colour token),
 * and classifies each one into an EXPLICIT state. Nothing is dropped silently.
 *
 * ⚠️ Read this before trusting a number from here:
 * `text-primary-foreground` CONTAINS the substring `text-primary`. A naive grep counts
 * ~109 of those as if they were the risky class — they are the opposite token (near-white).
 * This scanner matches `text-primary` only when NOT followed by `-foreground`.
 *
 * The states are deliberately asymmetric: this scanner can prove that a site sits on a
 * theme surface, but it CANNOT prove a site is fine. "Fine" requires knowing the runtime
 * ancestry, which is a browser question. So the optimistic states are named
 * `*-needs-look`, never `ok`.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { surfaceInkNames, surfaceInkRegex } = require('./surface-ink-tokens');

/**
 * `text-primary`, `text-primary/70`, `hover:text-primary`, `dark:text-primary`.
 *
 * Two exclusions, both measured — each was a real miscount before it was written down:
 *  - trailing `-foreground` (109 hits) is the OPPOSITE token, near-white;
 *  - a leading `-` or word char catches `--color-text-primary` (9 hits), a CSS VARIABLE NAME
 *    living in `src/design-system/tokens/colors.ts` — not a utility class, paints nothing.
 * With both exclusions the count reconciles exactly with a plain grep: 438 class uses + 1 typo.
 */
const TEXT_PRIMARY_RE = /(?<![-\w])text-primary(?!-foreground)(\/\d{1,3})?([a-z][a-z0-9-]*)?/g;

/** Backgrounds that are LIGHT in dark mode too, i.e. the only surfaces where `text-primary` could read. */
const LIGHT_SURFACE_RE =
  /\bbg-(white|primary-foreground|foreground|card-foreground|popover-foreground|(slate|gray|zinc|neutral|stone|blue|sky|indigo|amber|yellow)-(50|100|200))\b/;

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SKIPPED_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.git']);

function walkSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      walkSourceFiles(full, acc);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

/** True when the offset sits inside a `//` line comment or a `/* *\/` block comment. */
function isInsideComment(text, offset) {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const beforeOnLine = text.slice(lineStart, offset);
  if (beforeOnLine.includes('//')) return true;
  const lastOpen = text.lastIndexOf('/*', offset);
  if (lastOpen === -1) return false;
  return text.lastIndexOf('*/', offset) < lastOpen;
}

/**
 * The class list this occurrence belongs to: the enclosing string literal, widened to the
 * enclosing `cn(...)` call when there is one (multi-line class expressions are the norm here).
 */
function elementContext(text, offset) {
  const quote = ['"', "'", '`']
    .map((q) => ({ q, at: text.lastIndexOf(q, offset) }))
    .filter((c) => c.at !== -1)
    .sort((a, b) => b.at - a.at)[0];
  const literal = quote
    ? text.slice(quote.at + 1, indexOfOrEnd(text, quote.q, offset))
    : '';
  const cnStart = text.lastIndexOf('cn(', offset);
  const withinCn = cnStart !== -1 && offset - cnStart < 600;
  return withinCn ? `${literal} ${text.slice(cnStart, offset + 300)}` : literal;
}

function indexOfOrEnd(text, needle, from) {
  const at = text.indexOf(needle, from);
  return at === -1 ? Math.min(from + 200, text.length) : at;
}

/**
 * Classify one occurrence. States:
 *  - `inert-class`          the matched token is not a real utility (typo) — paints nothing
 *  - `in-comment`           documentation, not a class
 *  - `scoped-override`      inside a subtree that re-points `--primary` (see globals.css)
 *  - `element-light-bg`     the SAME class list also sets a light background — needs a look, not a pass
 *  - `file-light-bg`        somewhere in the file there is a light background — weakest evidence
 *  - `theme-surface`        no exception evidence: the token-matrix proof applies as-is
 */
function classify({ matched, suffix, context, fileText, overrideClasses }) {
  if (suffix) return 'inert-class';
  if (context.includes('__NO_CONTEXT__')) return 'theme-surface';
  for (const cls of overrideClasses) {
    if (fileText.includes(cls)) return 'scoped-override';
  }
  if (LIGHT_SURFACE_RE.test(context)) return 'element-light-bg';
  if (LIGHT_SURFACE_RE.test(fileText)) return 'file-light-bg';
  return 'theme-surface';
}

/**
 * Scan an EXPLICIT list of files. Added for ADR-770 (CHECK 3.38), whose pre-commit
 * layer only ever looks at the staged files — walking all ~14.7k sources costs 2,7s
 * and would be paid on every commit for nothing. Same classification, same states;
 * the only difference is who chooses the file list.
 *
 * ⚠️ A per-file scan CANNOT see cross-file effects (e.g. a newly added scoped
 * override of `--primary` re-classifies files nobody staged). That is the declared
 * limit of Layer 1 and the reason Layer 1b runs `--all` in CI.
 */
function scanFiles(files, overrideClasses = [], inkNames = surfaceInkNames()) {
  /**
   * 🔑 **Η ΕΜΒΕΛΕΙΑ ΕΙΝΑΙ ΤΟ `inkNames`, ΚΑΙ ΠΑΡΑΓΕΤΑΙ** (ADR-770 §16).
   *
   * Μέχρι τις 2026-08-27 εδώ ήταν καρφωμένο το `text-primary` — όχι επειδή ήταν το
   * **μόνο** token επιφάνειας που χρησιμοποιούνταν ως μελάνι, αλλά επειδή ήταν το μόνο
   * που **είχε βρεθεί**. Το `--destructive` ήταν η ίδια κλάση ακριβώς, και πέρασε από
   * δίπλα: μετρήθηκε **1,67:1** σε ζωντανή οθόνη, σε 391 αρχεία.
   *
   * ⚠️ Η προεπιλογή **δεν είναι λίστα** — είναι κλήση που ρωτά το `tailwind.config.ts`.
   * Έτσι (α) κανένας καλούντας δεν **οφείλει να θυμηθεί** να τη δώσει — το μάθημα `Κ14`,
   * όπου ο ένας στους τρεις που ξέχασε ήταν **η ίδια η πύλη** — και (β) όταν ένα token
   * διορθωθεί, η πύλη **σβήνει μόνη της** το εύρημα αντί να το κουβαλά για πάντα.
   */
  const re = surfaceInkRegex(inkNames);
  const sites = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue; // staged-deleted file: nothing to classify
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('text-')) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const offset = m.index;
      const context = elementContext(text, offset);
      const state = isInsideComment(text, offset)
        ? 'in-comment'
        : classify({ matched: m[0], suffix: m[2], context, fileText: text, overrideClasses });
      sites.push({
        file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
        line: text.slice(0, offset).split('\n').length,
        matched: m[0],
        alpha: m[1] ? parseInt(m[1].slice(1), 10) / 100 : 1,
        state,
      });
    }
  }
  return sites;
}

/** Scan `srcDir` and return one record per occurrence, with an explicit state on each. */
function scanTextPrimarySites(srcDir, overrideClasses = [], inkNames = surfaceInkNames()) {
  return scanFiles(walkSourceFiles(srcDir), overrideClasses, inkNames);
}

module.exports = {
  scanTextPrimarySites,
  scanFiles,
  walkSourceFiles,
  // Exported for ADR-770: `glued-class.js` must answer "is this offset inside a
  // comment?" the SAME way this scanner does. Two implementations of that question
  // would disagree the first time someone writes an example inside a block comment —
  // which is exactly how CHECK 3.36 grew a ghost namespace (ADR-752).
  isInsideComment,
  TEXT_PRIMARY_RE,
  LIGHT_SURFACE_RE,
};
