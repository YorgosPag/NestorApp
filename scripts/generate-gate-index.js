#!/usr/bin/env node
/**
 * ΓΕΝΝΗΤΟΡΑΣ ΤΟΥ ΕΥΡΕΤΗΡΙΟΥ ΠΥΛΩΝ (ADR-8xx) — `docs/gates/3.NN.md` → πίνακας του `CLAUDE.md`.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ: το `CLAUDE.md` έφτασε τους 308.200 χαρακτήρες (829 γραμμές), εκ των
 * οποίων **84% ήταν ο πίνακας των πυλών**, και φορτώνεται ΟΛΟΚΛΗΡΟ σε κάθε μήνυμα. Τα επίσημα
 * docs του Claude Code δηλώνουν στόχο **200 γραμμές** και ότι μεγαλύτερα αρχεία «reduce
 * adherence». Δεν ήταν όμως πρόβλημα μεγέθους: ήταν πρόβλημα ΑΥΘΕΝΤΙΑΣ — ο πίνακας φούσκωσε
 * επειδή ήταν το μοναδικό μέρος όπου η γνώση ήταν ασφαλής, αφού το «βαθύ» έγγραφο είχε ήδη
 * αποκλίνει **και προς τις δύο κατευθύνσεις** (25 πύλες μόνο στον πίνακα, 2 μόνο στο έγγραφο).
 *
 * 🔬 ΤΟ ΣΧΗΜΑ ΕΙΝΑΙ ΕΠΙΠΕΔΟ, ΚΑΙ ΤΟ ΑΠΟΦΑΣΙΣΕ Η ΜΕΤΡΗΣΗ: το paper arXiv 2607.17598 μέτρησε ότι
 *    το ιεραρχικό (δύο επίπεδα routing) ΠΟΤΕ δεν ξεπερνά το επίπεδο, και σε μία διαμόρφωση
 *    καταρρέει 0.91 → 0.64· τα Anthropic docs λένε ανεξάρτητα «keep references ONE LEVEL DEEP».
 *    ⇒ ΕΝΑ άλμα: `CLAUDE.md` → `docs/gates/3.NN.md`. Κανένα hub μέσα σε hub.
 *
 * ⚠️ ΤΟ ΑΠΟΤΥΠΩΜΑ ΖΕΙ ΣΕ HTML COMMENT, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ: τα block-level HTML σχόλια
 *    ΑΦΑΙΡΟΥΝΤΑΙ από το context πριν φτάσει στο μοντέλο (τεκμηριωμένο) ⇒ ο έλεγχος φρεσκάδας
 *    κοστίζει **μηδέν tokens** και παραμένει πλήρως ορατός σε όποιον διαβάζει τον δίσκο.
 *
 * CLI:
 *   node scripts/generate-gate-index.js            # εγγραφή
 *   node scripts/generate-gate-index.js --check    # μόνο κρίση (η πύλη φρεσκάδας)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readGateSources } = require('./lib/gate-index/source');
const { renderRows } = require('./lib/gate-index/render');

const ROOT = process.cwd();
const GUIDE = 'CLAUDE.md';

const BEGIN = '<!-- BEGIN GENERATED GATE INDEX';
const END = '<!-- END GENERATED GATE INDEX -->';
const HEADER = ['| CHECK | Goal | Mode | Baseline |', '|-------|------|------|----------|'];

/** Εντοπίζει την περιοχή προς αντικατάσταση. ΔΥΟ καταστάσεις, ποτέ σιωπηλή τρίτη:
 *  ήδη οριοθετημένη (τα σημάδια υπάρχουν) ή πρώτη φορά (η κεφαλίδα + οι γραμμές `| **3.N**`). */
function locateRegion(lines) {
  const b = lines.findIndex((l) => l.startsWith(BEGIN));
  const e = lines.findIndex((l) => l.trim() === END);
  if (b >= 0 && e > b) return { start: b, end: e, marked: true };
  if (b >= 0 || e >= 0) throw new Error('Μισό ζεύγος σημαδιών — η περιοχή είναι ασαφής, άρνηση εγγραφής');

  const rowIdx = lines.map((l, i) => (/^\| \*\*3\.\d+\*\* \|/.test(l) ? i : -1)).filter((i) => i >= 0);
  if (rowIdx.length === 0) throw new Error('Δεν βρέθηκε ούτε σημάδι ούτε γραμμή πίνακα');

  // Πάνω άκρο: η κεφαλίδα `| CHECK |` και ο διαχωριστής, αν προηγούνται.
  let start = rowIdx[0];
  while (start > 0 && /^\|/.test(lines[start - 1])) start--;
  // Κάτω άκρο: ΜΑΖΙ με τυχόν συνεχόμενες γραμμές που δεν αρχίζουν με «|» — είναι σπασμένη
  // εγγραφή (μετρημένο: η 3.73 έσπασε επειδή ένα literal `\n` έγινε πραγματική νέα γραμμή).
  let end = rowIdx[rowIdx.length - 1];
  while (end + 1 < lines.length && lines[end + 1] !== '' && !/^\|/.test(lines[end + 1])) end++;
  return { start, end, marked: false };
}

function build(gates, rows, fingerprint, counts) {
  return [
    `${BEGIN} — ΜΗΝ ΤΟ ΓΡΑΨΕΙΣ ΣΤΟ ΧΕΡΙ. Πηγή: docs/gates/3.NN.md · αναπαραγωγή: npm run gate-index:generate`,
    `     fingerprint: sha256:${fingerprint} -->`,
    ...HEADER,
    ...rows.map((r) => r.line),
    '',
    `**📘 Πλήρες ιστορικό ανά πύλη** (περιστατικά, μετρήσεις, «⚠️ ΜΗΝ», απορριφθείσες εναλλακτικές):`,
    '`docs/gates/<αριθμός>.md` — ή `npm run gate:explain 3.63`.',
    '',
    `⚠️ **Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ ΠΡΟΒΟΛΗ, Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ Η ΠΗΓΗ.** Χειρόγραφη αλλαγή γραμμής ΜΠΛΟΚΑΡΕΙ`,
    `(CHECK 3.66, αποτύπωμα sha256 των εισόδων — ποτέ \`mtime\`, μάθημα 3.33). Άλλαξε το`,
    `\`docs/gates/3.NN.md\` και τρέξε τον γεννήτορα.`,
    '',
    `⚠️ **Ο αριθμός της baseline ΔΕΝ ζει εδώ, επίτηδες**: ο πίνακας έγραφε «άνοιξε το JSON, μην`,
    `αντιγράψεις τον αριθμό» και ταυτόχρονα τον αντέγραφε — και πάλιωσε τεκμηριωμένα **τρεις**`,
    `φορές (N.12 · N.18 · CHECK 3.38). Στη γραμμή μένει ο **δείκτης**, και ο γεννήτορας`,
    `επαληθεύει ότι **λύνεται**. Άνοιξε το JSON.`,
    '',
    `📊 Πύλες που **τρέχουν**: **${counts.runs}** (εκτελεστής ${counts.dispatched} + hook ${counts.hooked}) ·`,
    `γραμμές εδώ: **${counts.rows}** · αδήλωτες: **${counts.undocumented}** (εκστρατεία που τελειώνει στο μηδέν).`,
    `*Αυτοί οι αριθμοί είναι **παραγόμενοι** — η προηγούμενη χειρόγραφη εκδοχή τους είχε ήδη*`,
    `*αποκλίνει (έγραφε «48 γραμμές» και «61 πύλες»).*`,
    '',
    // ⚠️ ΤΟ END ΚΛΕΙΝΕΙ ΟΛΟ ΤΟ ΠΑΡΑΓΟΜΕΝΟ ΜΠΛΟΚ, ΟΧΙ ΜΟΝΟ ΤΟΝ ΠΙΝΑΚΑ. Στην πρώτη γραφή ήταν
    //    αμέσως μετά τις γραμμές, ώστε «τα σημάδια να περιβάλλουν τον πίνακα» — και η πρόζα
    //    ΕΞΩ από αυτά ΔΙΠΛΑΣΙΑΖΟΤΑΝ σε κάθε εκτέλεση (μετρημένο ζωντανά: 2 αντίγραφα μετά τη
    //    δεύτερη). Ό,τι παράγεται ΠΡΕΠΕΙ να βρίσκεται μέσα στην περιοχή που αντικαθίσταται,
    //    αλλιώς ο γεννήτορας δεν είναι ιδεμποτεντικός (N.7.2 #3) και το `--check` δεν κλείνει ποτέ.
    END,
  ].join('\n');
}

function main(argv) {
  const check = argv.includes('--check');
  const { gates, fingerprint } = readGateSources(ROOT);
  const { rows, problems, total } = renderRows(gates, ROOT);

  if (problems.length) {
    console.error(`⛔ ΑΡΝΗΣΗ ΠΑΡΑΓΩΓΗΣ — ${problems.length} πρόβλημα(τα):`);
    for (const p of problems) console.error(`   • ${p}`);
    return 1;
  }

  // Οι μετρήσεις έρχονται από την ΙΔΙΑ απογραφή που κρίνει το CHECK 3.66 — καμία δεύτερη μηχανή.
  const { takeInventory } = require('./lib/gate-inventory/inventory');
  const { judge, STATES, idsOf } = require('./lib/gate-inventory/judge');
  const inv = takeInventory(ROOT);
  const counts = { ...inv.counts, rows: rows.length, undocumented: idsOf(judge(inv), STATES.UNDOCUMENTED).length };

  const raw = fs.readFileSync(path.join(ROOT, GUIDE), 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const region = locateRegion(lines);
  const block = build(gates, rows, fingerprint, counts).split('\n');
  const next = [...lines.slice(0, region.start), ...block, ...lines.slice(region.end + 1)].join(eol);

  if (check) {
    if (next === raw) { console.log(`✅ CLAUDE.md φρέσκο (sha256:${fingerprint.slice(0, 12)}…, ${rows.length} πύλες)`); return 0; }
    console.error('⛔ ΤΟ CLAUDE.md ΕΙΝΑΙ ΜΠΑΓΙΑΤΙΚΟ ως προς το docs/gates/');
    console.error(`   Αναμενόμενο αποτύπωμα: sha256:${fingerprint}`);
    console.error('   Διόρθωση: npm run gate-index:generate');
    return 1;
  }

  fs.writeFileSync(path.join(ROOT, GUIDE), next, 'utf8');
  const before = raw.length, after = next.length;
  console.log(`✅ Παράχθηκε ο πίνακας: ${rows.length} πύλες · ${total.toLocaleString('el')} χαρακτήρες`);
  console.log(`   CLAUDE.md: ${before.toLocaleString('el')} → ${after.toLocaleString('el')} χαρακτήρες (−${Math.round((1 - after / before) * 100)}%)`);
  console.log(`   fingerprint: sha256:${fingerprint.slice(0, 16)}…`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main, locateRegion, BEGIN, END };
