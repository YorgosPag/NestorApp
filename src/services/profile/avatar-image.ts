'use client';

/**
 * =============================================================================
 * 🖼️ ΦΩΤΟΓΡΑΦΙΑ ΠΡΟΦΙΛ — Ο ΚΑΘΑΡΟΣ ΠΥΡΗΝΑΣ (ADR-798 §16)
 * =============================================================================
 *
 * Μαθηματικά περικοπής + αποκωδικοποίηση + **επανακωδικοποίηση**. Καμία γνώση
 * React, καμία γνώση Firebase — γι' αυτό δοκιμάζεται χωρίς browser και χωρίς
 * δίκτυο.
 *
 * ## 🏆 ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ
 *
 * Οι μεγάλοι (Figma: slider ζουμ + «Save image»· Slack· GitHub) ανεβάζουν το
 * **αρχείο του χρήστη** και το επεξεργάζονται στον διακομιστή. Εδώ **δεν
 * ανεβαίνει ΠΟΤΕ το αρχείο του χρήστη**: ανεβαίνει ένα καρέ **που παρήγαγε ο
 * ίδιος ο encoder του browser** από pixels που ζωγραφίσαμε εμείς. Η διαφορά δεν
 * είναι στιλιστική — είναι **δομική**, και ακυρώνει τέσσερις ολόκληρες
 * κατηγορίες προβλημάτων *by construction*, όχι με πολιτική που κάποιος πρέπει
 * να θυμάται:
 *
 * | κίνδυνος | γιατί είναι **αδύνατος** εδώ |
 * |---|---|
 * | **Διαρροή GPS/EXIF** | το canvas ξαναζωγραφίζει **μόνο pixels**· κάθε τμήμα μεταδεδομένων χάνεται. Δεν «αφαιρούμε» EXIF — **δεν το μεταφέρουμε ποτέ**. Μια γεωσημασμένη φωτογραφία κινητού εντοπίζει το **σπίτι** του ανθρώπου. |
 * | **Polyglot / ενσωματωμένο ωφέλιμο φορτίο** | τα bytes που ανεβαίνουν τα παράγει ο `toBlob` — δεν υπάρχει byte του χρήστη μέσα τους. Ο έλεγχος «magic bytes» των οδηγών ασφαλείας είναι **ασθενέστερος**: κρίνει τα bytes του χρήστη και μετά τα ανεβάζει. |
 * | **Βόμβα αποσυμπίεσης** | η έξοδος είναι **σταθερή** {@link AVATAR_OUTPUT_SIZE}×{@link AVATAR_OUTPUT_SIZE}, ό,τι κι αν ήταν η είσοδος. |
 * | **Απρόβλεπτο μέγεθος/μορφή** | πάντα ένα τετράγωνο WebP, γνωστής τάξης μεγέθους. |
 *
 * ⚠️ **ΜΗΝ «βελτιστοποιήσεις» ανεβάζοντας το αρχικό αρχείο όταν είναι ήδη μικρό.**
 * Θα ήταν λογικό ως προς το εύρος ζώνης και θα **επανέφερε και τις τέσσερις**
 * γραμμές του πίνακα — και μάλιστα **σιωπηλά**, μόνο για μικρές φωτογραφίες.
 *
 * ⚠️ Το {@link sniffImageFormat} υπάρχει **ΠΑΡΟΛΑ ΑΥΤΑ**: δίνει *έγκαιρο και
 * κατανοητό* μήνυμα πριν ο άνθρωπος περιμένει αποκωδικοποίηση, και δεν
 * εμπιστεύεται ούτε το `file.name` ούτε το `file.type` — και τα δύο τα ορίζει ο
 * χρήστης. Δεν είναι όμως ο φρουρός ασφαλείας· ο φρουρός είναι η επανακωδικοποίηση.
 *
 * @module services/profile/avatar-image
 */

/** Η πλευρά του τετραγώνου εξόδου. 512 = καθαρό σε 2× οθόνες για avatar 96-128px. */
export const AVATAR_OUTPUT_SIZE = 512;

/** Ποιότητα WebP. 0,9 = οπτικά χωρίς απώλειες σε αυτό το μέγεθος, ~40-70 KB. */
export const AVATAR_OUTPUT_QUALITY = 0.9;

/** Πάνω όριο **εισόδου**. Η έξοδος είναι πάντα μικρή· αυτό φυλά τη μνήμη αποκωδικοποίησης. */
export const AVATAR_MAX_INPUT_BYTES = 12 * 1024 * 1024;

/** Το μέγιστο ζουμ του slider. Πάνω από 4× το 512άρι γίνεται ορατά θολό. */
export const AVATAR_MAX_ZOOM = 4;

export type AvatarSourceFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'avif';

export type AvatarImageErrorCode = 'format' | 'size' | 'decode' | 'encode';

export class AvatarImageError extends Error {
  readonly code: AvatarImageErrorCode;
  constructor(code: AvatarImageErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'AvatarImageError';
  }
}

const startsWith = (bytes: Uint8Array, sig: readonly number[], at = 0): boolean =>
  sig.every((b, i) => bytes[at + i] === b);

/**
 * Η **πραγματική** μορφή, από τα πρώτα bytes — ποτέ από όνομα ή δηλωμένο MIME.
 *
 * ⚠️ Το `file.name` και το `file.type` τα ελέγχει ο χρήστης. Ο υπάρχων
 * `imageAssetExtFromName` κρίνει **όνομα** — σωστό για τους δικούς μας
 * παραγόμενους καταναλωτές, ανεπαρκές για αρχείο που διάλεξε άνθρωπος.
 */
export function sniffImageFormat(bytes: Uint8Array): AvatarSourceFormat | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  // RIFF????WEBP — το μέγεθος στα bytes 4-7 δεν μας αφορά.
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }
  // ISO-BMFF: ....ftyp + brand. Καλύπτει avif/avis.
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4) && startsWith(bytes, [0x61, 0x76, 0x69], 8)) {
    return 'avif';
  }
  return null;
}

/** Οι διαστάσεις μιας πηγής — ό,τι χρειάζονται τα μαθηματικά, τίποτα άλλο. */
export interface SourceSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Η κλίμακα στην οποία η εικόνα **μόλις που καλύπτει** το τετράγωνο θέασης
 * (σύμβαση `object-fit: cover`). Είναι το ζουμ `1` του slider.
 */
export function computeCoverScale(source: SourceSize, viewport: number): number {
  if (source.width <= 0 || source.height <= 0) return 1;
  return Math.max(viewport / source.width, viewport / source.height);
}

/**
 * Περιορίζει τη μετατόπιση ώστε να **μη φανεί ποτέ κενό**.
 *
 * ⚠️ Αυτό είναι το σημείο που ξεχωρίζει έναν σοβαρό cropper από έναν πρόχειρο:
 * χωρίς περιορισμό, ο άνθρωπος σέρνει την εικόνα εκτός πλαισίου και αποθηκεύει
 * avatar με **διάφανη/μαύρη λωρίδα** — και το μαθαίνει αφού το δουν οι άλλοι.
 */
export function clampOffset(
  offset: { readonly x: number; readonly y: number },
  source: SourceSize,
  scale: number,
  viewport: number,
): { x: number; y: number } {
  const maxX = Math.max(0, (source.width * scale - viewport) / 2);
  const maxY = Math.max(0, (source.height * scale - viewport) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

export interface CropRequest {
  readonly source: SourceSize;
  /** Η πλευρά του τετραγώνου θέασης, σε **pixel οθόνης**. */
  readonly viewport: number;
  /** 1 = cover. Βλ. {@link AVATAR_MAX_ZOOM}. */
  readonly zoom: number;
  /** Μετατόπιση σε **pixel οθόνης**, όπως τη σέρνει ο άνθρωπος. */
  readonly offset: { readonly x: number; readonly y: number };
}

/** Το τετράγωνο της **πηγής** που αντιστοιχεί στο τετράγωνο θέασης. */
export interface SourceRect {
  readonly sx: number;
  readonly sy: number;
  readonly size: number;
}

/**
 * Μετατρέπει «ζουμ + μετατόπιση οθόνης» σε **τετράγωνο πηγής**.
 *
 * Η μετατόπιση περιορίζεται **εδώ μέσα** και όχι στον καλούντα: ένας cropper που
 * εμπιστεύεται τον καλούντα για τον περιορισμό είναι ένας cropper που θα
 * παραβιαστεί από τον **επόμενο** καλούντα.
 */
export function computeSourceRect(request: CropRequest): SourceRect {
  const { source, viewport } = request;
  const scale = computeCoverScale(source, viewport) * Math.max(1, request.zoom);
  const offset = clampOffset(request.offset, source, scale, viewport);
  const size = viewport / scale;
  return {
    sx: source.width / 2 - offset.x / scale - size / 2,
    sy: source.height / 2 - offset.y / scale - size / 2,
    size,
  };
}
