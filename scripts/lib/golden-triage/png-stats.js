'use strict';

/**
 * 🔑 Ο ΕΝΑΣ ΑΝΑΓΝΩΣΤΗΣ PNG — ADR-775 §15
 *
 * Και το φύλλο διαλογής (`golden-triage.js`, που δείχνει την εικόνα στον άνθρωπο) και η πύλη
 * εγκυρότητας (`check-golden-validity.js`, που την κρίνει) ρωτούν **αυτό** το αρχείο.
 *
 * ⚠️ Γιατί ΕΝΑΣ: αν το φύλλο μετρούσε «μελάνι» με δικό του κριτήριο και η πύλη με άλλο, θα
 * μπορούσε ο άνθρωπος να εγκρίνει εικόνα που η πύλη ονομάζει κενή — δηλαδή **δύο αλήθειες για
 * το ίδιο ερώτημα**, το σχήμα του ADR-749. Η έγκριση και η κρίση πρέπει να βλέπουν τα ΙΔΙΑ
 * pixels με τον ΙΔΙΟ ορισμό.
 *
 * Καμία νέα εξάρτηση: `pngjs` υπάρχει ήδη (N.5).
 */

const fs = require('node:fs');
const { PNG } = require('pngjs');

/** Πόσα διακριτά χρώματα μετράμε πριν σταματήσουμε — πάνω από αυτό η απάντηση δεν αλλάζει. */
const DISTINCT_COLOR_CAP = 4096;

/** Κατώφλι φωτεινότητας (0..1) πάνω από το οποίο ένα pixel λέγεται «φωτεινό». */
const LIGHT_LUMINANCE = 0.5;

/** sRGB → σχετική φωτεινότητα κατά WCAG, χωρίς gamma (αρκεί για ταξινόμηση φόντου). */
function quickLuminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function packRgb(r, g, b) {
  return (r << 16) | (g << 8) | b;
}

function unpackRgb(key) {
  return { r: (key >> 16) & 0xff, g: (key >> 8) & 0xff, b: key & 0xff };
}

/**
 * Πρώτο πέρασμα: ιστόγραμμα χρωμάτων + πλήθος φωτεινών pixels.
 * Το αλφα αγνοείται σκόπιμα — τα screenshot του Playwright είναι αδιαφανή, και ένα ημιδιαφανές
 * pixel που «φαίνεται» μαύρο **είναι** μαύρο για τον άνθρωπο που κρίνει.
 */
function histogram(data, pixels) {
  const counts = new Map();
  let light = 0;
  let luminanceSum = 0;
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const lum = quickLuminance(r, g, b);
    luminanceSum += lum;
    if (lum > LIGHT_LUMINANCE) light += 1;
    if (counts.size < DISTINCT_COLOR_CAP || counts.has(packRgb(r, g, b))) {
      const key = packRgb(r, g, b);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return { counts, light, luminanceMean: luminanceSum / pixels };
}

function dominantColor(counts) {
  let bestKey = 0;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }
  return { key: bestKey, count: bestCount };
}

/**
 * Δεύτερο πέρασμα: «μελάνι» = κάθε pixel που **δεν** είναι το κυρίαρχο χρώμα.
 *
 * ⚠️ Ορισμός με πρόθεση: όχι «όχι μαύρο». Ένα golden με λευκό φόντο και μαύρο κείμενο έχει
 * μελάνι όσο και ένα με μαύρο φόντο και λευκές γραμμές — το ερώτημα είναι «υπάρχει **σήμα**;»,
 * όχι «είναι σκούρο;».
 */
function inkBounds(data, width, height, dominantKey) {
  let count = 0;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      if (packRgb(data[o], data[o + 1], data[o + 2]) === dominantKey) continue;
      count += 1;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return count === 0
    ? { count: 0, bbox: null }
    : { count, bbox: { x0, y0, x1, y1 } };
}

/**
 * Η ΜΙΑ ανάλυση. Επιστρέφει **μετρήσεις**, ποτέ ετυμηγορία — την ετυμηγορία τη δίνει ο
 * καταναλωτής (πύλη ή φύλλο), ώστε το κριτήριο να ζει σε ένα σημείο ανά ερώτημα.
 */
function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function analyzePng(file) {
  const png = readPng(file);
  const pixels = png.width * png.height;
  const { counts, light, luminanceMean } = histogram(png.data, pixels);
  const dominant = dominantColor(counts);
  const ink = inkBounds(png.data, png.width, png.height, dominant.key);
  return {
    file,
    width: png.width,
    height: png.height,
    pixels,
    bytes: fs.statSync(file).size,
    distinctColors: counts.size,
    distinctColorsCapped: counts.size >= DISTINCT_COLOR_CAP,
    dominant: { ...unpackRgb(dominant.key), share: dominant.count / pixels },
    ink: { count: ink.count, ratio: ink.count / pixels, bbox: ink.bbox },
    lightRatio: light / pixels,
    luminanceMean,
  };
}

module.exports = {
  analyzePng,
  readPng,
  quickLuminance,
  DISTINCT_COLOR_CAP,
  LIGHT_LUMINANCE,
};
