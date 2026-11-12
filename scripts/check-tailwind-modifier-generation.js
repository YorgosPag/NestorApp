#!/usr/bin/env node
/**
 * CHECK 3.116 — **η πύλη του σιωπηλά πεταμένου modifier** (ADR-940). ⛔ ZERO TOLERANCE, **καμία baseline**.
 *
 * «Γράφει κάποιος κλάση Tailwind με modifier που ο compiler **ΔΕΝ** θα παραγάγει;»
 *
 * ## ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ADR-770 §11 (2026-11-12): το `bg-[hsl(var(--hue-purple))]/12` στα τσιπ εικονιδίων **δεν αποδόθηκε ΠΟΤΕ**.
 * Ο Tailwind 3.4 παράγει modifier διαφάνειας μόνο για βήματα της `theme.opacity` (0·5·10·…·100) και πετά τα
 * υπόλοιπα **σιωπηλά**: κανένα σφάλμα build, καμία προειδοποίηση — διάφανο φόντο. Το `/12` υπήρχε στο
 * `NavigationCard` από πριν (pink/indigo/teal) και το βρήκε **ζωντανή μέτρηση** στον browser
 * (`document.styleSheets`), όχι καμία από τις 105 πύλες. Η σωστή γραφή εκτός κλίμακας είναι `/[0.12]`.
 *
 * ## 🔑 ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ, ΚΑΜΙΑ ΧΕΙΡΟΓΡΑΦΗ ΚΛΙΜΑΚΑ
 * Αυθεντία = ο ίδιος ο compiler (`scripts/lib/tailwind/engine.js`): `getClassOrder` (το API του επίσημου
 * `prettier-plugin-tailwindcss`) για το «παράγεται;», ο `defaultExtractor` του build για το «ποιες είναι οι
 * υποψήφιες», τα globs του `content` για το «ποια αρχεία βλέπει το build». Μετρημένο: το `w-1/12` (κλάσμα)
 * παράγεται, το `bg-primary/12` όχι — ένα regex θα κατηγορούσε το πρώτο. Αναβάθμιση του Tailwind ή επέκταση του
 * `opacity` αλλάζουν την απάντηση **μόνες τους**.
 *
 * ## ΒΑΘΜΟΝΟΜΗΣΗ (μετρημένη, όχι ελπιζόμενη)
 * `aec900e2~1`: **7** πεταμένα (`NavigationCard` ×4 · `QuickActionsStrip` ×1 · `stat-tone` ×2) — ακριβώς τα
 * σημεία της διόρθωσης. Σήμερα: **0** ⇒ zero-tol εφικτό χωρίς baseline (πρότυπο 3.48 · 3.55).
 *
 * ## ΕΜΒΕΛΕΙΑ — ΔΗΛΩΜΕΝΗ
 * Αρχεία παραγωγής (όχι tests) που **σαρώνει το build** (`content` του Tailwind).
 *
 * ## ΔΕΥΤΕΡΟ ΚΡΙΤΗΡΙΟ — ΤΟ ΞΕΧΑΣΜΕΝΟ ΑΡΧΕΙΟ (ADR-940 §9)
 * Κλάση σε αρχείο ΕΚΤΟΣ `content` δεν παράγεται **ποτέ**, με ή χωρίς modifier — και το κριτήριο του modifier
 * ΔΕΝ μπορεί να το δει (κρίνει μόνο ό,τι σαρώνει το build). Άρα: κάθε αρχείο κώδικα του `src/` είτε **σαρώνεται**
 * είτε ταιριάζει σε **δηλωμένη** εξαίρεση `!…` του `content` (`engine.isExcludedFile`). Τρίτη περίπτωση =
 * «ξεχασμένο» ⇒ ⛔. Μετρημένο 2026-11-12, πριν σαρωθεί όλο το `src/`: 3.962 ξεχασμένα αρχεία παραγωγής, 14 κλάσεις
 * που δεν παράγονταν ποτέ (`ring-primary/40` του `ListCard` · `rounded-r-full` του `CardSelectionIndicator`).
 *
 * CLI:
 *   node scripts/check-tailwind-modifier-generation.js <αρχεία…> [--index]   # σταδιοποιημένα (hook)
 *   node scripts/check-tailwind-modifier-generation.js --all                 # πλήρης σάρωση (CI)
 *   node scripts/check-tailwind-modifier-generation.js --report              # λογιστική
 *
 * Escape: `SKIP_TAILWIND_MODIFIER=1`
 */

'use strict';

const path = require('node:path');
const { openGateInput, isTestSource, INDEX_FLAG, MIN_PRODUCTION_SOURCES } = require('./lib/gate-input');
const { loadTailwindEngine } = require('./lib/tailwind/engine');
const { judgeText, STATES, BLOCKING } = require('./lib/tailwind/modifier-generation');

const ROOT = path.resolve(__dirname, '..');
const ALL_STATES = Object.values(STATES);
const SCAN_EXT = /\.(js|jsx|ts|tsx|mdx)$/;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

/** Κρίνεται; = αρχείο παραγωγής που σαρώνει το build. */
const inScope = (engine) => (rel) => SCAN_EXT.test(rel) && !isTestSource(rel) && engine.isContentFile(rel);

/** Ξεχασμένο; = αρχείο κώδικα του `src/` που το build ΔΕΝ σαρώνει και ΚΑΜΙΑ δηλωμένη εξαίρεση δεν εξηγεί. */
const isForgotten = (engine) => (rel) => rel.startsWith('src/') && SCAN_EXT.test(rel)
  && !engine.isContentFile(rel) && !engine.isExcludedFile(rel);

/** Τα ξεχασμένα όλου του `src/` — και tests: αν δεν εξαιρούνται ρητά, πρέπει να σαρώνονται. */
function collectForgotten(input, engine) {
  return input.files(['src'], { accept: isForgotten(engine) }).map(input.rel);
}

/** Όλα τα αρχεία της εμβέλειας — με φρουρό «δεν κοίταξε». */
function collectAll(input, engine) {
  const accept = inScope(engine);
  return input.files(['src'], { accept, minimum: MIN_PRODUCTION_SOURCES }).map(input.rel);
}

/**
 * Η λογιστική: κάθε υποψήφια με modifier σε ΕΝΑΝ κάδο. ΜΟΝΟ από την είσοδο (ADR-924).
 * @param {string[]} files σχετικά με τη ρίζα
 */
function measure(files, { input, engine }) {
  const ledger = Object.fromEntries(ALL_STATES.map((s) => [s, 0]));
  const blocked = [];
  let total = 0;
  let scanned = 0;
  for (const file of files) {
    const text = input.read(file);
    if (text === null) continue;
    scanned += 1;
    for (const c of judgeText(text, engine).candidates) {
      if (!ALL_STATES.includes(c.state)) {
        throw new Error(`CHECK 3.116: άγνωστη κατάσταση «${c.state}» στο ${file} — η λογιστική δεν χάνει υποψήφια σιωπηλά.`);
      }
      total += 1;
      ledger[c.state] += 1;
      if (BLOCKING.includes(c.state)) blocked.push({ file, ...c });
    }
  }
  return { ledger, blocked, total, scanned };
}

function printReport(m, forgotten) {
  console.log(`\nCHECK 3.116 — modifiers Tailwind σε ${m.scanned} αρχεία (εμβέλεια: content του build, χωρίς tests)\n`);
  console.log(`  ⛔ ${'ξεχασμένα'.padEnd(14)} ${forgotten.length}   (αρχεία του src/ εκτός content, χωρίς δηλωμένη εξαίρεση)\n`);
  // ⚠️ Κάθε κάδος τυπώνεται ΚΑΙ ΣΤΟ ΜΗΔΕΝ: ένα «0» που δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος».
  for (const state of ALL_STATES) {
    const mark = BLOCKING.includes(state) ? '⛔' : (state === STATES.GENERATED ? '✅' : '➖');
    console.log(`  ${mark} ${state.padEnd(14)} ${m.ledger[state]}`);
  }
  console.log(`  ${''.padEnd(17)} ─────\n  ${'ΣΥΝΟΛΟ'.padEnd(17)} ${m.total}\n`);
}

function printBlocked(blocked) {
  console.log(`\n${RED}═══════════════════════════════════════════════════════════════${NC}`);
  console.log(`${RED}  🚫 COMMIT BLOCKED — modifier που ο Tailwind ΔΕΝ παράγει (CHECK 3.116)${NC}`);
  console.log(`${RED}  Η κλάση πετιέται ΣΙΩΠΗΛΑ στο build: κανένα σφάλμα, κανένα στυλ.${NC}`);
  console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}\n`);
  for (const b of blocked) console.log(`  ❌ ${b.file}:${b.line}  ${b.token}   (η βάση «${b.base}» παράγεται· το «/${b.modifier}» όχι)`);
  console.log(`\n  ${YELLOW}Λύση:${NC} βήμα της κλίμακας (\`/10\`, \`/15\`, …) ή αυθαίρετη τιμή σε αγκύλες:`);
  console.log('       bg-primary/12  →  bg-primary/10   ή   bg-primary/[0.12]');
  console.log(`  ${YELLOW}Κλίμακα = theme.opacity του tailwind.config.ts (ADR-940).${NC}\n`);
}

function printForgotten(forgotten) {
  console.log(`\n${RED}═══════════════════════════════════════════════════════════════${NC}`);
  console.log(`${RED}  🚫 COMMIT BLOCKED — αρχείο που το build του Tailwind ΔΕΝ σαρώνει (CHECK 3.116)${NC}`);
  console.log(`${RED}  Καμία κλάση του δεν παράγεται ΠΟΤΕ — σιωπηλά, όσο σωστά κι αν είναι γραμμένη.${NC}`);
  console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}\n`);
  for (const f of forgotten.slice(0, 50)) console.log(`  ❌ ${f}`);
  if (forgotten.length > 50) console.log(`  … και ${forgotten.length - 50} ακόμα`);
  console.log(`\n  ${YELLOW}Λύση:${NC} το \`content\` του tailwind.config.ts σαρώνει ΟΛΟ το src/ — μην το στενεύεις.`);
  console.log('       Αν το αρχείο ΠΡΕΠΕΙ να μείνει εκτός: δηλωμένη γραμμή `!./src/…` με λόγο (ADR-940 §9).\n');
}

/** Τα ορίσματα της γραμμής εντολών ως διαδρομές σχετικές με τη ρίζα, posix. */
function relArgs(argv) {
  return argv.slice(2).filter((a) => !a.startsWith('--'))
    .map((f) => f.replace(/\\/g, '/').replace(/^\.\//, ''))
    .map((f) => (path.isAbsolute(f) ? path.relative(ROOT, f).replace(/\\/g, '/') : f));
}

function main(argv = process.argv) {
  if (process.env.SKIP_TAILWIND_MODIFIER) return 0;
  const all = argv.includes('--all');
  const report = argv.includes('--report');
  const input = openGateInput({ root: ROOT, index: argv.includes(INDEX_FLAG) });
  const engine = loadTailwindEngine(ROOT, input);
  const full = all || report;
  const args = full ? [] : relArgs(argv);
  const forgotten = full ? collectForgotten(input, engine) : args.filter(isForgotten(engine));
  if (forgotten.length && !report) {
    printForgotten(forgotten);
    return 1;
  }
  const files = full ? collectAll(input, engine) : args.filter(inScope(engine));
  if (!files.length) return 0;

  const m = measure(files, { input, engine });
  const summed = ALL_STATES.reduce((acc, s) => acc + m.ledger[s], 0);
  if (summed !== m.total) {
    console.error(`${RED}CHECK 3.116: η λογιστική δεν κλείνει (${summed} ≠ ${m.total}) — fail-closed.${NC}`);
    return 1;
  }
  if (report) {
    printReport(m, forgotten);
    return (m.blocked.length || forgotten.length) ? 1 : 0;
  }
  if (m.blocked.length) {
    printBlocked(m.blocked);
    return 1;
  }
  if (all) console.log(`${GREEN}✅ CHECK 3.116 — κανένας πεταμένος modifier · κανένα ξεχασμένο αρχείο${NC} (${m.scanned} αρχεία · ${m.ledger.generated} modifiers παράγονται)`);
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (e) {
    console.error(`${RED}❌ CHECK 3.116 — ${e.message}${NC}`);
    process.exit(1);
  }
}

module.exports = { measure, collectAll, collectForgotten, inScope, isForgotten, main };
