/**
 * Alpha connected-components — καθαρή γεωμετρική λογική (ADR-654 M1).
 *
 * Τα TIF του entourage pack ΔΕΝ είναι ένα έπιπλο το καθένα: ένα αρχείο (π.χ. 001.tif,
 * 1772x1216) περιέχει καναπέ + δύο πολυθρόνες, με διάφανο κενό ανάμεσά τους. Αν μπουν
 * στην κάτοψη ως ένα sprite, ο χρήστης τοποθετεί «τρία έπιπλα κολλημένα μαζί με αέρα».
 *
 * Εδώ σπάμε το alpha σε νησίδες (8-connectivity flood fill) και επιστρέφουμε το bbox
 * της καθεμιάς. ΚΑΜΙΑ εξάρτηση από sharp/IO — καθαρή συνάρτηση πάνω σε alpha buffer,
 * ώστε να ελέγχεται με jest χωρίς αρχεία.
 *
 * @see scripts/build-furniture-plan-assets.js — ο καταναλωτής (decode μέσω sharp)
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

/** Alpha κάτω από αυτό = διάφανο. Τα cut-outs έχουν καθαρό 0/255, άρα 16 είναι ασφαλές. */
const DEFAULT_ALPHA_THRESHOLD = 16;

/**
 * Νησίδες μικρότερες από αυτό το κλάσμα του καμβά = θόρυβος (σκιές, ψίχουλα του
 * cut-out) και απορρίπτονται. 0.08% επαληθεύτηκε στο pilot: κρατά τις πολυθρόνες,
 * πετά τα ψίχουλα.
 */
const DEFAULT_MIN_AREA_FRACTION = 0.0008;

/**
 * @typedef {object} ComponentBox
 * @property {number} x0 αριστερό pixel (inclusive)
 * @property {number} y0 πάνω pixel (inclusive)
 * @property {number} x1 δεξί pixel (inclusive)
 * @property {number} y1 κάτω pixel (inclusive)
 * @property {number} width πλάτος σε pixels
 * @property {number} height ύψος σε pixels
 * @property {number} area πλήθος αδιαφανών pixels (ΟΧΙ εμβαδόν bbox)
 */

/**
 * Βρίσκει τις αδιαφανείς νησίδες ενός alpha channel και επιστρέφει το bbox καθεμιάς.
 *
 * Σειρά εξόδου: πάνω→κάτω, μετά αριστερά→δεξιά (σταθερή/ντετερμινιστική — τα ids των
 * assets παράγονται από το index, άρα η σειρά ΔΕΝ επιτρέπεται να είναι τυχαία).
 *
 * @param {Uint8Array|Buffer} alpha alpha channel, μήκος width*height, row-major
 * @param {number} width
 * @param {number} height
 * @param {{alphaThreshold?: number, minAreaFraction?: number}} [options]
 * @returns {ComponentBox[]}
 */
function findAlphaComponents(alpha, width, height, options = {}) {
  const alphaThreshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  const minAreaFraction = options.minAreaFraction ?? DEFAULT_MIN_AREA_FRACTION;

  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`findAlphaComponents: μη έγκυρες διαστάσεις ${width}x${height}`);
  }
  if (alpha.length < width * height) {
    throw new Error(
      `findAlphaComponents: alpha buffer ${alpha.length} < ${width * height} (w*h)`,
    );
  }

  const total = width * height;
  const visited = new Uint8Array(total);
  const stack = new Int32Array(total);
  const boxes = [];

  for (let seed = 0; seed < total; seed++) {
    if (visited[seed] === 1 || alpha[seed] < alphaThreshold) continue;

    let sp = 0;
    stack[sp++] = seed;
    visited[seed] = 1;

    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;
    let area = 0;

    while (sp > 0) {
      const p = stack[--sp];
      const x = p % width;
      const y = (p - x) / width;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const q = ny * width + nx;
          if (visited[q] === 1 || alpha[q] < alphaThreshold) continue;
          visited[q] = 1;
          stack[sp++] = q;
        }
      }
    }

    boxes.push({ x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1, area });
  }

  const minArea = total * minAreaFraction;
  return boxes
    .filter((b) => b.area >= minArea)
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}

module.exports = {
  findAlphaComponents,
  DEFAULT_ALPHA_THRESHOLD,
  DEFAULT_MIN_AREA_FRACTION,
};
