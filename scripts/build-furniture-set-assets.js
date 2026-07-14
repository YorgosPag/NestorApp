/**
 * Furniture SET asset builder — thin CLI πάνω στη ΚΟΙΝΗ μηχανή entourage (ADR-654 M7 Γ2).
 *
 * Offline, εφάπαξ. Χτίζει τα ΝΕΑ έπιπλα/συνθέσεις από το `images_4` (580 TIF) ΜΕΣΑ στο
 * ΙΔΙΟ pack `furniture-plan-2d`, με νέο group `set` ⇒ ids `furn-set-<stem>-N` (μηδέν σύγκρουση
 * με τα υπάρχοντα `furn-obj-*`). Όλη η μηχανική (TIF → alpha-split → WebP + manifest) ζει στο
 * κοινό `scripts/lib/entourage-asset-builder.js` — μηδέν clone (N.18).
 *
 * Ειδικό μόνο ως προς: (α) πηγή `images_4`, (β) group `set`, (γ) `mergeManifest` (κρατά τα 379
 * `furn-obj-*` του υπάρχοντος manifest), (δ) `modeByStem` από το vision pass A ⇒ οι συνθέσεις
 * παίρνουν ΚΑΙ ολόκληρο sprite (`…-0`, kind⇒composition) ΚΑΙ σπασμένα μέρη (kind⇒individual).
 *
 * Χρήση:
 *   node scripts/build-furniture-set-assets.js --pilot 001,002,045   # μόνο δείγμα
 *   node scripts/build-furniture-set-assets.js                       # όλο το images_4
 *
 * @see scripts/lib/entourage-asset-builder.js — η μηχανή (modeByStem + mergeManifest)
 * @see scripts/entourage-classification/furniture-set.modes.json — το vision-A output
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

const fs = require('node:fs');
const path = require('node:path');
const { buildEntouragePack } = require('./lib/entourage-asset-builder');

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(REPO_ROOT, 'images_4');
const OUT_ROOT = path.join(REPO_ROOT, 'public', 'furniture-2d');
const MODES_PATH = path.join(REPO_ROOT, 'scripts', 'entourage-classification', 'furniture-set.modes.json');

/** Διαβάζει το vision-A mode map (stem → mode). Απόν αρχείο = όλα split-only (προ-vision). */
function loadModes() {
  if (!fs.existsSync(MODES_PATH)) {
    console.warn(`⚠ Δεν βρέθηκε ${path.relative(REPO_ROOT, MODES_PATH)} — όλα ως split-only (χωρίς συνθέσεις).`);
    return undefined;
  }
  return JSON.parse(fs.readFileSync(MODES_PATH, 'utf8'));
}

/** `--pilot 001,005,015` → ['001','005','015']· χωρίς λίστα = όλο το pack. */
function parsePilotStems(argv) {
  const i = argv.indexOf('--pilot');
  if (i === -1) return undefined;
  const list = argv[i + 1];
  if (!list || list.startsWith('--')) {
    console.error('❌ Το --pilot χρειάζεται λίστα stems, π.χ. --pilot 001,002,045');
    process.exit(1);
  }
  return list.split(',').map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const argv = process.argv.slice(2);
  const filterStems = parsePilotStems(argv);
  const modeByStem = loadModes();

  console.log(`Entourage asset build — έπιπλα SET (images_4) — ${filterStems ? `PILOT [${filterStems.join(', ')}]` : 'ΠΛΗΡΕΣ'}`);

  await buildEntouragePack({
    sources: [{ group: 'set', dir: SRC_ROOT }],
    outRoot: OUT_ROOT,
    idPrefix: 'furn',
    repoRoot: REPO_ROOT,
    filterStems,
    modeByStem,
    mergeManifest: true, // κρατά τα 379 furn-obj-* του υπάρχοντος manifest
  });
}

main().catch((err) => {
  console.error('❌ Απέτυχε το asset build:', err.message);
  process.exitCode = 1;
});
