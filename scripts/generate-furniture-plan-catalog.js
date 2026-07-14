/**
 * Furniture-plan catalog generator — manifest + vision classification → data file (ADR-654 M5).
 *
 * Offline, εφάπαξ (ξανατρέχει όποτε αλλάξει η ταξινόμηση). Διαβάζει:
 *   • public/furniture-2d/manifest.json  — id + aspect (γεωμετρία, από τον asset builder)
 *   • <classification.json>              — id → category + style (vision AI + human review)
 * και γράφει το ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ data file:
 *   • src/subapps/dxf-viewer/data/furniture-plan-catalog.data.ts
 *
 * ⚠️ Το data file είναι AUTO-GENERATED — ΜΗΝ το επεξεργάζεσαι με το χέρι. Άλλαξε την ταξινόμηση
 * και ξανατρέξε αυτό το script. Η κλίμακα ΔΕΝ βγαίνει από pixels· ορίζεται από την κατηγορία
 * (βλ. FURNITURE_PLAN_LONG_SIDE_MM στο furniture-plan-catalog.ts).
 *
 * series = ντετερμινιστικός αύξων αριθμός μέσα σε κάθε ζεύγος (category, style), κατά σειρά id —
 * σταθερός για εμφάνιση («Πολυθρόνα · Δερμάτινη · 03»), όχι ταυτότητα (ταυτότητα = το id).
 *
 * Χρήση:
 *   node scripts/generate-furniture-plan-catalog.js <path/to/classification.json>
 *
 * @see scripts/build-furniture-plan-assets.js — παράγει το manifest (προηγείται)
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'public', 'furniture-2d', 'manifest.json');
const OUT_PATH = path.join(
  REPO_ROOT,
  'src',
  'subapps',
  'dxf-viewer',
  'data',
  'furniture-plan-catalog.data.ts',
);

/** Το controlled λεξιλόγιο — ΠΡΕΠΕΙ να ταιριάζει με τους τύπους στο furniture-plan-catalog.ts. */
const CATEGORIES = new Set([
  'sofa3', 'sofa2', 'sofaCorner', 'armchair', 'recliner', 'chair', 'officeChair',
  'stool', 'bench', 'pouf', 'bedDouble', 'bedSingle', 'washbasin', 'coffeeTable', 'rug',
]);
const STYLES = new Set([
  'solid', 'floral', 'leather', 'striped', 'retro', 'modern', 'plaid', 'checkered', 'classic', 'velvet',
]);

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const classPath = process.argv[2];
  if (!classPath) {
    console.error('❌ Λείπει το path του classification.json');
    process.exitCode = 1;
    return;
  }

  const manifest = loadJson(MANIFEST_PATH);
  const classification = loadJson(path.resolve(classPath));

  const aspectById = new Map(manifest.map((m) => [m.id, m.aspect]));
  const classById = new Map(classification.map((c) => [c.id, c]));

  // Έλεγχος πληρότητας + εγκυρότητας πριν γράψουμε οτιδήποτε (fail-fast).
  const errors = [];
  for (const m of manifest) {
    const c = classById.get(m.id);
    if (!c) { errors.push(`${m.id}: χωρίς ταξινόμηση`); continue; }
    if (!CATEGORIES.has(c.category)) errors.push(`${m.id}: άγνωστη κατηγορία "${c.category}"`);
    if (!STYLES.has(c.style)) errors.push(`${m.id}: άγνωστο στυλ "${c.style}"`);
  }
  if (errors.length) {
    console.error('❌ Σφάλματα ταξινόμησης:\n  ' + errors.join('\n  '));
    process.exitCode = 1;
    return;
  }

  // Ντετερμινιστική σειρά: κατά id.
  const rows = manifest.map((m) => m.id).sort().map((id) => {
    const c = classById.get(id);
    return { id, category: c.category, style: c.style, aspect: aspectById.get(id) };
  });

  // series ανά (category, style), κατά σειρά id.
  const counters = new Map();
  for (const r of rows) {
    const key = `${r.category}/${r.style}`;
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    r.series = next;
  }

  const body = rows
    .map((r) => `  { id: '${r.id}', category: '${r.category}', style: '${r.style}', series: ${r.series}, aspect: ${r.aspect} },`)
    .join('\n');

  const out = `/* eslint-disable */
/**
 * AUTO-GENERATED — ΜΗΝ ΕΠΕΞΕΡΓΑΖΕΣΑΙ ΜΕ ΤΟ ΧΕΡΙ.
 * Παράγεται από: scripts/generate-furniture-plan-catalog.js (manifest + vision classification).
 * ${rows.length} sprites. Ξανατρέξε το script αν αλλάξει η ταξινόμηση.
 */
import type { FurniturePlanDef } from './furniture-plan-catalog';

export const FURNITURE_PLAN_CATALOG_DATA: readonly FurniturePlanDef[] = [
${body}
];
`;

  fs.writeFileSync(OUT_PATH, out, 'utf8');
  console.log(`✅ ${rows.length} entries → ${path.relative(REPO_ROOT, OUT_PATH)}`);
}

main();
