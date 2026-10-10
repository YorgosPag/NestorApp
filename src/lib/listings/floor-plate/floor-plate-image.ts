/**
 * @fileoverview **Η ΕΙΚΟΝΑ ΤΟΥ ΟΡΟΦΟΥ: φεύγει, με ποιο κάδρο, και ποιανού υποβάθρου είναι τα περιγράμματα;** (ADR-907 §11.7)
 * @related ./floor-plate-outline (`FloorPlateImageSource`) · lib/listings/listing-file-deliverability · lib/images/image-dimensions
 * @module lib/listings/floor-plate/floor-plate-image
 *
 * Τρεις ερωτήσεις που **οφείλουν** να απαντηθούν μαζί: ένα περίγραμμα έχει νόημα μόνο πάνω στην εικόνα του **δικού του**
 * υποβάθρου, και μόνο αν το κάδρο είναι τα pixels που **πράγματι** έχουν τα bytes.
 *
 * | Ερώτηση | Απάντηση | Πηγή |
 * |---|---|---|
 * | επιτρέπεται να φύγει; | `classification === 'public'` + παραδοτέα εικόνα **του ορόφου** | το έγγραφο `files` |
 * | ποιο κάδρο; | τα **φυσικά pixels των bytes** | `files.imageDimensions` — το γράφει ο διακομιστής (storage trigger), μετά το EXIF |
 * | ποια περιγράμματα; | όσα έχουν `backgroundId` το υπόβαθρο **αυτού** του αρχείου | `floorplan_backgrounds.fileId` |
 *
 * 🔴 **ΔΥΟ ΑΡΝΗΣΕΙΣ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΥΠΕΡΒΟΛΗ** (§11.1, «αμέτρητα»):
 * - `frame-mismatch` — το υπόβαθρο δηλώθηκε από τον **browser** (`naturalBounds`)· τα περιγράμματα σχεδιάστηκαν σε
 *   εκείνον τον χώρο. Αν διαφέρει από τα pixels των bytes, κάθε περίγραμμα θα έπεφτε σε λάθος θέση **χωρίς σφάλμα**.
 * - `background-transformed` — μετά από βαθμονόμηση τα περιγράμματα ξαναγράφονται (`calibration-remap.service`) σε χώρο
 *   που **δεν έχει μετρηθεί** έναντι της εικόνας. Ως τη μέτρηση, βαθμονομημένο υπόβαθρο δεν βγαίνει στο κοινό.
 *
 * ⚠️ **ΜΙΑ πηγή σήμερα — η ανεβασμένη εικόνα.** Η λήψη από το σχέδιο (Βήμα 8) δεν έχει ακόμη παραγωγό ούτε πεδίο
 * θεματοφυλακής· το σκέλος της θα μπει **μαζί με την πόρτα της** (ο κανόνας του `FloorplanProvenance`).
 *
 * ⚠️ **Καθαρό module** — καμία I/O.
 */

import { ENTITY_TYPES, FILE_CATEGORIES, FILE_CLASSIFICATIONS } from '@/config/domain-constants';
import { normalizeToISO } from '@/lib/date-local';
import { imageDimensionsOf } from '@/lib/images/image-dimensions';
import { isDeliverableListingImage, type ListingFileCandidate } from '@/lib/listings/listing-file-deliverability';
import type { FloorplanProvenance } from '@/lib/listings/listing-material';
import { isPlainRecord } from '@/lib/type-guards';
import type { FileRecord } from '@/types/file-record';

import type { FloorPlateImageSource } from './floor-plate-outline';

/** Το `FileRecord` όσο το χρειάζεται αυτή η κρίση — `Pick` του αληθινού συμβολαίου, ώστε μετονομασία να σπάει εδώ. */
export type FloorPlateFileCandidate = ListingFileCandidate &
  Pick<FileRecord, 'entityId' | 'category' | 'classification' | 'imageDimensions'>;

/** Ένα υπόβαθρο του ορόφου, **όπως βγήκε από τη βάση** — ο τύπος του ζει στον viewer (πύλη 3.62) και δεν εισάγεται. */
export interface FloorPlateBackgroundCandidate {
  readonly id: string;
  readonly fileId?: unknown;
  readonly naturalBounds?: unknown;
  readonly transform?: unknown;
}

export type FloorPlateImageRefusal =
  | 'image-missing'
  | 'image-not-public'
  | 'image-not-deliverable'
  | 'image-undated'
  | 'image-unmeasured'
  | 'background-missing'
  | 'background-transformed'
  | 'frame-mismatch';

export interface FloorPlateImage {
  readonly source: FloorPlateImageSource;
  /** Το `backgroundId` που φέρουν τα περιγράμματα **αυτής** της εικόνας. */
  readonly backgroundId: string;
  readonly provenance: FloorplanProvenance;
  /** ISO — πότε μπήκε το υλικό στο σύστημα **από την πηγή** (το `createdAt` του αρχείου). */
  readonly at: string;
}

type FloorPlateImageReading =
  | { readonly ok: true; readonly image: FloorPlateImage }
  | { readonly ok: false; readonly why: FloorPlateImageRefusal };

function refuse(why: FloorPlateImageRefusal): FloorPlateImageReading {
  return { ok: false, why };
}

/** Ταυτοτικός μετασχηματισμός — το μόνο υπόβαθρο όπου «χώρος περιγραμμάτων = pixels της εικόνας» ισχύει εκ κατασκευής. */
function isIdentityTransform(raw: unknown): boolean {
  // Απών μετασχηματισμός = η προεπιλογή του `FloorplanBackgroundService` (ταυτοτικός).
  if (raw === undefined || raw === null) return true;
  if (!isPlainRecord(raw)) return false;
  const { translateX, translateY, scaleX, scaleY, rotation } = raw;
  return translateX === 0 && translateY === 0 && scaleX === 1 && scaleY === 1 && rotation === 0;
}

/**
 * **Είναι αυτό το αρχείο εικόνα ΑΥΤΟΥ του ορόφου που επιτρέπεται να φύγει;** — εξουσιοδότηση και καταλληλότητα, οι δύο
 * ανεξάρτητοι φρουροί της ADR-841 Α14: η υπογεγραμμένη δήλωση **προστίθεται** σε αυτούς, δεν τους αντικαθιστά.
 */
function admissionRefusal(file: FloorPlateFileCandidate, floorId: string): FloorPlateImageRefusal | null {
  if (file.entityId !== floorId || file.category !== FILE_CATEGORIES.FLOORPLANS) return 'image-missing';
  if (!isDeliverableListingImage(file, ENTITY_TYPES.FLOOR)) return 'image-not-deliverable';
  // ⚠️ `=== 'public'`, ποτέ «όχι εμπιστευτικό»: το πεδίο είναι προαιρετικό και η απουσία του σημαίνει ιδιωτικό.
  return file.classification === FILE_CLASSIFICATIONS.PUBLIC ? null : 'image-not-public';
}

/**
 * **Η εικόνα του ορόφου, με το κάδρο της και το υπόβαθρο των περιγραμμάτων της — ή γιατί δεν βγαίνει.**
 *
 * 🔑 Το υπόβαθρο πρέπει να είναι **ακριβώς ένα**: δύο υπόβαθρα πάνω στο ίδιο αρχείο σημαίνουν δύο σύνολα περιγραμμάτων
 * για μία εικόνα, και κανένας κανόνας εδώ δεν μπορεί να διαλέξει ποιο ισχύει.
 */
export function floorPlateImageOf(
  file: FloorPlateFileCandidate,
  floorId: string,
  backgrounds: readonly FloorPlateBackgroundCandidate[],
): FloorPlateImageReading {
  const refused = admissionRefusal(file, floorId);
  if (refused !== null) return refuse(refused);

  const at = normalizeToISO(file.createdAt);
  if (at === null) return refuse('image-undated');

  const pixels = imageDimensionsOf(file.imageDimensions);
  if (pixels === null) return refuse('image-unmeasured');

  const own = backgrounds.filter((background) => background.fileId === file.id);
  if (own.length !== 1) return refuse('background-missing');
  const [background] = own;
  if (!isIdentityTransform(background.transform)) return refuse('background-transformed');

  const declared = imageDimensionsOf(background.naturalBounds);
  if (declared === null || declared.width !== pixels.width || declared.height !== pixels.height) {
    return refuse('frame-mismatch');
  }

  return {
    ok: true,
    image: {
      source: { kind: 'upload', widthPx: pixels.width, heightPx: pixels.height },
      backgroundId: background.id,
      provenance: 'declared',
      at,
    },
  };
}
