#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.55 (ADR-785) — ΠΥΛΗ ΠΡΟΑΠΟΔΟΣΙΜΟΤΗΤΑΣ
 * =============================================================================
 *
 * «**ΜΠΟΡΕΙ** αυτή η διαδρομή να προαποδοθεί, ή θα ρίξει το `next build`;»
 *
 * ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ
 * ---------------------------------------------------------
 * Το `docker-build.yml` (**Tier 1**, η ΜΟΝΗ πύλη της παραγωγής) ήταν **κόκκινο
 * από τις 2026-08-11** και **καμία** άλλη πύλη δεν το έβλεπε: **οκτώ μέρες
 * χωρίς deploy στο Netcup**. Αιτία: `useSearchParams()` χωρίς όριο `<Suspense>`
 * στο `/auth/action`. Το ίδιο σφάλμα αναπαράχθηκε τοπικά (`pnpm build`, 22,6′).
 *
 * 🏆 ΓΙΑΤΙ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΑ ΠΕΡΑ ΑΠΟ ΤΟ ΟΙΚΟΣΥΣΤΗΜΑ — ΕΠΑΛΗΘΕΥΜΕΝΟ
 * ------------------------------------------------------------------
 * Ο **επίσημος** πίνακας κανόνων του `@next/eslint-plugin-next` έχει **21**
 * κανόνες και **κανέναν** για `useSearchParams`/`Suspense` (nextjs.org/docs/
 * app/api-reference/config/eslint, 2026-08). Δεν υπάρχει ούτε κοινοτικό plugin.
 * Ο **μόνος** ανιχνευτής σε όλο το οικοσύστημα είναι **το ίδιο το build** — και
 * είναι δομικά ανίκανος να απαντήσει «πόσες»: `exiting the build` στον **πρώτο**.
 * Γι' αυτό μαζεύτηκαν παραβάτες χωρίς να το μάθει κανείς.
 *
 * Αυτή η πύλη απαντά **για ΟΛΟ το δέντρο**, σε **~10s** αντί για 22,6 λεπτά.
 *
 * ΤΟ ΚΡΙΤΗΡΙΟ ΑΛΛΑΞΕ ΑΠΟ ΤΗ ΜΕΤΡΗΣΗ, ΟΧΙ ΑΠΟ ΓΝΩΜΗ
 * -------------------------------------------------
 * Το προφανές «περιέχει `<Suspense>` το αρχείο;» δίνει **8 ευρήματα / 7 ψευδώς
 * θετικά = 87%** (πήχης Google για μπλοκάρουσα πύλη: **<10%**): επτά σελίδες
 * `procurement` ζουν κάτω από το `src/app/(app)/loading.tsx`, που **ΕΙΝΑΙ** όριο
 * `<Suspense>` — το φτιάχνει το ίδιο το Next. Το κρίσιμο κριτήριο είναι η
 * **ιεραρχία της διαδρομής**, όχι το περιεχόμενο του αρχείου.
 *
 * ΒΑΘΜΟΝΟΜΗΣΗ ΣΕ ΠΡΑΓΜΑΤΙΚΗ ΑΛΗΘΕΙΑ ΕΔΑΦΟΥΣ
 * -------------------------------------------
 * Η πύλη ονομάζει **ακριβώς** ό,τι ονόμασε το build και το CI log της 11/08:
 * `/auth/action`, και **τίποτε άλλο**. Δύο ανεξάρτητες επιβεβαιώσεις του
 * μοντέλου: (α) `guarded-inline` = **ακριβώς** οι 3 σελίδες που τυλίγουν σωστά
 * μόνες τους· (β) `guarded-by-route` **με** εχθρικό API = **17** σελίδες που
 * κρέμονται από **ΕΝΑ** αρχείο — γεγονός που κανείς δεν έβλεπε πριν.
 *
 * ⚠️ ΜΗΝ το κάνεις ratchet. Δεν υπάρχει «λιγότερες σπασμένες σελίδες από χθες»:
 *    **μία** αρκεί για να μη φύγει τίποτα στην παραγωγή. Είναι εφικτό ως
 *    zero-tolerance **επειδή** το ίδιο commit καθαρίζει τον μοναδικό παραβάτη —
 *    μετρημένο, όχι ελπιζόμενο.
 * ⚠️ ΜΗΝ «λύσεις» κόκκινο με `export const dynamic = 'force-dynamic'` χωρίς λόγο:
 *    δεν είναι λάθος, αλλά πετά **ολόκληρη** τη στατική βελτιστοποίηση της
 *    διαδρομής. Γι' αυτό είναι **ονομασμένη κατάσταση** που τυπώνεται πάντα —
 *    για να μην μπορεί να κρυφτεί ως «καθαρό».
 * ⚠️ ΤΟ ΣΤΡΩΜΑ 1 ΕΧΕΙ ΔΗΛΩΜΕΝΟ ΚΕΝΟ: η σκανδάλη ρωτά τα σταδιοποιημένα αρχεία.
 *    Ένα component που αρχίζει να ζωγραφίζει **άλλο** εχθρικό component, χωρίς
 *    να αναφέρει το ίδιο ούτε `useSearchParams` ούτε `Suspense`, δεν πυροδοτεί.
 *    Γι' αυτό το **Στρώμα 2 τρέχει ΑΝΕΥ ΟΡΩΝ** στο CI.
 *
 * Escape: SKIP_PRERENDER_BAILOUT=1
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { judgeAll, STATES, ZERO_TOLERANCE, ALL_STATES } = require('./lib/prerender/judge');

const PROJECT_ROOT = path.join(__dirname, '..');
const CHECK = 'CHECK 3.55 (ADR-785)';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

const SCAN_ALL = process.argv.includes('--all');
const REPORT = process.argv.includes('--report');

/** 🔶 Δηλωμένα κενά: μετριούνται και τυπώνονται, δεν μπλοκάρουν. */
const DECLARED_GAPS = Object.freeze([STATES.OPTED_OUT]);

/**
 * Η ΣΚΑΝΔΑΛΗ ΖΕΙ ΜΕΣΑ ΣΤΗΝ ΠΥΛΗ, ΟΧΙ ΣΕ ΛΙΣΤΑ ΜΟΝΟΠΑΤΙΩΝ.
 *
 * Μια λίστα φακέλων στο `run-checks-parallel.js` θα ήταν **δεύτερη αυθεντία**
 * και θα απέκλινε σιωπηλά (το σχήμα που είχε αποκλίνει κατά 63 στο CHECK 3.34).
 * Η ανάλυση είναι **πάντα πλήρης** όταν πυροδοτεί: μια μερική είναι αναληθής,
 * γιατί το ερώτημα είναι για την **κλειστότητα**, όχι για το αρχείο.
 */
function shouldRun(stagedFiles) {
  return stagedFiles.some(file => {
    const posix = file.split(path.sep).join('/');
    if (posix.startsWith('src/app/')) return true;
    if (posix.startsWith('scripts/lib/prerender/') || posix.endsWith('check-prerender-bailout.js')) return true;
    if (!/\.(t|j)sx?$/.test(posix)) return false;
    const abs = path.join(PROJECT_ROOT, posix);
    if (!fs.existsSync(abs)) return true; // διαγραφή ⇒ μπορεί να έσβησε φρουρό
    const text = fs.readFileSync(abs, 'utf8');
    return text.includes('useSearchParams') || text.includes('Suspense');
  });
}

function markFor(state) {
  if (ZERO_TOLERANCE.includes(state)) return '⛔';
  if (DECLARED_GAPS.includes(state)) return '🔶';
  return '✅';
}

function printCensus(records, census) {
  const loadBearing = records.filter(r => r.state === STATES.GUARDED && r.hostileInClosure);
  console.log(`\n${CHECK} — προαποδοσιμότητα · ${records.length} ρίζες κάτω από src/app\n`);
  // Οι κάδοι τυπώνονται ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ (μάθημα CHECK 3.48 Κ6): ένα «0» που
  // δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος».
  for (const state of ALL_STATES) {
    console.log(`  ${markFor(state)} ${state.padEnd(26)} ${String(census[state]).padStart(5)}`);
  }
  console.log(`  ${''.padEnd(29)} ─────`);
  console.log(`  ${'ΣΥΝΟΛΟ'.padEnd(29)} ${String(records.length).padStart(5)}\n`);
  console.log(`  ${DIM}από τις φρουρημένες, ΕΧΟΥΝ όντως εχθρικό API: ${loadBearing.length}${NC}`);
  console.log(`  ${DIM}(ο παρονομαστής: χωρίς αυτόν, «φρουρημένο» δεν ξεχωρίζει από «τίποτα να φρουρήσει»)${NC}`);
  return loadBearing;
}

function printLoadBearing(loadBearing) {
  const byGuard = new Map();
  for (const record of loadBearing) {
    const list = byGuard.get(record.detail) || [];
    list.push(record.url);
    byGuard.set(record.detail, list);
  }
  console.log(`\n  φορτίο ανά φρουρό:`);
  for (const [guard, urls] of [...byGuard].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`    ${String(urls.length).padStart(3)} × ${guard}`);
  }
  console.log(`  ${DIM}(σβήσιμο ενός τέτοιου αρχείου ρίχνει ΟΛΕΣ αυτές τις διαδρομές στο build)${NC}\n`);
}

function printBlocked(blocked) {
  console.log(`\n${RED}═══════════════════════════════════════════════════════════════${NC}`);
  console.log(`${RED}  🚫 COMMIT BLOCKED — η διαδρομή ΔΕΝ μπορεί να προαποδοθεί (${CHECK})${NC}`);
  console.log(`${RED}  Αυτό ΔΕΝ είναι προειδοποίηση: το \`next build\` σταματά εδώ${NC}`);
  console.log(`${RED}  ⇒ κανένα deploy στο Netcup, για ΟΛΟ το repo.${NC}`);
  console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}\n`);
  for (const record of blocked) {
    console.log(`  ❌ ${record.url}  ${DIM}[${record.state}]${NC}`);
    console.log(`     ${record.file}`);
    for (const hit of record.hits.slice(0, 5)) {
      console.log(`       ${hit.api}()  ←  ${hit.file} · ${hit.local}`);
    }
    if (record.hits.length > 5) console.log(`       ${DIM}(+${record.hits.length - 5} ακόμη)${NC}`);
  }
  console.log(`\n  ${YELLOW}Η ΛΥΣΗ ΠΟΥ ΣΥΣΤΗΝΕΙ ΤΟ NEXT (και ήδη εφαρμόζει αυτό το repo):${NC}`);
  console.log(`  ${YELLOW}τύλιξε το ΜΙΚΡΟΤΕΡΟ υποδέντρο που καλεί το hook σε <Suspense>.${NC}`);
  console.log(`  ${DIM}Πρότυπο στο δέντρο: src/app/(auth)/oauth/consent/page.tsx${NC}`);
  console.log(`  ${DIM}  · εσωτερικό component με το hook, default export = <Suspense><Inner/></Suspense>${NC}`);
  console.log(`  ${DIM}Εναλλακτικά ένα loading.tsx στο τμήμα — αλλά αυτό αλλάζει και το UX.${NC}`);
  console.log(`  ${DIM}ΜΗΝ βάλεις force-dynamic για να «περάσει»: πετά τη στατική απόδοση.${NC}\n`);
}

function main() {
  if (process.env.SKIP_PRERENDER_BAILOUT === '1') process.exit(0);

  const staged = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  if (!SCAN_ALL && !REPORT && !shouldRun(staged)) process.exit(0);

  const { records, census } = judgeAll(PROJECT_ROOT);
  if (records.length === 0) {
    console.error(`${RED}${CHECK}: δεν βρέθηκε καμία ρίζα κάτω από src/app — η πύλη ΑΡΝΕΙΤΑΙ να πει «καθαρό».${NC}`);
    process.exit(1);
  }

  const blocked = records.filter(record => ZERO_TOLERANCE.includes(record.state));

  if (REPORT) {
    const loadBearing = printCensus(records, census);
    printLoadBearing(loadBearing);
    const blind = records.reduce((sum, r) => sum + r.unresolved, 0);
    console.log(`  ${DIM}ανεπίλυτες ακμές απόδοσης (δηλωμένο τυφλό σημείο): ${blind}${NC}`);
    console.log(`  ${DIM}— υπολογισμένες ετικέτες (const Icon = MAP[x]) και εξωτερικά πακέτα${NC}\n`);
    if (blocked.length) printBlocked(blocked);
    process.exit(0);
  }

  if (blocked.length) {
    printBlocked(blocked);
    process.exit(1);
  }

  const guardedCount = census[STATES.GUARDED] + census[STATES.INLINE_GUARDED];
  console.log(
    `${GREEN}✅ ${CHECK} — κάθε ρίζα προαποδίδεται${NC} ` +
      `(${records.length} ρίζες· ${guardedCount} φρουρημένες· ${census[STATES.OPTED_OUT]} εκτός προαπόδοσης)`
  );
  process.exit(0);
}

main();
