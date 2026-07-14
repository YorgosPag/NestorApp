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

const { findAlphaComponents, unionBox } = require('./alpha-connected-components');

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

/** Κόβει ένα bbox σε full + thumb WebP και καταχωρεί την εγγραφή manifest. Ένα σημείο εγγραφής. */
async function emitSprite({ abs, box, id, group, index, outRoot, repoRoot, manifest }) {
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
    index,
    widthPx: box.width,
    heightPx: box.height,
    aspect: Number((box.width / box.height).toFixed(4)),
  });
}

async function processFile({ prefix, group, dir, file, outRoot, repoRoot, manifest, modeByStem, logger }) {
  const stem = path.basename(file, path.extname(file));
  const abs = path.join(dir, file);

  // Μερικά TIF έχουν εξωτικά channels (layered/spot, >4 samples/pixel) που το libvips ΔΕΝ
  // αποκωδικοποιεί. Τα προσπερνάμε αντί να κρασάρει όλο το build (belt-and-suspenders).
  let image;
  let meta;
  try {
    image = sharp(abs);
    meta = await image.metadata();
  } catch (err) {
    logger.warn(`  ⚠ ${file}: μη αναγνώσιμο (${err.message}) — παραλείπεται`);
    return 0;
  }

  if (!meta.hasAlpha) {
    logger.warn(`  ⚠ ${file}: χωρίς alpha — παραλείπεται (δεν είναι cut-out)`);
    return 0;
  }

  const alpha = await image.clone().extractChannel(3).raw().toBuffer();
  const boxes = findAlphaComponents(alpha, meta.width, meta.height);
  if (boxes.length === 0) {
    logger.warn(`  ⚠ ${file}: καμία νησίδα πάνω από το κατώφλι — παραλείπεται`);
    return 0;
  }

  // Σύνθεση: εκπέμπει ΚΑΙ το ολόκληρο σετ (id `…-0`, kind⇒composition) ΚΑΙ, αν υπάρχουν
  // πολλές νησίδες, τα μεμονωμένα μέρη του (`…-1..N`, kind⇒individual). Μία νησίδα = το σετ
  // δεν έχει εσωτερικό alpha κενό ⇒ μόνο το ολόκληρο (το μέρος ταυτίζεται· κανένα διπλότυπο).
  if (modeByStem?.[stem] === 'composition') {
    // spriteId(…, -1) → `…-0` = το ολόκληρο. Τα μέρη κρατούν index 1..N.
    await emitSprite({ abs, box: unionBox(boxes), id: spriteId(prefix, group, stem, -1), group, index: 0, outRoot, repoRoot, manifest });
    if (boxes.length >= 2) {
      for (let i = 0; i < boxes.length; i++) {
        await emitSprite({ abs, box: boxes[i], id: spriteId(prefix, group, stem, i), group, index: i + 1, outRoot, repoRoot, manifest });
      }
    }
    const emitted = boxes.length >= 2 ? boxes.length + 1 : 1;
    logger.log(`  ${file} → σύνθεση: ${emitted} sprite(s) (1 ολόκληρο${boxes.length >= 2 ? ` + ${boxes.length} μέρη` : ''})`);
    return emitted;
  }

  // variant-sheet / single / (χωρίς mode): μόνο τα components.
  for (let i = 0; i < boxes.length; i++) {
    await emitSprite({ abs, box: boxes[i], id: spriteId(prefix, group, stem, i), group, index: i + 1, outRoot, repoRoot, manifest });
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
 * @param {Record<string,'composition'|'variant-sheet'|'single'>} [config.modeByStem]
 *        ανά stem· `composition` ⇒ εκπομπή ολόκληρου σετ (`…-0`) + μερών. Αλλιώς μόνο μέρη.
 * @param {boolean} [config.mergeManifest]  αν true, συγχωνεύει με το υπάρχον manifest του
 *        outRoot (join by id) αντί να το αντικαταστήσει — για incremental προσθήκη ids.
 * @param {Console} [config.logger]
 * @returns {Promise<{files: number, manifest: object[]}>}
 */
async function buildEntouragePack({
  sources,
  outRoot,
  idPrefix,
  repoRoot,
  filterStems,
  modeByStem,
  mergeManifest = false,
  logger = console,
}) {
  fs.mkdirSync(outRoot, { recursive: true });

  const fresh = [];
  let files = 0;

  for (const { group, dir } of sources) {
    const tifs = listTifs(dir, filterStems);
    if (tifs.length === 0) continue;
    logger.log(`\n[${group}] ${tifs.length} αρχεία — ${path.relative(repoRoot, dir)}`);
    for (const file of tifs) {
      await processFile({ prefix: idPrefix, group, dir, file, outRoot, repoRoot, manifest: fresh, modeByStem, logger });
      files++;
    }
  }

  const manifestPath = path.join(outRoot, 'manifest.json');
  let manifest = fresh;
  if (mergeManifest && fs.existsSync(manifestPath)) {
    const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const freshIds = new Set(fresh.map((m) => m.id));
    const kept = existing.filter((m) => !freshIds.has(m.id));
    manifest = kept.concat(fresh);
    logger.log(`\n   merge: ${kept.length} υπάρχοντα + ${fresh.length} νέα/ανανεωμένα`);
  }

  manifest.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  logger.log(
    `\n✅ ${files} αρχεία → ${fresh.length} νέα sprites → ${path.relative(repoRoot, outRoot)} (manifest: ${manifest.length})`,
  );
  logger.log(`   manifest: ${path.relative(repoRoot, manifestPath)}`);

  return { files, manifest };
}

module.exports = { buildEntouragePack, spriteId, MAX_FULL_PX, MAX_THUMB_PX };
