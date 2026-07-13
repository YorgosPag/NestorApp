/**
 * Entourage asset builder — TIF pack → WebP sprites + manifest (ADR-654 M1).
 *
 * Offline, εφάπαξ. Παίρνει τα raw TIF (RGBA cut-outs, top-view έπιπλα), σπάει κάθε
 * αρχείο στις νησίδες του (ένα TIF = πολλά έπιπλα — βλ. alpha-connected-components.js),
 * κόβει στο bbox καθεμιάς και γράφει WebP με alpha + thumbnail.
 *
 * Το `aspect` (wPx/hPx) του manifest είναι ΤΟ ΜΟΝΟ γεωμετρικό στοιχείο που περνά στο
 * runtime catalog: το πραγματικό πλάτος σε mm ΔΕΝ συνάγεται από τα pixels (το pack δεν
 * έχει ενιαία κλίμακα — τα μονά αρχεία γυρίστηκαν αλλιώς από τα σετ), οπότε το ορίζει
 * η κατηγορία. Το ύψος βγαίνει από το aspect ⇒ μηδέν παραμόρφωση.
 *
 * Χρήση:
 *   node scripts/build-furniture-plan-assets.js --pilot   # μόνο το επαληθευμένο δείγμα
 *   node scripts/build-furniture-plan-assets.js           # όλο το pack
 *
 * @see scripts/lib/alpha-connected-components.js — ο splitter (pure, unit-tested)
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const { findAlphaComponents } = require('./lib/alpha-connected-components');

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(REPO_ROOT, 'images');
const OUT_ROOT = path.join(REPO_ROOT, 'public', 'furniture-2d');
const MANIFEST_PATH = path.join(OUT_ROOT, 'manifest.json');

/** Μέγιστη πλευρά του full-size sprite. Πάνω από αυτό δεν κερδίζει τίποτα στην κάτοψη. */
const MAX_FULL_PX = 1024;
/** Πλευρά του thumbnail της παλέτας. */
const MAX_THUMB_PX = 256;
const WEBP_QUALITY = 88;
const WEBP_THUMB_QUALITY = 80;

/** Τα 8 αρχεία που επαληθεύτηκαν οπτικά στο pilot (ADR-654 M1). */
const PILOT_FILES = ['001', '005', '015', '027', '054', '120', '160', '176'];

/** @returns {{group: string, dir: string}[]} οι πηγές: root pack + χαλιά. */
function sourceGroups() {
  return [
    { group: 'obj', dir: SRC_ROOT },
    { group: 'rug', dir: path.join(SRC_ROOT, 'rugs') },
  ];
}

function listTifs(dir, pilot) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.tif'))
    .filter((f) => !pilot || PILOT_FILES.includes(path.basename(f, path.extname(f))))
    .sort();
}

/** Σταθερό, ντετερμινιστικό id: η σειρά των components ΔΕΝ είναι τυχαία. */
function spriteId(group, stem, index) {
  return `furn-${group}-${stem}-${index + 1}`;
}

async function processFile(group, dir, file, manifest) {
  const stem = path.basename(file, path.extname(file));
  const abs = path.join(dir, file);
  const image = sharp(abs);
  const meta = await image.metadata();

  if (!meta.hasAlpha) {
    console.warn(`  ⚠ ${file}: χωρίς alpha — παραλείπεται (δεν είναι cut-out)`);
    return 0;
  }

  const alpha = await image.clone().extractChannel(3).raw().toBuffer();
  const boxes = findAlphaComponents(alpha, meta.width, meta.height);

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    const id = spriteId(group, stem, i);
    const region = { left: box.x0, top: box.y0, width: box.width, height: box.height };

    await sharp(abs)
      .extract(region)
      .resize({ width: MAX_FULL_PX, height: MAX_FULL_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, alphaQuality: 100 })
      .toFile(path.join(OUT_ROOT, `${id}.webp`));

    await sharp(abs)
      .extract(region)
      .resize({ width: MAX_THUMB_PX, height: MAX_THUMB_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_THUMB_QUALITY, alphaQuality: 100 })
      .toFile(path.join(OUT_ROOT, `${id}.thumb.webp`));

    manifest.push({
      id,
      group,
      srcFile: path.relative(REPO_ROOT, abs).replace(/\\/g, '/'),
      index: i + 1,
      widthPx: box.width,
      heightPx: box.height,
      aspect: Number((box.width / box.height).toFixed(4)),
    });
  }

  console.log(`  ${file} → ${boxes.length} sprite(s)`);
  return boxes.length;
}

async function main() {
  const pilot = process.argv.includes('--pilot');
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  console.log(`Entourage asset build — ${pilot ? 'PILOT' : 'ΠΛΗΡΕΣ PACK'}`);
  const manifest = [];
  let files = 0;

  for (const { group, dir } of sourceGroups()) {
    const tifs = listTifs(dir, pilot);
    if (tifs.length === 0) continue;
    console.log(`\n[${group}] ${tifs.length} αρχεία — ${path.relative(REPO_ROOT, dir)}`);
    for (const file of tifs) {
      await processFile(group, dir, file, manifest);
      files++;
    }
  }

  manifest.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(
    `\n✅ ${files} αρχεία → ${manifest.length} sprites → ${path.relative(REPO_ROOT, OUT_ROOT)}`,
  );
  console.log(`   manifest: ${path.relative(REPO_ROOT, MANIFEST_PATH)}`);
}

main().catch((err) => {
  console.error('❌ Απέτυχε το asset build:', err.message);
  process.exitCode = 1;
});
