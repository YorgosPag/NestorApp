#!/usr/bin/env node
/**
 * CHECK 3.64 — Ο ΕΚΤΕΛΕΣΤΗΣ ΤΗΣ ΑΠΟΓΡΑΦΗΣ (ADR-799 Φάση 2)
 *
 * Τρέχει τη σουίτα με **ανοιχτό sink** στον πραγματικό μετρητή και υπογράφει το αποτέλεσμα.
 *
 * ⚠️ **ΔΕΝ ΦΤΙΑΧΝΕΙ ΔΕΥΤΕΡΟ `jest.config`** — και είναι απόφαση, όχι παράλειψη: το CHECK 3.47
 * ανακαλύπτει τους εκτελεστές ως `jest.config*.js`, οπότε ένα νέο config θα διεκδικούσε τα
 * ίδια αρχεία με το root και θα γεννούσε `multi-owned` σε **ολόκληρο** το δέντρο. Η απογραφή
 * περνά το setup από το **CLI**, άρα δεν είναι εκτελεστής — είναι **η ίδια** εκτέλεση με
 * ανοιχτό όργανο.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΤΩΝ ΟΡΙΣΜΑΤΩΝ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**: το `--setupFilesAfterEnv` του jest είναι
 * **πίνακας**, οπότε ένα διαδρομικό όρισμα ΜΕΤΑ από αυτό ροφιέται μέσα στον πίνακα και ο jest
 * σκάει με «Module … was not found». Το scope μπαίνει **ΠΡΩΤΟ**. (Πληρώθηκε ζωντανά.)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { CENSUS_DIR, CENSUS_FILE, writeCensus, isBlind } = require('./lib/text-measure-tier/census.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SCOPE = 'src/subapps/dxf-viewer';
const SETUP = './scripts/lib/text-measure-tier/census-setup.js';

function main(argv = process.argv) {
  const scope = argv.slice(2).filter((a) => !a.startsWith('--'))[0] || DEFAULT_SCOPE;

  fs.rmSync(path.join(REPO_ROOT, CENSUS_DIR), { recursive: true, force: true });
  console.log(`📋 CHECK 3.64 — απογραφή βαθμίδας σε: ${scope}`);

  const run = spawnSync(
    'npx',
    ['jest', scope, `--setupFilesAfterEnv=${SETUP}`, '--silent'],
    { cwd: REPO_ROOT, stdio: 'inherit', shell: true },
  );
  // ⚠️ Κόκκινη σουίτα ΔΕΝ ακυρώνει την απογραφή: οι παρατηρήσεις είναι **ανεξάρτητες** από το
  //    αν πέρασε ο ισχυρισμός — αυτό ακριβώς είναι το νόημα («πράσινο σε τυφλή βαθμίδα»).
  if (run.error) throw run.error;

  const payload = writeCensus(REPO_ROOT);
  const blind = payload.observations.filter(isBlind);
  console.log(`\n📋 ${CENSUS_FILE}: ${payload.observations.length} σουίτες άγγιξαν τον μετρητή`);
  console.log(`   🔴 τυφλές (nominal + ζητημένο στυλ): ${blind.length}`);
  for (const o of blind) console.log(`      ${o.file}  [${o.dropped.join('+')}]`);
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`⛔ CHECK 3.64 — ${error.message}`);
    process.exit(1);
  }
}

module.exports = { main, DEFAULT_SCOPE };
