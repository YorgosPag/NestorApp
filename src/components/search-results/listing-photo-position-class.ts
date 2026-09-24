/**
 * **Πού κόβεται η φωτογραφία μέσα στο πλαίσιο της κάρτας** — σημείο εστίασης → στατική κλάση (ADR-880).
 *
 * @related ADR-880 · ADR-777 §8.80.7 · listing-card-frame · lib/listings/photo-focal-point
 * @module components/search-results/listing-photo-position-class
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ `style={{ objectPosition }}`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το inline style απαγορεύεται (N.3), και το Tailwind **διαβάζει** τα αρχεία, δεν τα **εκτελεί**: μια
 * κλάση συναρμολογημένη σε χρόνο εκτέλεσης (`object-[${x}%_${y}%]`) **δεν παράγεται ποτέ**. Άρα κάθε
 * θέση που μπορεί να ζητηθεί υπάρχει εδώ ως **literal** — ίδιο ιδίωμα με το `LISTING_CARD_ASPECT_CLASS`.
 *
 * 🏆 **ΕΝΑΣ ΑΞΟΝΑΣ, ΒΗΜΑ 5% — ΟΧΙ ΠΛΕΓΜΑ 5×5.** Σε `object-fit: cover` υπερχειλίζει **μόνο ένας** άξονας
 * (ο άλλος γεμίζει ακριβώς), άρα χρειάζονται μόνο οι γραμμές `50%_P%` και `P%_50%`: **41** κλάσεις με
 * σφάλμα ≤2,5% της υπερχείλισης. Ένα πλέγμα 5×5 θα είχε 25 κλάσεις και βήμα 25% — για κάθετη φωτογραφία
 * κινητού σε κάρτα 3:2 αυτό είναι μετατόπιση ~31% του ύψους της κάρτας ανά βήμα.
 *
 * ⚠️ **Η θέση ΔΕΝ είναι το σημείο.** Το σημείο λέει *πού είναι το θέμα στην εικόνα*· η θέση λέει *πώς
 * μετατοπίζεται η εικόνα ώστε το θέμα να κάτσει στο ΚΕΝΤΡΟ του πλαισίου* — δες `coverObjectPosition`.
 */
import type { ListingImage } from '@/types/public-listing';
import { LISTING_CARD_ASPECT, LISTING_CARD_ASPECT_CLASS } from './listing-card-frame';
import {
  coverObjectPosition,
  readPhotoFocalPoint,
  type FrameAspect,
  type ObjectPosition,
  type PhotoFocalPoint,
} from '@/lib/listings/photo-focal-point';

/**
 * **Τα πλαίσια όπου κόβεται φωτογραφία αγγελίας** — ό,τι ο επεξεργαστής οφείλει να προεπισκοπήσει.
 *
 * 🔑 Σήμερα **ένα** (μετρημένο 2026-09-24: κάρτα αποτελεσμάτων · βιτρίνας · αποθηκευμένων · κατόχου · φούσκα
 * χάρτη — όλα `LISTING_CARD_ASPECT_CLASS`· η γκαλερί της σελίδας αγγελίας δεν κόβει). Νέο πλαίσιο που κόβει ⇒
 * **γραμμή εδώ**, και ο επεξεργαστής το δείχνει χωρίς άλλη αλλαγή.
 */
export const LISTING_PHOTO_FRAMES = [
  { id: 'card', aspect: LISTING_CARD_ASPECT, aspectClass: LISTING_CARD_ASPECT_CLASS },
] as const;

export type ListingPhotoFrame = (typeof LISTING_PHOTO_FRAMES)[number];

/** Το βήμα κβάντισης σε ποσοστιαίες μονάδες. Ο πίνακας από κάτω είναι **ακριβώς** τα πολλαπλάσιά του. */
export const PHOTO_POSITION_STEP = 5;

/**
 * **Κάθε θέση που μπορεί να ζητηθεί**, ως literal. Κλειδί `"x_y"` σε ακέραια ποσοστά.
 * ⛔ Μην προσθέσεις γραμμή με το χέρι χωρίς να αλλάξεις το {@link PHOTO_POSITION_STEP} — η άγκυρα
 * `listing-photo-position-class.test.ts` απαιτεί **ακριβώς** τις 41 του βήματος.
 */
export const PHOTO_POSITION_CLASSES: Readonly<Record<string, string>> = {
  // Υπερχείλιση ΥΨΟΥΣ (κάθετη φωτογραφία σε οριζόντιο πλαίσιο): x = 50, y κινείται.
  '50_0': 'object-[50%_0%]',
  '50_5': 'object-[50%_5%]',
  '50_10': 'object-[50%_10%]',
  '50_15': 'object-[50%_15%]',
  '50_20': 'object-[50%_20%]',
  '50_25': 'object-[50%_25%]',
  '50_30': 'object-[50%_30%]',
  '50_35': 'object-[50%_35%]',
  '50_40': 'object-[50%_40%]',
  '50_45': 'object-[50%_45%]',
  '50_50': 'object-[50%_50%]',
  '50_55': 'object-[50%_55%]',
  '50_60': 'object-[50%_60%]',
  '50_65': 'object-[50%_65%]',
  '50_70': 'object-[50%_70%]',
  '50_75': 'object-[50%_75%]',
  '50_80': 'object-[50%_80%]',
  '50_85': 'object-[50%_85%]',
  '50_90': 'object-[50%_90%]',
  '50_95': 'object-[50%_95%]',
  '50_100': 'object-[50%_100%]',
  // Υπερχείλιση ΠΛΑΤΟΥΣ (πανοραμική σε στενότερο πλαίσιο): y = 50, x κινείται.
  '0_50': 'object-[0%_50%]',
  '5_50': 'object-[5%_50%]',
  '10_50': 'object-[10%_50%]',
  '15_50': 'object-[15%_50%]',
  '20_50': 'object-[20%_50%]',
  '25_50': 'object-[25%_50%]',
  '30_50': 'object-[30%_50%]',
  '35_50': 'object-[35%_50%]',
  '40_50': 'object-[40%_50%]',
  '45_50': 'object-[45%_50%]',
  '55_50': 'object-[55%_50%]',
  '60_50': 'object-[60%_50%]',
  '65_50': 'object-[65%_50%]',
  '70_50': 'object-[70%_50%]',
  '75_50': 'object-[75%_50%]',
  '80_50': 'object-[80%_50%]',
  '85_50': 'object-[85%_50%]',
  '90_50': 'object-[90%_50%]',
  '95_50': 'object-[95%_50%]',
  '100_50': 'object-[100%_50%]',
};

function quantised(percent: number): number {
  return Math.round(percent / PHOTO_POSITION_STEP) * PHOTO_POSITION_STEP;
}

/**
 * **Η θέση που ΠΡΑΓΜΑΤΙΚΑ θα αποδοθεί** — μετά την κβάντιση. Ο επεξεργαστής ζωγραφίζει το ορατό ορθογώνιο
 * από **αυτή**, όχι από την ακριβή, ώστε η προεπισκόπηση να μην υπόσχεται κάτι που ο πίνακας δεν έχει.
 */
export function renderedPhotoPosition(
  image: { readonly width: number; readonly height: number },
  frame: FrameAspect,
  point: PhotoFocalPoint | null,
): ObjectPosition {
  if (point === null) return { x: 50, y: 50 };
  const position = coverObjectPosition(image, frame, point);
  return { x: quantised(position.x), y: quantised(position.y) };
}

/**
 * **Η κλάση θέσης για ΣΗΜΕΙΟ σε εικόνα γνωστών διαστάσεων** — η καθαρή πυρηνική πράξη, κοινή για την
 * κάρτα και για την προεπισκόπηση του επεξεργαστή (WYSIWYG εκ κατασκευής: **ίδια** συνάρτηση).
 */
export function photoPositionClass(
  image: { readonly width: number; readonly height: number },
  frame: FrameAspect,
  point: PhotoFocalPoint | null,
): string {
  if (point === null) return '';
  const { x, y } = renderedPhotoPosition(image, frame, point);
  return PHOTO_POSITION_CLASSES[`${x}_${y}`] ?? '';
}

/**
 * **Η κλάση θέσης μιας φωτογραφίας αγγελίας σε πλαίσιο** — `''` ⇒ κέντρο (η συμπεριφορά πριν το ADR-880).
 *
 * 🔑 **Η ΜΙΑ ανάγνωση του `ListingImage.focalPoint`**: περνά από το `readPhotoFocalPoint`, άρα έγγραφο
 * γραμμένο πριν το ADR-880 (απόν) ή σκουπίδι δίνουν κέντρο — ποτέ εξαίρεση στην απόδοση (μάθημα Α2.10).
 */
export function listingPhotoPositionClass(
  image: Pick<ListingImage, 'width' | 'height' | 'focalPoint'>,
  frame: FrameAspect,
): string {
  return photoPositionClass(image, frame, readPhotoFocalPoint(image.focalPoint));
}
