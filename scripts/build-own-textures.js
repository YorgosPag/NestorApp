/**
 * Own-scan texture builder — ADR-643 own-scans.
 *
 * Ο SSoT της ΠΡΟΕΛΕΥΣΗΣ + της παραγωγής των ιδιόκτητων textures (images_6, own IP — ΟΧΙ
 * Poly Haven). Παίρνει τα raw σκαναρίσματα (2480×1754 JPG), κόβει κεντρικό τετράγωνο tile,
 * το κατεβάζει σε 1024² και γράφει `public/textures/<slug>/albedo.jpg` (albedo-only).
 *
 * Ντετερμινιστικό: ίδια είσοδος → ίδιο tile. Το `PICKS` κάτω είναι το ΜΟΝΟ σημείο που ορίζει
 * ποιο images_6 stem → ποιο slug (ίδιο mapping με το `sourceAsset` του `TEXTURE_SET_DEFS`).
 *
 * ⚠️ Τα `public/textures/*` είναι gitignored· ΟΜΩΣ τα δικά μας δεν κατεβαίνουν από provider
 * (βλ. isOwnScanTexture) — η αναπαραγωγή τους είναι είτε (α) το git-committed public tile
 * (`git add -f`), είτε (β) αυτό το script αν υπάρχει τοπικά το `images_6/`, είτε (γ) το
 * Firebase Storage copy (`upload-bim-textures.js`).
 *
 * Χρήση:
 *   node scripts/build-own-textures.js
 *
 * @see src/subapps/dxf-viewer/bim/materials/bim-texture-registry.ts — TEXTURE_SET_DEFS (license 'owner')
 * @see src/subapps/dxf-viewer/data/material-image-catalog.ts — τα matimg-* façade rows
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md — Changelog 2026-07-14 (own scans)
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(REPO_ROOT, 'images_6');
const OUT_ROOT = path.join(REPO_ROOT, 'public', 'textures');
const TILE_PX = 1024;
const JPEG_QUALITY = 86;

/** images_6 stem → slug. ΤΟ ΜΟΝΟ mapping· ταιριάζει με το `sourceAsset` του registry. */
const PICKS = [
  { stem: '015', slug: 'wicker' },
  { stem: '040', slug: 'carpet-grey' },
  { stem: '044', slug: 'carpet-charcoal' },
  { stem: '021', slug: 'rug-terracotta' },
  { stem: '022', slug: 'felt-green' },
  { stem: '017', slug: 'linen' },
  { stem: '070', slug: 'tweed' },
  { stem: '075', slug: 'fabric-teal' },
  { stem: '079', slug: 'water-pool' },
  { stem: '078', slug: 'water-shallow' },
  { stem: '041', slug: 'terrazzo' },
  { stem: '018', slug: 'plaid' },
];

/** Κεντρικό τετράγωνο crop (αποφεύγει άκρα/vignette) → 1024² albedo. */
async function buildTile(stem, slug) {
  const src = path.join(SRC_DIR, `${stem}.jpg`);
  const meta = await sharp(src).metadata();
  const side = Math.min(meta.width, meta.height);
  const left = Math.floor((meta.width - side) / 2);
  const top = Math.floor((meta.height - side) / 2);
  const outDir = path.join(OUT_ROOT, slug);
  fs.mkdirSync(outDir, { recursive: true });
  await sharp(src)
    .extract({ left, top, width: side, height: side })
    .resize(TILE_PX, TILE_PX)
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(path.join(outDir, 'albedo.jpg'));
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`❌ Δεν βρέθηκε το ${path.relative(REPO_ROOT, SRC_DIR)} (raw σκαναρίσματα).`);
    console.error('   Τα committed public tiles / Storage copies είναι η εναλλακτική αναπαραγωγή.');
    process.exit(1);
  }
  for (const { stem, slug } of PICKS) {
    await buildTile(stem, slug);
    console.log(`  ✅ ${slug.padEnd(18)} ← images_6/${stem}.jpg`);
  }
  console.log(`\n✅ ${PICKS.length} own-scan textures → ${path.relative(REPO_ROOT, OUT_ROOT)}/<slug>/albedo.jpg`);
}

main().catch((err) => {
  console.error('❌ Απέτυχε το build:', err.message);
  process.exitCode = 1;
});
