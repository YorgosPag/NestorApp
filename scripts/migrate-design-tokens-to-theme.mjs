#!/usr/bin/env node
/**
 * ADR-770 §14 — **Codemod**: μονοθεματικά σταθερά hex → θεματικά `hsl(var(--token))`.
 *
 * Η ΘΕΡΑΠΕΙΑ, όχι η πύλη. Τα CHECK 3.39/3.40 **σταματούν την αιμορραγία**· αυτό εδώ
 * μεταναστεύει τη μάζα. Συνταγή Atlassian (η μεγαλύτερη δημόσια μετάβαση σε dark mode):
 * **codemod για τη μάζα + ratchet για το νέο** — το δεύτερο μισό υπάρχει ήδη.
 *
 * 🔑 ΤΙ ΚΑΝΕΙ ΔΙΑΦΟΡΕΤΙΚΑ ΑΠΟ ΤΟ ATLASSIAN: εκείνο **προτείνει** token και αφήνει τον
 * έλεγχο σε ανθρώπινη ανάγνωση διαφορών. Εδώ κάθε πρόταση συνοδεύεται από **αριθμητική
 * απόδειξη**, με το **ίδιο** κριτήριο της πύλης, και στα δύο θέματα:
 *
 *     colors.text.primary   #1e293b → hsl(var(--foreground))
 *       ΠΡΙΝ  φωτεινό 12,83:1 · σκοτεινό  1,01:1   ⇒ theme-flip σε 12 επιφάνειες
 *       ΜΕΤΑ  φωτεινό 12,63:1 · σκοτεινό 15,80:1   ⇒ ΚΑΘΑΡΟ
 *
 * Ο άνθρωπος εγκρίνει **σημασία** («ναι, το text.primary είναι το --foreground»), όχι
 * **αριθμούς**. Οι αριθμοί αποδεικνύονται.
 *
 * ⚠️ **DRY-RUN ΑΠΟ ΠΡΟΕΠΙΛΟΓΗ.** Το `--apply` γράφει, και το `foundations.ts` έχει **745
 * αρχεία καταναλωτές**: η μετανάστευση είναι απόφαση του Giorgio, όχι του codemod. Πρότυπο:
 * `scripts/migrate-toisostring.mjs` (ADR-314 Φ.C1) — ίδιο σχήμα, ίδια πειθαρχία, idempotent.
 *
 * ⚠️ **ΔΕΝ ΜΑΝΤΕΥΕΙ ΠΟΤΕ.** Η χαρτογράφηση είναι **ρητή** (`token-migration-map.js`) και ό,τι
 * δεν είναι μέσα **δεν μετατρέπεται** — δηλωμένο, με λόγο. Και τα δύο αυτόματα κριτήρια
 * («κοντινότερη τιμή» και «ρόλος + κοντινότερη τιμή») **μετρήθηκαν και απορρίφθηκαν**: το
 * πρώτο πρότεινε `--destructive-foreground` για το λευκό **φόντο**. Λεπτομέρειες στον πίνακα.
 *
 * ⚠️ **ΔΕΝ αγγίζει το `semanticColors`** του ίδιου αρχείου — είναι **ήδη** σωστό, και είναι
 * η απόδειξη ότι ο σωστός τρόπος ήταν γνωστός από την αρχή.
 *
 * Χρήση:
 *   node scripts/migrate-design-tokens-to-theme.mjs                 # αναφορά (dry-run)
 *   node scripts/migrate-design-tokens-to-theme.mjs --json          # μηχανική έξοδος
 *   node scripts/migrate-design-tokens-to-theme.mjs --apply         # ΓΡΑΦΕΙ (θέλει εντολή)
 *   node scripts/migrate-design-tokens-to-theme.mjs --only <path>   # μία δήλωση
 */

import { Project, SyntaxKind } from 'ts-morph';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readTokenPalette, semanticEntries } = require('./lib/contrast/ts-token-palette.js');
const { readThemes, surfaceTokens, foregroundTokens } = require('./lib/contrast/css-token-themes.js');
const { hslToRgb, contrastRatio } = require('./lib/contrast/wcag-contrast.js');
const { hexToRgb, thresholdFor } = require('./lib/contrast/theme-pairing.js');
const { TOKEN_MAP, NO_TARGET, themedValue } = require('./lib/contrast/token-migration-map.js');

const ROOT = process.cwd();
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const asJson = args.includes('--json');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

// ─── Η απόδειξη ───────────────────────────────────────────────────────────────

/**
 * Η ετυμηγορία μιας τιμής **ανά θέμα**, με το κριτήριο της πύλης.
 *
 * Για foreground/border: έναντι των **επιφανειών** του θέματος.
 * Για surface: έναντι των **θεματικών χρωμάτων κειμένου** — η ερώτηση αντιστρέφεται, όπως
 * στην ομάδα Γ2 του CHECK 3.39 (μια καρφωμένη επιφάνεια δεν γίνεται αόρατη μόνη της· γίνεται
 * φωτεινή νησίδα και χάνεται ό,τι μπαίνει πάνω της).
 */
function verdictPerTheme(rgbOf, entry, themes) {
  const { min, rule } = thresholdFor(entry);
  const out = {};
  for (const theme of ['light', 'dark']) {
    const others = entry.role === 'surface'
      ? foregroundTokens(themes[theme]).map((t) => ({ name: t.name, rgb: hslToRgb(t.hsl) }))
      : surfaceTokens(themes[theme]).map((t) => ({ name: t.name, rgb: hslToRgb(t.hsl) }));
    const mine = rgbOf(theme);
    if (!mine) { out[theme] = null; continue; }
    let failing = 0;
    let worst = Infinity;
    for (const o of others) {
      const r = contrastRatio(mine, o.rgb);
      if (r < min) failing++;
      if (r < worst) worst = r;
    }
    out[theme] = { failing, total: others.length, worst: +worst.toFixed(2) };
  }
  return { ...out, min, rule };
}

/** Το χρώμα ενός token, ανά θέμα (ή null αν δεν ορίζεται εκεί). */
function tokenRgb(tokenName, themes) {
  return (theme) => {
    const all = [...surfaceTokens(themes[theme]), ...foregroundTokens(themes[theme])];
    const found = all.find((t) => t.name === tokenName);
    if (found) return hslToRgb(found.hsl);
    // Το token μπορεί να μην ταιριάζει στα δύο μοτίβα (π.χ. `--ring`, `--input`, `--bg-*`).
    const raw = themes[theme].get(tokenName);
    if (!raw) return null;
    const m = /^\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*$/.exec(raw);
    return m ? hslToRgb({ h: +m[1], s: +m[2] / 100, l: +m[3] / 100 }) : null;
  };
}

const summarize = (v) => (v ? `αποτυγχάνει ${v.failing}/${v.total}, χειρότερο ${v.worst}:1` : 'ΔΕΝ ΟΡΙΖΕΤΑΙ');

/**
 * 🔑 Η ΚΡΙΣΙΜΗ ΜΕΤΡΙΚΗ — και γιατί **δεν** είναι το «αποτυγχάνει X/23».
 *
 * Η πρώτη εκδοχή αυτού του codemod έκρινε τη βελτίωση σε «πόσες επιφάνειες αποτυγχάνουν».
 * Το `colors.text.secondary → --muted-foreground` έβγαινε «φωτεινό αποτυγχάνει **21/23**» —
 * αριθμός αληθινός και **σημασιολογικά παραπλανητικός**: το `--muted-foreground` είναι το
 * **επίσημο** token της εφαρμογής και αποτυγχάνει σε 21 επιφάνειες μόνο επειδή οι
 * περισσότερες είναι χρωματιστά `--bg-*` που **δεν φιλοξενούν** ποτέ muted κείμενο.
 *
 * Δηλαδή η μετρική ήταν **ακριβώς εκείνη που το ADR-770 §12.3 απέρριψε μετά από μέτρηση**
 * («141/230, γεμάτο ζεύγη που δεν συμβαίνουν»), και θα είχε βαθμολογήσει τη σωστή
 * μετανάστευση ως αποτυχία.
 *
 * ⇒ Κρατιέται το κριτήριο **της πύλης**: «**αλλάζει η ετυμηγορία ανάμεσα στα δύο θέματα;**».
 * Ένα σταθερό hex έχει `flips > 0` **επειδή** είναι μονοθεματικό. Ένα θεματικό token έχει
 * `flips = 0` εξ ορισμού — αλλάζει τιμή μαζί με το θέμα. Η βελτίωση είναι **η εξάλειψη των
 * flips**, και ο δεύτερος όρος («δεν χειροτερεύει σε καμία πλευρά») εμποδίζει την ανταλλαγή
 * ενός θεματικού σφάλματος με μια μόνιμη αποτυχία.
 */
function countFlips(before) {
  if (!before.light || !before.dark) return 0;
  // Η ετυμηγορία διαφέρει ⇒ υπάρχει τουλάχιστον μία επιφάνεια που αλλάζει πλευρά.
  return Math.abs(before.light.failing - before.dark.failing);
}

function isImprovement(before, after) {
  if (!after.light || !after.dark) return false;
  const flipsBefore = countFlips(before);
  if (flipsBefore === 0) return false; // δεν υπήρχε θεματικό σφάλμα να λυθεί
  const worseSomewhere =
    after.light.failing > before.light.failing || after.dark.failing > before.dark.failing;
  return !worseSomewhere;
}

// ─── Η ανάλυση ────────────────────────────────────────────────────────────────

function analyse() {
  const palette = readTokenPalette(ROOT);
  const themes = readThemes(ROOT);
  const rows = [];

  for (const entry of semanticEntries(palette)) {
    if (only && entry.path !== only) continue;
    const token = TOKEN_MAP[entry.path];
    const reason = NO_TARGET[entry.path];

    if (!token) {
      rows.push({
        path: entry.path, file: entry.file, line: entry.line, hex: entry.hex, role: entry.role,
        status: reason ? 'no-target-declared' : 'unmapped',
        reason: reason || 'ΔΕΝ υπάρχει στον ρητό πίνακα — καμία εικασία, καμία μετατροπή.',
      });
      continue;
    }

    const before = verdictPerTheme(() => hexToRgb(entry.hex), entry, themes);
    const after = verdictPerTheme(tokenRgb(token, themes), entry, themes);
    const improves = isImprovement(before, after);

    rows.push({
      path: entry.path, file: entry.file, line: entry.line, hex: entry.hex, role: entry.role,
      token, replacement: themedValue(token),
      status: improves ? 'ready' : 'needs-review',
      before, after,
      flipsBefore: countFlips(before),
      proof:
        `ΠΡΙΝ  θεματική απόκλιση ${countFlips(before)}  ·  φωτεινό ${summarize(before.light)} · σκοτεινό ${summarize(before.dark)}\n`
        + `      ΜΕΤΑ  θεματική απόκλιση 0 (θεματικό token)  ·  φωτεινό ${summarize(after.light)} · σκοτεινό ${summarize(after.dark)}`,
    });
  }
  return { rows, palette, themes };
}

// ─── Η εγγραφή ────────────────────────────────────────────────────────────────

/**
 * Αντικαθιστά **μόνο** τη συμβολοσειρά της τιμής, στη θέση της. Το ts-morph διατηρεί
 * μορφοποίηση, σχόλια και σειρά — γι' αυτό δεν χρησιμοποιείται regex, όπως δεν
 * χρησιμοποιήθηκε στο `migrate-toisostring.mjs`. **Idempotent**: αν η τιμή είναι ήδη
 * `hsl(var(--…))`, η δήλωση δεν είναι πια `literal-hex`, οπότε δεν φτάνει καν εδώ.
 */
function applyEdits(rows) {
  const project = new Project({ tsConfigFilePath: undefined, skipAddingFilesFromTsConfig: true });
  const byFile = new Map();
  for (const r of rows) {
    if (r.status !== 'ready') continue;
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file).push(r);
  }

  let edited = 0;
  for (const [file, list] of byFile) {
    const sf = project.addSourceFileAtPath(path.join(ROOT, file));
    const wanted = new Map(list.map((r) => [r.hex.toLowerCase(), r]));
    for (const lit of sf.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
      const value = lit.getLiteralText().toLowerCase();
      const target = wanted.get(value);
      if (!target) continue;
      // Επαλήθευση θέσης: το μονοπάτι της ιδιότητας πρέπει να τελειώνει στο σωστό κλειδί.
      const parent = lit.getParentIfKind(SyntaxKind.PropertyAssignment);
      if (!parent) continue;
      const key = parent.getName().replace(/['"]/g, '');
      if (!target.path.endsWith(`.${key}`)) continue;
      lit.setLiteralValue(target.replacement);
      edited++;
    }
    sf.saveSync();
  }
  return edited;
}

// ─── Έξοδος ───────────────────────────────────────────────────────────────────

function report({ rows }) {
  const by = (s) => rows.filter((r) => r.status === s);
  console.log('ADR-770 §14 — codemod μονοθεματικών δηλώσεων → θεματικά tokens\n');
  console.log(`  σημασιολογικές δηλώσεις: ${rows.length}`);
  console.log(`  ✅ έτοιμες              : ${by('ready').length}`);
  console.log(`  ⚠️  θέλουν ανασκόπηση    : ${by('needs-review').length}`);
  console.log(`  📌 χωρίς στόχο (δηλωμένο): ${by('no-target-declared').length}`);
  console.log(`  ❓ εκτός πίνακα          : ${by('unmapped').length}\n`);

  for (const r of by('ready')) {
    console.log(`  ✅ ${r.path}`);
    console.log(`     ${r.hex} → ${r.replacement}   (${r.file}:${r.line})`);
    console.log(`     ${r.proof}\n`);
  }
  for (const r of by('needs-review')) {
    console.log(`  ⚠️  ${r.path}  ${r.hex} → ${r.replacement}`);
    console.log(`     ${r.proof}`);
    console.log('     ⇒ η πρόταση ΔΕΝ βελτιώνει και τα δύο θέματα — ανθρώπινη απόφαση.\n');
  }
  if (by('no-target-declared').length) {
    console.log('  📌 ΧΩΡΙΣ ΘΕΜΑΤΙΚΟ ΑΝΤΙΣΤΟΙΧΟ — αποφασισμένο, όχι ξεχασμένο:');
    for (const r of by('no-target-declared')) console.log(`     · ${r.path}\n       ${r.reason}`);
    console.log('');
  }
  if (by('unmapped').length) {
    console.log('  ❓ ΕΚΤΟΣ ΠΙΝΑΚΑ — πρόσθεσέ τις ρητά ή δήλωσε γιατί όχι:');
    for (const r of by('unmapped')) console.log(`     · ${r.path} (${r.hex}, ρόλος ${r.role})`);
    console.log('');
  }

  console.log(apply
    ? '  🔴 --apply: οι αλλαγές ΓΡΑΦΤΗΚΑΝ.'
    : '  ℹ️  DRY-RUN. Καμία αλλαγή. Για εγγραφή: --apply (745 καταναλωτές — θέλει εντολή).');
}

const result = analyse();
if (asJson) {
  console.log(JSON.stringify(result.rows, null, 1));
} else {
  report(result);
}
if (apply) {
  const n = applyEdits(result.rows);
  if (!asJson) console.log(`  ✍️  ${n} δηλώσεις γράφτηκαν.`);
}
