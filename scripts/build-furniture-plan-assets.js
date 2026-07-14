/**
 * Furniture-plan asset builder — thin CLI πάνω στη ΚΟΙΝΗ μηχανή entourage (ADR-654 M1).
 *
 * Offline, εφάπαξ. Ειδικό μόνο ως προς τις ΔΥΟ πηγές του pack των επίπλων (root + χαλιά) και το
 * prefix `furn`. Όλη η μηχανική (TIF → alpha-split → WebP + manifest) ζει στο κοινό
 * `scripts/lib/entourage-asset-builder.js` — ίδια με άνθρωποι/οχήματα (N.18: μηδέν clone).
 *
 * ⚠️ Τα ids παραμένουν ΑΚΡΙΒΩΣ ίδια (`furn-<group>-<stem>-<n>`) ⇒ κανένα ήδη ανεβασμένο asset δεν
 * αλλάζει ταυτότητα. Καθαρό internal refactor του offline builder — μηδέν αλλαγή στο runtime.
 *
 * Χρήση:
 *   node scripts/build-furniture-plan-assets.js --pilot   # μόνο το επαληθευμένο δείγμα
 *   node scripts/build-furniture-plan-assets.js           # όλο το pack
 *
 * @see scripts/lib/entourage-asset-builder.js — η μηχανή
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

const path = require('node:path');
const { buildEntouragePack } = require('./lib/entourage-asset-builder');

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(REPO_ROOT, 'images');
const OUT_ROOT = path.join(REPO_ROOT, 'public', 'furniture-2d');

/** Τα 8 αρχεία που επαληθεύτηκαν οπτικά στο pilot (ADR-654 M1). */
const PILOT_FILES = ['001', '005', '015', '027', '054', '120', '160', '176'];

async function main() {
  const pilot = process.argv.includes('--pilot');
  console.log(`Entourage asset build — έπιπλα — ${pilot ? 'PILOT' : 'ΠΛΗΡΕΣ PACK'}`);

  await buildEntouragePack({
    // Το pack των επίπλων έχει δύο πηγές: αντικείμενα (root) + χαλιά (υποφάκελος).
    sources: [
      { group: 'obj', dir: SRC_ROOT },
      { group: 'rug', dir: path.join(SRC_ROOT, 'rugs') },
    ],
    outRoot: OUT_ROOT,
    idPrefix: 'furn',
    repoRoot: REPO_ROOT,
    filterStems: pilot ? PILOT_FILES : undefined,
  });
}

main().catch((err) => {
  console.error('❌ Απέτυχε το asset build:', err.message);
  process.exitCode = 1;
});
