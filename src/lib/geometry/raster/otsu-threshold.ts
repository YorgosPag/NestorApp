/**
 * =============================================================================
 * ΑΠΟΧΡΩΣΕΙΣ ΤΟΥ ΓΚΡΙ + ΚΑΤΩΦΛΙ OTSU (SSoT)
 * =============================================================================
 *
 * Το Otsu (1979) διαλέγει το κατώφλι που **μεγιστοποιεί τη διακύμανση ανάμεσα στις δύο κλάσεις** του ιστογράμματος
 * — εδώ «μελάνι» (τοίχοι, γραμμές) και «χαρτί». Δεν χρειάζεται ρύθμιση ανά κάτοψη: σκούρο γκρι τοίχος σε κρεμ φόντο
 * και μαύρος σε λευκό δίνουν σωστό διαχωρισμό χωρίς σταθερό «128».
 *
 * @module lib/geometry/raster/otsu-threshold
 */

/**
 * RGBA (όπως το `ImageData.data`) ⇒ φωτεινότητα 0–255 ανά pixel, **συντεθειμένη πάνω σε λευκό**: ένα διάφανο PNG
 * έχει `rgb = 0` στα διάφανα σημεία, που χωρίς σύνθεση θα διαβάζονταν ως μαύρος τοίχος. Βάρη Rec. 601 (luma).
 */
export function rgbaToGray(rgba: Uint8ClampedArray | Uint8Array, pixelCount: number): Uint8Array {
  const gray = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const alpha = rgba[o + 3] / 255;
    const luma = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
    gray[i] = Math.round(luma * alpha + 255 * (1 - alpha));
  }
  return gray;
}

/** Ιστόγραμμα 256 θέσεων. */
export function grayHistogram(gray: Uint8Array): Uint32Array {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) histogram[gray[i]]++;
  return histogram;
}

/**
 * Κατώφλι Otsu: η τιμή `t` όπου η κλάση «σκούρο» είναι `≤ t`. Μονόχρωμη εικόνα (μία μόνο κλάση) ⇒ `-1`, ώστε ο
 * καλών να μην ονομάσει «τοίχο» ολόκληρο το χαρτί.
 */
export function otsuThreshold(histogram: ArrayLike<number>): number {
  let total = 0;
  let sumAll = 0;
  for (let v = 0; v < 256; v++) { total += histogram[v]; sumAll += v * histogram[v]; }
  let weightDark = 0;
  let sumDark = 0;
  let best = -1;
  let bestVariance = 0;
  for (let t = 0; t < 256; t++) {
    weightDark += histogram[t];
    if (weightDark === 0) continue;
    const weightLight = total - weightDark;
    if (weightLight === 0) break;
    sumDark += t * histogram[t];
    const meanDark = sumDark / weightDark;
    const meanLight = (sumAll - sumDark) / weightLight;
    const variance = weightDark * weightLight * (meanDark - meanLight) ** 2;
    if (variance > bestVariance) { bestVariance = variance; best = t; }
  }
  return best;
}
