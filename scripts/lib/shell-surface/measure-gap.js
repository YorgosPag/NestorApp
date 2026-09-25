/**
 * **Κ6 — Η ΣΤΗΛΗ ΤΟΥ ΜΕΤΡΟΥ ΔΕΝ ΔΕΧΕΤΑΙ ΟΡΙΖΟΝΤΙΟ ΚΕΝΟ** (ADR-797 §Φ.Κ6 · CHECK 3.63).
 *
 * 🔴 ΤΟ ΜΕΤΡΗΜΕΝΟ ΠΕΡΙΣΤΑΤΙΚΟ (2026-09-25, iPhone 12 Pro 390 px): η αρχική σελίδα
 * έκοβε **τέσσερα** μπλοκ στη δεξιά άκρη. Η αιτία ΔΕΝ ήταν κάποιο φαρδύ παιδί — ήταν
 * το `gap-6` πάνω στο `<main data-shell-measure>`. Το πλέγμα του μέτρου έχει **τρεις**
 * στήλες (`[full] minmax(0,1fr) · min(μέτρο, 100%) · minmax(0,1fr)`), άρα το `gap`
 * γεννά **δύο** column-gaps. Στο desktop τα απορροφούν οι πλαϊνές `1fr`· στο κινητό η
 * στήλη κειμένου είναι ήδη `100%` και τα κενά **προστίθενται**: 358 + 2×24 = **406 px**.
 * Μετρημένο ζωντανά: πριν `16→422`, με `column-gap: 0` → `16→374`. Το ίδιο σχήμα ζούσε
 * σε **επτά** σελίδες, αόρατο γιατί ο καθολικός `overflow-x: clip` του `globals.css`
 * κρύβει την υπερχείλιση — δεν γεννιέται οριζόντια κύλιση να τη δει κανείς.
 *
 * 🔑 **Η ΣΕΛΙΔΑ ΚΑΤΕΧΕΙ ΤΟΝ ΚΑΘΕΤΟ ΡΥΘΜΟ (`gap-y-*`), ΤΟ ΚΕΛΥΦΟΣ ΤΙΣ ΣΤΗΛΕΣ.**
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ `column-gap: 0` ΣΤΟ `shell-surface.css`**: φορτώνεται **πριν** τα
 * `@tailwind` με **ίδια** ειδικότητα ⇒ το `.gap-6` νικά κατά σειρά πηγής και ο κανόνας
 * θα ήταν σιωπηλά ανενεργός. Η μόνη «διόρθωση» εκεί θα ήταν `!important` — μπάλωμα.
 * Η πρόθεση γράφεται στη σελίδα και η πύλη την κάνει μηχανικά ελέγξιμη.
 */

const fs = require('fs');
const path = require('path');

const { stripComments } = require('./scan');

/** `gap-6` · `gap-x-4` · `md:gap-2` · `gap-[1rem]` · `gap-px` — ποτέ `gap-y-*`. */
const COLUMN_GAP = /(?:^|[\s"'`{:])((?:[a-z0-9-]+:)*gap-(?:x-)?(?:\d+(?:\.\d+)?|px|\[[^\]]+\]))(?![\w-])/;

/** Ο δείκτης του μέτρου: το ωμό attribute, ή το `measure=` του `ShellSurface`. */
const RAW_MARKER = /\bdata-shell-measure\s*=/;
const PRIMITIVE_MARKER = /^<ShellSurface\b[\s\S]*\smeasure\s*=/;

/**
 * Το κείμενο της ετικέτας ανοίγματος που ξεκινά στο `start` (`<`), ισορροπώντας
 * `{}` και συμβολοσειρές — ένα `>` μέσα σε `cn(a > b ? …)` ΔΕΝ την κλείνει.
 */
function openingTagAt(source, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return source.slice(start, i + 1);
  }
  return null;
}

/** Όλες οι ετικέτες μέτρου ενός αρχείου που δηλώνουν οριζόντιο κενό. */
function measureGapsInSource(source) {
  const clean = stripComments(source);
  const found = [];
  const tagStart = /<[A-Za-z]/g;
  let m;
  while ((m = tagStart.exec(clean))) {
    const tag = openingTagAt(clean, m.index);
    if (!tag || !(RAW_MARKER.test(tag) || PRIMITIVE_MARKER.test(tag))) continue;
    const gap = COLUMN_GAP.exec(tag);
    if (gap) {
      const line = clean.slice(0, m.index).split('\n').length;
      found.push({ line, klass: gap[1] });
    }
  }
  return found;
}

function collectTsx(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTsx(full, out);
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** Σάρωση του `src/`: `[{ file, line, klass }]`, διαδρομές σχετικές με τη ρίζα. */
function findMeasureColumnGaps(repoRoot) {
  const results = [];
  for (const file of collectTsx(path.join(repoRoot, 'src'))) {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('data-shell-measure') && !source.includes('measure=')) continue;
    const rel = path.relative(repoRoot, file).split(path.sep).join('/');
    for (const hit of measureGapsInSource(source)) results.push({ file: rel, ...hit });
  }
  return results;
}

module.exports = { COLUMN_GAP, measureGapsInSource, findMeasureColumnGaps };
