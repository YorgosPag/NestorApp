#!/usr/bin/env node
/**
 * `npm run gate:explain 3.63` — το πλήρες ιστορικό μιας πύλης, ON DEMAND (ADR-8xx).
 *
 * 🏆 ΠΡΟΤΥΠΟ: `rustc --explain E0592`. Ο rustc κρατά ΕΝΑ markdown ανά κωδικό σφάλματος και το
 *    δείχνει μόνο όταν το ζητήσεις — το μήνυμα σφάλματος μένει σύντομο, η εξήγηση πλήρης.
 *    Η ArchiCAD κάνει το ίδιο με το κουμπί `i` δίπλα σε κάθε κανόνα Model Checking.
 *
 * ⚠️ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΔΕΥΤΕΡΟ ΕΠΙΠΕΔΟ ΤΗΣ ΚΛΙΜΑΚΩΤΗΣ ΑΠΟΚΑΛΥΨΗΣ, ΚΑΙ ΤΟ ΤΕΛΕΥΤΑΙΟ. Το paper
 *    arXiv 2607.17598 μέτρησε ότι ένα ΤΡΙΤΟ επίπεδο («hub → sub-hub → αρχείο») ΠΟΤΕ δεν
 *    ξεπερνά το επίπεδο σχήμα και σε μία διαμόρφωση καταρρέει 0.91 → 0.64. Τα Anthropic docs
 *    λένε ανεξάρτητα «keep references ONE LEVEL DEEP». ⇒ ΜΗΝ προσθέσεις ενδιάμεσο hub.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readGateSources, GATES_DIR } = require('./lib/gate-index/source');

function normalize(arg) {
  const m = String(arg || '').match(/(\d+\.\d+)/);
  return m ? m[1] : null;
}

function main(argv) {
  const want = normalize(argv[0]);
  const { gates } = readGateSources(process.cwd());

  if (!want) {
    console.log(`Χρήση: npm run gate:explain <αριθμός>   π.χ. 3.63\n`);
    console.log(`${gates.length} πύλες:`);
    for (const g of gates) {
      console.log(`  ${g.gate.padEnd(6)} ${(g.title || g.body.slice(0, 60)).replace(/\*\*/g, '').slice(0, 70)}`);
    }
    return 0;
  }

  const g = gates.find((x) => x.gate === want);
  if (!g) {
    // ⚠️ «Δεν βρέθηκε» ΠΟΤΕ σιωπηλά: ονομάζουμε τι υπάρχει, αλλιώς ο επόμενος υποθέτει ότι
    //    η πύλη δεν υπάρχει ενώ απλώς έγραψε λάθος αριθμό.
    const near = gates.map((x) => x.gate).filter((x) => x.startsWith(want.slice(0, 3)));
    console.error(`⛔ Δεν υπάρχει ${GATES_DIR}/${want}.md`);
    if (near.length) console.error(`   κοντινές: ${near.join(' · ')}`);
    console.error(`   όλες: npm run gate:explain`);
    return 1;
  }

  const file = `${GATES_DIR}/${g.gate}.md`;
  console.log(`\n${'═'.repeat(78)}`);
  console.log(`CHECK ${g.gate}${g.title ? ' — ' + g.title.replace(/\*\*/g, '') : ''}`);
  console.log('═'.repeat(78));
  const meta = [
    g.adr && `ADR: ${g.adr}`,
    g.mechanism && `Μηχανισμός: ${g.mechanism.replace(/\*\*/g, '')}`,
    g.baseline && `Baseline: ${g.baseline.replace(/`/g, '')}`,
    g.tests && `Tests: ${g.tests}`,
    g.escape && `Escape: ${g.escape}=1`,
  ].filter(Boolean);
  for (const m of meta) console.log(`  ${m}`);
  console.log(`  Πηγή: ${file}`);
  console.log('─'.repeat(78));
  console.log(fs.readFileSync(path.join(process.cwd(), file), 'utf8').replace(/^---[\s\S]*?---\r?\n/, '').trim());
  console.log('');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main, normalize };
