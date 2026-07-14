/**
 * Entourage asset builder ENGINE — TIF pack → WebP sprites + manifest (ADR-654).
 *
 * Ο ΚΟΙΝΟΣ πυρήνας κάθε οικογένειας entourage (έπιπλα, άνθρωποι, οχήματα): παίρνει raw TIF
 * (RGBA cut-outs, top-view), σπάει κάθε αρχείο στις νησίδες του (alpha connected-components —
 * ένα TIF μπορεί να έχει πολλές φιγούρες), κόβει στο bbox καθεμιάς και γράφει WebP με alpha +
 * thumbnail. Παραμετρικός ⇒ ΜΙΑ μηχανή, πολλά packs (N.18: κανένα sibling clone ανά οικογένεια).
 *
 * Το `aspect` (wPx/hPx) του manifest είναι ΤΟ ΜΟΝΟ γεωμετρικό στοιχείο που περνά στο runtime
 * catalog: το πραγματικό μέγεθος σε mm ΔΕΝ συνάγεται από pixels (το pack δεν έχει ενιαία
 * κλίμακα) — το ορίζει η κατηγορία. Το ύψος βγαίνει από το aspect ⇒ μηδέν παραμόρφωση.
 *
 * @see scripts/lib/alpha-connected-components.js — ο splitter (pure, unit-tested)
 * @see scripts/build-entourage-assets.js — γενικό CLI (άνθρωποι/οχήματα)
 * @see scripts/build-furniture-plan-assets.js — thin CLI των επίπλων (2 sources)
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const { findAlphaComponents } = require('./alpha-connected-components');

/** Μέγιστη πλευρά του full-size sprite. Πάνω από αυτό δεν κερδίζει τίποτα στην κάτοψη. */
const MAX_FULL_PX = 1024;
/** Πλευρά του thumbnail της παλέτας. */
const MAX_THUMB_PX = 256;
const WEBP_QUALITY = 88;
const WEBP_THUMB_QUALITY = 80;

/** Σταθερό, ντετερμινιστικό id: η σειρά των components ΔΕΝ είναι τυχαία (βλ. splitter). */
function spriteId(prefix, group, stem, index) {
  return `${prefix}-${group}-${stem}-${index + 1}`;
}

function listTifs(dir, filterStems) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.tif'))
    .filter((f) => !filterStems || filterStems.includes(path.basename(f, path.extname(f))))
    .sort();
}

async function processFile({ prefix, group, dir, file, outRoot, repoRoot, manifest, logger }) {
  const stem = path.basename(file, path.extname(file));
  const abs = path.join(dir, file);
  const image = sharp(abs);
  const meta = await image.metadata();

  if (!meta.hasAlpha) {
    logger.warn(`  ⚠ ${file}: χωρίς alpha — παραλείπεται (δεν είναι cut-out)`);
    return 0;
  }

  const alpha = await image.clone().extractChannel(3).raw().toBuffer();
  const boxes = findAlphaComponents(alpha, meta.width, meta.height);

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    const id = spriteId(prefix, group, stem, i);
    const region = { left: box.x0, top: box.y0, width: box.width, height: box.height };

    await sharp(abs)
      .extract(region)
      .resize({ width: MAX_FULL_PX, height: MAX_FULL_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, alphaQuality: 100 })
      .toFile(path.join(outRoot, `${id}.webp`));

    await sharp(abs)
      .extract(region)
      .resize({ width: MAX_THUMB_PX, height: MAX_THUMB_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_THUMB_QUALITY, alphaQuality: 100 })
      .toFile(path.join(outRoot, `${id}.thumb.webp`));

    manifest.push({
      id,
      group,
      srcFile: path.relative(repoRoot, abs).replace(/\\/g, '/'),
      index: i + 1,
      widthPx: box.width,
      heightPx: box.height,
      aspect: Number((box.width / box.height).toFixed(4)),
    });
  }

  logger.log(`  ${file} → ${boxes.length} sprite(s)`);
  return boxes.length;
}

/**
 * Χτίζει ένα ΟΛΟΚΛΗΡΟ pack. Ντετερμινιστικό (ίδια είσοδος → ίδια ids/manifest).
 *
 * @param {object} config
 * @param {{group: string, dir: string}[]} config.sources  μία ή περισσότερες πηγές TIF
 * @param {string} config.outRoot   φάκελος εξόδου (webp + manifest.json)
 * @param {string} config.idPrefix  prefix των ids ('furn' | 'ppl' | 'veh' | …)
 * @param {string} config.repoRoot  για relative `srcFile` στο manifest
 * @param {string[]} [config.filterStems]  αν δοθεί, μόνο αυτά τα stems (pilot mode)
 * @param {Console} [config.logger]
 * @returns {Promise<{files: number, manifest: object[]}>}
 */
async function buildEntouragePack({
  sources,
  outRoot,
  idPrefix,
  repoRoot,
  filterStems,
  logger = console,
}) {
  fs.mkdirSync(outRoot, { recursive: true });

  const manifest = [];
  let files = 0;

  for (const { group, dir } of sources) {
    const tifs = listTifs(dir, filterStems);
    if (tifs.length === 0) continue;
    logger.log(`\n[${group}] ${tifs.length} αρχεία — ${path.relative(repoRoot, dir)}`);
    for (const file of tifs) {
      await processFile({ prefix: idPrefix, group, dir, file, outRoot, repoRoot, manifest, logger });
      files++;
    }
  }

  manifest.sort((a, b) => a.id.localeCompare(b.id));
  const manifestPath = path.join(outRoot, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  logger.log(
    `\n✅ ${files} αρχεία → ${manifest.length} sprites → ${path.relative(repoRoot, outRoot)}`,
  );
  logger.log(`   manifest: ${path.relative(repoRoot, manifestPath)}`);

  return { files, manifest };
}

module.exports = { buildEntouragePack, spriteId, MAX_FULL_PX, MAX_THUMB_PX };
