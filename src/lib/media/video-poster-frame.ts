/**
 * @fileoverview 🖼️ **ΕΝΑ ΚΑΡΕ ΑΠΟ ΕΝΑ ΒΙΝΤΕΟ, ΣΤΟΝ BROWSER ΤΟΥ ΕΚΔΟΤΗ** — το εξώφυλλο πριν ανεβεί το αρχείο.
 * @related ADR-907 §10.8 · lib/files/file-companion-objects (`videoPoster`) · services/filesystem/upload-entity-file
 * @module lib/media/video-poster-frame
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Καρέ από H.264 στον διακομιστή σημαίνει αποκωδικοποιητή — δηλαδή ffmpeg (LGPL/GPL, απαγορευμένο, N.5) ή WASM πολλών MB
 * σε κάθε δημοσίευση. Ο browser του ανθρώπου που ανεβάζει **έχει ήδη** τον αποκωδικοποιητή και το αρχείο στα χέρια του:
 * ένα `<video>` πάνω σε object URL, ένα `seek`, ένα `drawImage`. Κανένα byte δεν φεύγει για να γίνει.
 *
 * 🔑 **ΠΟΙΟ ΚΑΡΕ — το μέσο, όχι το πρώτο.** Το πρώτο καρέ είναι συχνά μαύρο ή μισοανοιγμένη πόρτα. Η Mux παίρνει εξ
 * ορισμού το **μέσο** της διάρκειας και το Cloudflare Stream το ορίζει ως **ποσοστό** της (ώστε να ισχύει για κάθε
 * μήκος)· το ίδιο κάνουμε. Αν το μέσο βγει **σκοτεινό**, δοκιμάζονται το ένα τέταρτο και τα τρία τέταρτα· αν όλα είναι
 * σκοτεινά, το βίντεο **είναι** σκοτεινό και κρατιέται το μέσο — ποτέ κανένα εξώφυλλο επειδή ο κριτής ήταν αυστηρός.
 *
 * ⚠️ **Δεν πετά ποτέ**: `null` σημαίνει «αυτός ο browser δεν μπόρεσε» (HEVC χωρίς υλικό, κομμένο αρχείο). Το ανέβασμα
 * συνεχίζει και η αγγελία δείχνει ουδέτερο πλαίσιο — το εξώφυλλο είναι βελτίωση, όχι προϋπόθεση.
 */

/** Η μορφή του καρέ. Το δημόσιο ράφι το ξανακωδικοποιεί σε παράγωγα — εδώ κρατιέται η **πηγή** τους. */
export const VIDEO_POSTER_MIME = 'image/webp';

/**
 * Η μεγαλύτερη ακμή του καρέ. Ίση με το **μεγαλύτερο παράγωγο** του ραφιού αγγελιών (`LISTING_SHELF`): πάνω από αυτό το
 * ράφι θα το μίκραινε ούτως ή άλλως. Η ισότητα φυλάσσεται από άγκυρα, ώστε τα δύο νούμερα να μη χωρίσουν σιωπηλά.
 */
export const VIDEO_POSTER_MAX_EDGE = 2560;

/** Υψηλή ποιότητα: το καρέ είναι **πρωτότυπο** για το ράφι, και δεύτερη απωλεστική κωδικοποίηση ακολουθεί. */
const POSTER_QUALITY = 0.92;

/** Πόσο περιμένουμε τον αποκωδικοποιητή πριν πούμε «δεν μπόρεσε». Τοπικό αρχείο — δεν είναι δίκτυο. */
const DECODE_TIMEOUT_MS = 10_000;

/** Τα σημεία της διάρκειας, με τη σειρά που δοκιμάζονται. */
const POSTER_FRAME_FRACTIONS = [0.5, 0.25, 0.75] as const;

/** Μέση φωτεινότητα (0–255) κάτω από την οποία ένα καρέ θεωρείται «μαύρο» — σβησμένη οθόνη, καπάκι φακού, fade. */
const DARK_FRAME_MEAN_LUMA = 24;

/** Η πλευρά του δείγματος φωτεινότητας: 16×16 pixel αρκούν για μέσο όρο, και κοστίζουν ένα `drawImage`. */
const LUMA_SAMPLE_EDGE = 16;

/** Ένα υποψήφιο καρέ: τα bytes του, και αν ο κριτής το βρήκε σκοτεινό. */
export interface PosterFrameCandidate {
  readonly blob: Blob;
  readonly dark: boolean;
}

/**
 * **Οι στιγμές που δοκιμάζονται**, σε δευτερόλεπτα. Διάρκεια που δεν διαβάζεται (ροή, `Infinity`, `NaN`) ⇒ η αρχή:
 * χωρίς διάρκεια δεν υπάρχει «μέσο», και ένα καρέ από την αρχή είναι καλύτερο από κανένα.
 */
export function posterFrameTimes(durationSec: number): readonly number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [0];
  return POSTER_FRAME_FRACTIONS.map((fraction) => durationSec * fraction);
}

/** **Είναι σκοτεινό;** — μέση φωτεινότητα (Rec. 601) πάνω σε pixel RGBA. Κενό δείγμα ⇒ ναι: δεν υπάρχει εικόνα να δείξει. */
export function isDarkFrame(rgba: Uint8ClampedArray): boolean {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return true;

  let sum = 0;
  for (let offset = 0; offset < pixels * 4; offset += 4) {
    sum += 0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2];
  }
  return sum / pixels < DARK_FRAME_MEAN_LUMA;
}

/** Οι διαστάσεις του καρέ: του βίντεο, μικρυμένες ώστε η μεγάλη ακμή να μην ξεπερνά το ταβάνι. Ποτέ μεγέθυνση. */
export function posterFrameSize(width: number, height: number): { readonly width: number; readonly height: number } {
  const scale = Math.min(1, VIDEO_POSTER_MAX_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * **Η επιλογή**, χωρισμένη από το DOM ώστε να δοκιμάζεται: το πρώτο **φωτεινό** καρέ με τη σειρά των στιγμών· αν κανένα,
 * το πρώτο που **πιάστηκε**. Στιγμή που δεν έδωσε καρέ (`null`) προσπερνιέται — δεν ακυρώνει τις επόμενες.
 */
export async function pickPosterFrame(
  times: readonly number[],
  grab: (timeSec: number) => Promise<PosterFrameCandidate | null>,
): Promise<Blob | null> {
  let fallback: Blob | null = null;

  for (const time of times) {
    const candidate = await grab(time);
    if (candidate === null) continue;
    if (!candidate.dark) return candidate.blob;
    fallback = fallback ?? candidate.blob;
  }
  return fallback;
}

/** Περιμένει **ένα** γεγονός του στοιχείου· `false` σε σφάλμα ή αν ο αποκωδικοποιητής δεν απαντήσει εγκαίρως. */
function settled(video: HTMLVideoElement, eventName: 'loadedmetadata' | 'seeked'): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      window.clearTimeout(timer);
      video.removeEventListener(eventName, onDone);
      video.removeEventListener('error', onError);
      resolve(ok);
    };
    const onDone = () => finish(true);
    const onError = () => finish(false);
    const timer = window.setTimeout(() => finish(false), DECODE_TIMEOUT_MS);

    video.addEventListener(eventName, onDone, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

/** Ζωγραφίζει το **τρέχον** καρέ σε καμβά των δοσμένων διαστάσεων· `null` αν ο browser δεν δίνει 2D πλαίσιο. */
function paintFrame(video: HTMLVideoElement, width: number, height: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) return null;

  context.drawImage(video, 0, 0, width, height);
  return canvas;
}

/** Το καρέ στη στιγμή `timeSec`: bytes σε πλήρες μέγεθος + η κρίση φωτεινότητας από μικρό δείγμα. */
async function grabFrame(video: HTMLVideoElement, timeSec: number): Promise<PosterFrameCandidate | null> {
  const seeking = settled(video, 'seeked');
  video.currentTime = timeSec;
  if (!(await seeking)) return null;

  const size = posterFrameSize(video.videoWidth, video.videoHeight);
  const frame = paintFrame(video, size.width, size.height);
  const sample = paintFrame(video, LUMA_SAMPLE_EDGE, LUMA_SAMPLE_EDGE);
  if (frame === null || sample === null) return null;

  const blob = await new Promise<Blob | null>((resolve) => frame.toBlob(resolve, VIDEO_POSTER_MIME, POSTER_QUALITY));
  if (blob === null) return null;

  const pixels = sample.getContext('2d')?.getImageData(0, 0, LUMA_SAMPLE_EDGE, LUMA_SAMPLE_EDGE).data;
  return { blob, dark: pixels === undefined ? false : isDarkFrame(pixels) };
}

/**
 * **Το εξώφυλλο ενός αρχείου βίντεο** — `null` όταν αυτός ο browser δεν μπορεί να το αποκωδικοποιήσει.
 *
 * ⚠️ `muted` + `playsInline` + **καμία** κλήση `play()`: το στοιχείο δεν μπαίνει ποτέ στο έγγραφο και δεν παίζει — μόνο
 * μετακινείται. Το object URL ανακαλείται **πάντα**, αλλιώς ένα αρχείο 100 MB μένει δεσμευμένο ως το κλείσιμο της καρτέλας.
 */
export async function captureVideoPosterFrame(file: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    const loading = settled(video, 'loadedmetadata');
    video.src = url;
    if (!(await loading) || video.videoWidth === 0 || video.videoHeight === 0) return null;

    return await pickPosterFrame(posterFrameTimes(video.duration), (time) => grabFrame(video, time));
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
