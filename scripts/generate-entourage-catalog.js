/**
 * Entourage catalog generator — manifest + vision classification → data file (ADR-654 M6).
 *
 * Offline, εφάπαξ (ξανατρέχει όποτε αλλάξει η ταξινόμηση). ΓΕΝΙΚΟΣ: ένα script, πολλά packs
 * (N.18: καμία αντιγραφή ανά οικογένεια — αλλάζει μόνο το config). Διαβάζει:
 *   • public/<pack>-2d/manifest.json — id + aspect (γεωμετρία, από τον asset builder)
 *   • scripts/entourage-classification/<pack>.classification.json — id → category (+ secondary)
 * και γράφει το ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ data file (AUTO-GENERATED — ΜΗΝ το επεξεργάζεσαι με το χέρι).
 *
 * Η κλίμακα ΔΕΝ βγαίνει από pixels· ορίζεται από την κατηγορία (βλ. <PACK>_LONG_SIDE_MM στο
 * αντίστοιχο *-plan-catalog.ts). series = ντετερμινιστικός αύξων αριθμός μέσα σε κάθε ζεύγος facets.
 *
 * Χρήση:
 *   node scripts/generate-entourage-catalog.js people
 *   node scripts/generate-entourage-catalog.js vehicles
 *
 * @see scripts/build-entourage-assets.js — παράγει το manifest (προηγείται)
 * @see src/subapps/dxf-viewer/data/entourage-catalog-core.ts — ο runtime engine
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

/** Το controlled config κάθε pack — ΠΡΕΠΕΙ να ταιριάζει με τους τύπους στο *-plan-catalog.ts. */
const PACKS = {
  people: {
    manifest: 'public/people-2d/manifest.json',
    classification: 'scripts/entourage-classification/people-plan.classification.json',
    out: 'src/subapps/dxf-viewer/data/people-plan-catalog.data.ts',
    typeImport: 'PeoplePlanDef',
    typeModule: './people-plan-catalog',
    constName: 'PEOPLE_PLAN_CATALOG_DATA',
    categories: ['person', 'lying', 'group', 'stroller', 'wheelchair', 'child'],
    secondaryField: null, // οι άνθρωποι έχουν μόνο category (top-view πόζα αναξιόπιστη)
    secondaryValues: null,
  },
  vehicles: {
    manifest: 'public/vehicles-2d/manifest.json',
    classification: 'scripts/entourage-classification/vehicles-plan.classification.json',
    out: 'src/subapps/dxf-viewer/data/vehicles-plan-catalog.data.ts',
    typeImport: 'VehiclePlanDef',
    typeModule: './vehicles-plan-catalog',
    constName: 'VEHICLE_PLAN_CATALOG_DATA',
    categories: ['car', 'motorcycle', 'scooter', 'pickup', 'van', 'truck', 'boat', 'construction', 'tractor', 'airplane'],
    secondaryField: 'color',
    secondaryValues: ['red', 'white', 'black', 'silver', 'grey', 'blue', 'green', 'yellow', 'orange', 'brown', 'other'],
  },
};

const loadJson = (p) => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, p), 'utf8'));
const sqlLit = (v) => (v === null ? 'null' : `'${v}'`);

function main() {
  const packName = process.argv[2];
  const cfg = PACKS[packName];
  if (!cfg) {
    console.error(`❌ Άγνωστο pack: '${packName ?? '(κενό)'}'. Διαθέσιμα: ${Object.keys(PACKS).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const manifest = loadJson(cfg.manifest);
  const classification = loadJson(cfg.classification);

  const aspectById = new Map(manifest.map((m) => [m.id, m.aspect]));
  const classById = new Map(classification.map((c) => [c.id, c]));
  const categories = new Set(cfg.categories);
  const secondaries = cfg.secondaryValues ? new Set(cfg.secondaryValues) : null;

  // Έλεγχος πληρότητας + εγκυρότητας πριν γράψουμε οτιδήποτε (fail-fast).
  const errors = [];
  for (const m of manifest) {
    const c = classById.get(m.id);
    if (!c) { errors.push(`${m.id}: χωρίς ταξινόμηση`); continue; }
    if (!categories.has(c.category)) errors.push(`${m.id}: άγνωστη κατηγορία "${c.category}"`);
    if (secondaries) {
      const sec = c[cfg.secondaryField];
      if (!secondaries.has(sec)) errors.push(`${m.id}: άγνωστο ${cfg.secondaryField} "${sec}"`);
    }
  }
  if (errors.length) {
    console.error(`❌ Σφάλματα ταξινόμησης (${packName}):\n  ${errors.join('\n  ')}`);
    process.exitCode = 1;
    return;
  }

  // Ντετερμινιστική σειρά: κατά id.
  const rows = manifest
    .map((m) => m.id)
    .sort()
    .map((id) => {
      const c = classById.get(id);
      const secondary = cfg.secondaryField ? c[cfg.secondaryField] : null;
      return { id, category: c.category, secondary, aspect: aspectById.get(id) };
    });

  // series ανά ζεύγος facets (category [+ secondary]), κατά σειρά id.
  const counters = new Map();
  for (const r of rows) {
    const key = `${r.category}/${r.secondary ?? ''}`;
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    r.series = next;
  }

  const body = rows
    .map(
      (r) =>
        `  { id: '${r.id}', category: '${r.category}', secondary: ${sqlLit(r.secondary)}, series: ${r.series}, aspect: ${r.aspect} },`,
    )
    .join('\n');

  const out = `/* eslint-disable */
/**
 * AUTO-GENERATED — ΜΗΝ ΕΠΕΞΕΡΓΑΖΕΣΑΙ ΜΕ ΤΟ ΧΕΡΙ.
 * Παράγεται από: scripts/generate-entourage-catalog.js ${packName} (manifest + vision classification).
 * ${rows.length} sprites. Ξανατρέξε το script αν αλλάξει η ταξινόμηση.
 */
import type { ${cfg.typeImport} } from '${cfg.typeModule}';

export const ${cfg.constName}: readonly ${cfg.typeImport}[] = [
${body}
];
`;

  fs.writeFileSync(path.join(REPO_ROOT, cfg.out), out, 'utf8');
  console.log(`✅ ${rows.length} entries → ${cfg.out}`);
}

main();
