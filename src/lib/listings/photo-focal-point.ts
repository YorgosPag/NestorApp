/**
 * @fileoverview **«ΠΟΥ ΕΙΝΑΙ ΤΟ ΘΕΜΑ ΑΥΤΗΣ ΤΗΣ ΦΩΤΟΓΡΑΦΙΑΣ;»** — η μία απάντηση (ADR-880).
 * @related ADR-880 · ADR-777 §8.80.7 · ADR-841 §7 · components/search-results/listing-photo-position-class
 * @module lib/listings/photo-focal-point
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ `focalPoint` ΚΑΙ ΟΧΙ `focus`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το «focus» είναι **ήδη πιασμένο** σε αυτόν τον φάκελο: το `listing-focus.ts` σημαίνει *«ποια
 * αγγελία είναι επιλεγμένη»*. Δύο έννοιες με ένα όνομα είναι η πρώτη συνομιλία όπου κάποιος
 * «ενοποιεί» δύο πράγματα που δεν έχουν σχέση. Εδώ μιλάμε για **σημείο μέσα στην εικόνα**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΚΕΝΤΡΑΡΙΣΜΑ, ΟΧΙ ΑΠΛΩΣ ΟΡΑΤΟΤΗΤΑ — εκεί ξεπερνάμε το WordPress
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `FocalPointPicker` του WordPress γράφει `object-position: x% y%` με το σημείο **αυτούσιο**.
 * Αυτό εγγυάται ότι το θέμα είναι **ορατό** (το σημείο x% της εικόνας κάθεται στο x% του
 * πλαισίου) — αλλά θέμα στο 80% κάθεται στο 80% της κάρτας, **κολλημένο στην άκρη**.
 * Εδώ ο {@link coverObjectPosition} λύνει για τη θέση που το φέρνει στο **κέντρο**, και
 * σφηνώνει όταν η εικόνα τελειώνει. Χρειάζεται τις διαστάσεις της εικόνας — που το
 * `ListingImage` κουβαλά **ήδη** για το CLS.
 *
 * ⚠️ **Καθαρό module**: καμία εξάρτηση από `sharp`, React ή Firestore. Ο **κινητήρας** που
 * βρίσκει το σημείο στα bytes ζει στο `services/listings/public-shelf-focal-point.ts`.
 */

import { z } from 'zod';

// ============================================================================
// 1. ΤΟ ΣΗΜΕΙΟ
// ============================================================================

/**
 * Σημείο μέσα στην εικόνα, **κανονικοποιημένο**: `x` από αριστερά, `y` από πάνω, και τα δύο ∈ [0,1].
 *
 * 🔑 Κανονικοποιημένο και όχι σε pixel: τα παράγωγα του ραφιού είναι **ίδια εικόνα σε άλλο
 * μέγεθος** (`fit: 'inside'`, καμία περικοπή) ⇒ **ένα** σημείο ισχύει για όλα. Ίδια σύμβαση με το
 * `hotspot` της Sanity και το `FocalPointPicker` του WordPress.
 */
export interface PhotoFocalPoint {
  readonly x: number;
  readonly y: number;
}

/** Το κέντρο — η σημερινή συμπεριφορά κάθε `object-cover` χωρίς δήλωση. */
export const CENTER_FOCAL_POINT: PhotoFocalPoint = { x: 0.5, y: 0.5 };

const unit = z.number().finite().min(0).max(1);

/** Το σχήμα της **πόρτας** (PATCH, φόρμα κατόχου) — αυστηρό: σκουπίδι απορρίπτεται. */
export const photoFocalPointSchema = z.object({ x: unit, y: unit }).strict();

/**
 * **Η μία ανάγνωση αποθηκευμένου σημείου** — ποτέ δεν πετά.
 *
 * ⚠️ Ό,τι δεν είναι έγκυρο σημείο ⇒ `null` *(«κανείς δεν δήλωσε»)*, **όχι** κέντρο: το κέντρο
 * είναι **απάντηση**, το `null` είναι **απουσία απάντησης**, και ο {@link resolvePhotoFocalPoint}
 * χρειάζεται τη διάκριση για να αφήσει το αυτόματο να μιλήσει.
 */
export function readPhotoFocalPoint(value: unknown): PhotoFocalPoint | null {
  const parsed = photoFocalPointSchema.safeParse(value);
  return parsed.success ? { x: parsed.data.x, y: parsed.data.y } : null;
}

/**
 * **Δηλωμένα σημεία ανά ταυτότητα αρχείου** (`FileRecord.id` → σημείο) — ωμό πεδίο εγγράφου.
 *
 * ⚠️ Ίδια πειθαρχία με το `declaredFileIds`: η πόρτα είναι `.passthrough()`, άρα το **ιστορικό**
 * ενός εγγράφου δεν είναι εγγυημένο. Άκυρη γραμμή πέφτει **μόνη της** — δεν ακυρώνει τις άλλες.
 */
export function readDeclaredFocalPoints(value: unknown): ReadonlyMap<string, PhotoFocalPoint> {
  const declared = new Map<string, PhotoFocalPoint>();
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return declared;

  for (const [id, raw] of Object.entries(value)) {
    const point = readPhotoFocalPoint(raw);
    if (id.trim() !== '' && point !== null) declared.set(id, point);
  }
  return declared;
}

/**
 * **Ο ΑΝΘΡΩΠΟΣ ΥΠΕΡΙΣΧΥΕΙ** — ο ένας τόπος της απόφασης (πρότυπο Cloudinary: οι
 * ανθρώπινες συντεταγμένες **παρακάμπτουν** το `g_auto`).
 *
 * ⛔ Κανένα «μέσος όρος» ή «βάρος προς»: ο άνθρωπος που διόρθωσε το είπε **επειδή** το
 * αυτόματο έκανε λάθος. Μίξη θα τιμωρούσε ακριβώς αυτόν που μπήκε στον κόπο.
 */
export function resolvePhotoFocalPoint(
  declared: PhotoFocalPoint | null,
  detected: PhotoFocalPoint | null,
): PhotoFocalPoint | null {
  return declared ?? detected;
}

/** Ίδιο σημείο; — για ισότητα δηλώσεων (αισιόδοξη ενημέρωση), όχι για απόδοση. */
export function sameFocalPoint(a: PhotoFocalPoint | null, b: PhotoFocalPoint | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y;
}

/** Ίδιες δηλώσεις σημείων; — ίδιο σύνολο αρχείων, ίδιο σημείο το καθένα (η σειρά αδιάφορη). */
export function sameDeclaredFocalPoints(
  a: ReadonlyMap<string, PhotoFocalPoint>,
  b: ReadonlyMap<string, PhotoFocalPoint>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [id, point] of a) {
    if (!sameFocalPoint(point, b.get(id) ?? null)) return false;
  }
  return true;
}

/**
 * **Ένα σημείο αλλαγμένο μέσα στη δήλωση** — νέος χάρτης, ποτέ μετάλλαξη. `null` ⇒ η γραμμή **φεύγει**
 * («άφησε το αυτόματο»), ώστε το έγγραφο να μην κρατά γραμμές που δεν λένε τίποτα.
 */
export function withDeclaredFocalPoint(
  declared: ReadonlyMap<string, PhotoFocalPoint>,
  id: string,
  point: PhotoFocalPoint | null,
): ReadonlyMap<string, PhotoFocalPoint> {
  const next = new Map(declared);
  if (point === null) next.delete(id);
  else next.set(id, point);
  return next;
}

// ============================================================================
// 2. Η ΘΕΣΗ ΣΤΟ ΠΛΑΙΣΙΟ — `object-fit: cover`
// ============================================================================

/** Λόγος πλαισίου, ίδιο σχήμα με το `LISTING_CARD_ASPECT`. */
export interface FrameAspect {
  readonly w: number;
  readonly h: number;
}

/** `object-position` σε ποσοστά [0,100] — ό,τι καταλαβαίνει το CSS. */
export interface ObjectPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * **Η θέση που φέρνει το σημείο στο ΚΕΝΤΡΟ του πλαισίου**, σφηνωμένη στα όρια της εικόνας.
 *
 * Σε `cover` υπερχειλίζει **ένας** άξονας. Αν η εικόνα, κλιμακωμένη, έχει μήκος `S` σε αυτόν
 * τον άξονα και το πλαίσιο `B`, το CSS μετατοπίζει κατά `p·(S−B)`. Θέλουμε το σημείο `f·S`
 * στο `B/2` ⇒ **`p = (f·S − B/2) / (S − B)`**, σφηνωμένο στο [0,1]. Ο άλλος άξονας δεν
 * υπερχειλίζει ⇒ 50% (οποιαδήποτε τιμή θα ήταν ίδια· το 50 είναι η ουδέτερη).
 */
export function coverObjectPosition(
  image: { readonly width: number; readonly height: number },
  frame: FrameAspect,
  point: PhotoFocalPoint,
): ObjectPosition {
  const imageAspect = image.width / image.height;
  const frameAspect = frame.w / frame.h;
  if (!Number.isFinite(imageAspect) || imageAspect <= 0 || imageAspect === frameAspect) {
    return { x: 50, y: 50 };
  }

  // Ύψος πλαισίου = 1 όταν υπερχειλίζει το πλάτος· πλάτος πλαισίου = 1 όταν υπερχειλίζει το ύψος.
  return imageAspect > frameAspect
    ? { x: centred(point.x, imageAspect, frameAspect), y: 50 }
    : { x: 50, y: centred(point.y, 1 / imageAspect, 1 / frameAspect) };
}

/** Ορθογώνιο μέσα στην εικόνα, κανονικοποιημένο [0,1] — ό,τι μένει **ορατό** στο πλαίσιο. */
export interface VisibleRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * **Ποιο κομμάτι της εικόνας κρατά το πλαίσιο** για δεδομένη θέση `object-position` — η αντίστροφη ερώτηση
 * του {@link coverObjectPosition}. Ο επεξεργαστής τη ζωγραφίζει πάνω στο πρωτότυπο, με τη θέση **μετά την
 * κβάντιση**, ώστε ο άνθρωπος να βλέπει ό,τι θα δει ο επισκέπτης — όχι ό,τι «θα έπρεπε».
 */
export function coverVisibleRect(
  image: { readonly width: number; readonly height: number },
  frame: FrameAspect,
  position: ObjectPosition,
): VisibleRect {
  const imageAspect = image.width / image.height;
  const frameAspect = frame.w / frame.h;
  if (!Number.isFinite(imageAspect) || imageAspect <= 0) return { x: 0, y: 0, w: 1, h: 1 };

  if (imageAspect > frameAspect) {
    const w = frameAspect / imageAspect;
    return { x: (position.x / 100) * (1 - w), y: 0, w, h: 1 };
  }
  const h = imageAspect / frameAspect;
  return { x: 0, y: (position.y / 100) * (1 - h), w: 1, h };
}

/** `clamp((f·S − B/2)/(S − B), 0, 1)` σε ποσοστό. `S > B` εγγυημένο από τον καλούντα. */
function centred(fraction: number, scaled: number, box: number): number {
  const p = (fraction * scaled - box / 2) / (scaled - box);
  return Math.min(1, Math.max(0, p)) * 100;
}
