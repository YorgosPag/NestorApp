#!/usr/bin/env node
/**
 * CODEMOD: κάθε σημείο πλοήγησης περνά από το ΣΥΝΟΡΟ (ADR-787 §5.3 μ)
 *
 *   import Link from 'next/link';                 →  import { Link } from '@/lib/workspace/navigation';
 *   import { useRouter } from 'next/navigation';  →  import { useRouter } from '@/lib/workspace/navigation';
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ts-morph — Η ΕΠΙΛΟΓΗ ΒΓΗΚΕ ΑΠΟ ΜΕΤΡΗΣΗ, ΟΧΙ ΑΠΟ ΠΡΟΤΙΜΗΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * * **ts-morph**: ΗΔΗ `devDependency ^28.0.0`, ΗΔΗ εγκατεστημένο, και το repo
 *   έχει ΗΔΗ ιδίωμα (`migrate-toisostring.mjs` · `migrate-design-tokens-to-theme.mjs`
 *   · `remove-dead-types.mjs`) ⇒ μηδέν νέα εξάρτηση, μηδέν έλεγχος αδείας (N.5).
 * * **jscodeshift**: νέα εξάρτηση για δουλειά που το υπάρχον εργαλείο κάνει.
 * * **`@next/codemod`** *(η επίσημη πρακτική του Next)*: τα transforms του
 *   αφορούν **αναβαθμίσεις του ίδιου του Next** (`new-link`) — δεν υπάρχει
 *   transform για μετανάστευση σε **δικό σου** σύνορο.
 * * **next-intl** *(δομικά ταυτόσημο πρόβλημα: υποχρεωτικό δυναμικό πρόθεμα)*:
 *   **δεν έχει codemod καθόλου** — το `createNavigation()` στηρίζεται στο να
 *   **θυμάσαι**, και η κοινότητα προτείνει ESLint `no-restricted-imports`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏆 ΚΑΙ ΤΟ ΣΚΑΛΙ ΠΑΝΩ: **ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ FAIL-CLOSED**
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ίδιο το `facebookarchive/codemod` γράφει ότι τα codemods *«still require
 * **human oversight** and occasional intervention»* — δηλαδή η βιομηχανία δέχεται
 * ότι κάτι μπορεί να ξεφύγει και το αναθέτει σε **μάτια**. Εδώ δεν ανατίθεται:
 *
 * * ταξινομείται **ΚΑΘΕ** αρχείο του `src/`, όχι μια λίστα που έφτιαξε κάποιος·
 * * το άθροισμα των κάδων **πρέπει** να ισούται με τον πληθυσμό, αλλιώς `throw`·
 * * **άγνωστο σύμβολο του `next/navigation` ⇒ `throw` με όνομα** — ποτέ σιωπηλό
 *   «μένει ωμό»·
 * * τυπώνονται **και οι μη-μπλοκάροντες κάδοι, ακόμα και στο μηδέν**: ένα «0»
 *   που δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος».
 *
 * ⚠️ **Ιδempotent**: δεύτερη εκτέλεση δίνει `rewritten: 0` — το φυλά η άγκυρα.
 *
 * Χρήση:  node scripts/migrate-navigation-boundary.mjs [--apply] [--dir src]
 * Προεπιλογή: **DRY-RUN**.
 */

import path from 'node:path';
import process from 'node:process';
import { Project, QuoteKind } from 'ts-morph';

import { STATES, repoRelativePosix } from './lib/navigation-boundary/contract.mjs';
import { rewriteSourceFile } from './lib/navigation-boundary/rewrite.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dirIdx = args.indexOf('--dir');
const dir = dirIdx >= 0 ? args[dirIdx + 1] : 'src';
const ROOT = process.cwd();

// ⚠️ ΧΩΡΙΣ `tsConfigFilePath` ΕΠΙΤΗΔΕΣ. Το ξαναγράψιμο εισαγωγών είναι καθαρά
//    ΣΥΝΤΑΚΤΙΚΟ — δεν χρειάζεται επίλυση τύπων. Και το `tsconfig.json` αυτού του
//    δέντρου το **ξαναγράφει το ίδιο το Next** (ADR-787 §5.3 κ, Ε4): μια πύλη
//    που εξαρτάται από αρχείο το οποίο μεταλλάσσει τρίτος δεν είναι ντετερμινιστική.
const project = new Project({
  skipAddingFilesFromTsConfig: true,
  manipulationSettings: { quoteKind: QuoteKind.Single },
  compilerOptions: { allowJs: true },
});
project.addSourceFilesAtPaths(path.join(ROOT, dir, '**/*.{ts,tsx}').replace(/\\/g, '/'));

/** Οι καταστάσεις που **απαγορεύουν** εγγραφή — καμία μερική εφαρμογή. */
const BLOCKING = new Set([STATES.UNANALYZABLE_IMPORT, STATES.COLLATERAL_CHANGE]);

const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
const rewritten = [];
const blocked = [];
let movedTotal = 0;
let population = 0;

for (const sf of project.getSourceFiles()) {
  population += 1;
  const rel = repoRelativePosix(sf.getFilePath(), ROOT);
  const verdict = rewriteSourceFile(sf, rel);

  if (!Object.hasOwn(tally, verdict.state)) {
    throw new Error(`[codemod] ΑΓΝΩΣΤΗ κατάσταση "${verdict.state}" για ${rel} — η λογιστική δεν κλείνει.`);
  }
  tally[verdict.state] += 1;
  movedTotal += verdict.moved;

  if (verdict.state === STATES.REWRITTEN) rewritten.push(`${rel}  (+${verdict.moved})`);
  if (BLOCKING.has(verdict.state)) blocked.push(`${rel} — [${verdict.state}] ${verdict.detail}`);
}

const counted = Object.values(tally).reduce((a, b) => a + b, 0);
if (counted !== population) {
  throw new Error(`[codemod] Η ΛΟΓΙΣΤΙΚΗ ΔΕΝ ΚΛΕΙΝΕΙ: ${counted} ταξινομημένα ≠ ${population} αρχεία.`);
}

// ⚠️ ΟΛΑ Ή ΤΙΠΟΤΑ. Μία μπλοκάρουσα κατάσταση ⇒ **καμία** εγγραφή: μερική
//    εφαρμογή αφήνει το δέντρο σε κατάσταση που κανένα αρχείο δεν περιγράφει.
if (apply && blocked.length === 0) await project.save();

console.log(`\n=== ΜΕΤΑΝΑΣΤΕΥΣΗ ΣΤΟ ΣΥΝΟΡΟ — ${apply ? 'APPLY' : 'DRY-RUN'} (dir=${dir}) ===\n`);
for (const [state, n] of Object.entries(tally)) {
  const mark = BLOCKING.has(state) ? (n > 0 ? '⛔' : '✅') : '  ';
  console.log(`${mark} ${state.padEnd(24)} ${String(n).padStart(6)}`);
}
console.log(`   ${'—'.repeat(24)} ${'—'.repeat(6)}`);
console.log(`   ${'ΣΥΝΟΛΟ'.padEnd(24)} ${String(counted).padStart(6)}   (πληθυσμός: ${population})`);
console.log(`\n   σύμβολα που μετακινήθηκαν: ${movedTotal}`);

if (rewritten.length > 0) {
  console.log(`\n--- ξαναγράφτηκαν (${rewritten.length}) ---`);
  for (const line of rewritten) console.log(`  ${line}`);
}
if (blocked.length > 0) {
  console.log('');
  console.log('⛔ ΜΠΛΟΚΑΡΙΣΜΕΝΑ — ΚΑΜΙΑ εγγραφή δεν έγινε (ούτε στα υπόλοιπα):');
  for (const line of blocked) console.log(`  ${line}`);
  process.exit(1);
}
process.exit(0);
