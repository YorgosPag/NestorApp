// ⚠️ GENERATED — DO NOT EDIT. Verbatim projection of src/lib/files/storage-orphan-candidate.ts (ADR-874 · CHECK 3.93).
// Edit the source, then run: npm run generate:functions-projection
// sha256:db25a694f2ffe92fa4a8656e5b21d7968b35da42b2dff4af07a4d57018703abb

/**
 * 🧹 **ΤΟ ΣΗΜΑΔΙ ΥΠΟΨΗΦΙΟΥ ΟΡΦΑΝΟΥ** — ο ΕΝΑΣ κώδικας για το έγγραφο `storage_orphan_candidates/{id}` (ADR-694 Α1 · ADR-895 Ρ14 ·
 * ADR-916 Ο24).
 *
 * Το mark-and-sweep του ADR-694 έχει **δύο** πηγές σημαδιών: το finalize των Cloud Functions (`orphan-cleanup.ts`) και την
 * άρση διατήρησης ορφανών bytes της εφαρμογής (ADR-916 Ο24 — Purview: *η άρση δεν διαγράφει, το περιεχόμενο γίνεται eligible
 * for the standard cleanup*). Ο **ένας** διαγραφέας (`orphanSweeper`) διαβάζει **ένα** σχήμα· δύο χειρόγραφα αντίγραφα του
 * κλειδιού θα έφτιαχναν δύο έγγραφα για το ίδιο αντικείμενο, και του σχήματος θα άφηναν το ένα να μην ωριμάσει ποτέ.
 *
 * **Layering**: leaf — μόνο `./file-storage-placement` (προβάλλεται στα Cloud Functions, ADR-874 · CHECK 3.93).
 *
 * @module lib/files/storage-orphan-candidate
 */

import { FILE_STORAGE_PLACEMENT_LEGACY, type FileStoragePlacement } from './file-storage-placement';

/**
 * Σταθερό doc id από το storage path: base64url, χωρίς `/` (απαγορευμένο σε doc ids)
 * και χωρίς padding. Ίδιο αντικείμενο → ίδιο έγγραφο → το re-upload ενημερώνει, δεν
 * πολλαπλασιάζει (idempotent).
 *
 * 🔴 ADR-895 Ρ14 — το αντικείμενο είναι **(κάδος, path)**, όχι path. Στη μετάβαση (copy → verify →
 * delete) το ΙΔΙΟ path ζει σε δύο κάδους· με κλειδί μόνο το path τα δύο σημάδια γίνονταν ΕΝΑ έγγραφο
 * και το `bucket` του δεύτερου έσβηνε του πρώτου ⇒ ο sweeper θα έκρινε λάθος αντικείμενο. Η **θέση**
 * (όχι το όνομα κάδου: σταθερή ανά περιβάλλον) μπαίνει στο κλειδί — εκτός από το legacy, που κρατά
 * το κλειδί **αυτολεξεί** ώστε κάθε υπάρχον σημάδι να μένει έγκυρο (ίδιο πρότυπο με το `?placement=`).
 * Ασφαλές ως διακριτό: ο marker δέχεται μόνο paths `companies/…`, ποτέ `{θέση}:…`.
 */
export function candidateDocId(filePath: string, placement: FileStoragePlacement): string {
  const key = placement === FILE_STORAGE_PLACEMENT_LEGACY ? filePath : `${placement}:${filePath}`;
  return Buffer.from(key, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Το πόρισμα κηδεμονίας που καταγράφεται — το ίδιο σχήμα με το `CustodyOutcome` του `storage-path-custody`. */
export interface OrphanCandidateCustody {
  readonly kind: string;
  readonly rule?: string;
  readonly reason?: string;
}

export interface OrphanCandidateObject {
  readonly storagePath: string;
  /** Ο κάδος όπου **ζει** το αντικείμενο (ADR-895 Α7) — ο sweeper σβήνει εκεί, ποτέ «πάντα στον κανονικό». */
  readonly bucket: string;
  readonly contentType: string | null;
  readonly size: number | null;
}

/**
 * **Τα πεδία του σημαδιού** — χωρίς το `firstSeenAt`: το γράφει ο γραφέας **μόνο την πρώτη φορά**, ώστε η ωρίμανση να μετρά
 * από την πρώτη παρατήρηση (αλλιώς ένα αντικείμενο που ξανασημαδεύεται τακτικά δεν θα ωρίμαζε ποτέ). Το `now` είναι η
 * χρονοσφραγίδα διακομιστή του καλούντος (`FieldValue.serverTimestamp()` — κάθε πλευρά έχει το δικό της Admin SDK).
 */
export function orphanCandidateFields<TTimestamp>(object: OrphanCandidateObject, custody: OrphanCandidateCustody, now: TTimestamp) {
  return {
    storagePath: object.storagePath,
    bucket: object.bucket,
    custodyKind: custody.kind,
    custodyRule: custody.rule ?? null,
    unknownReason: custody.reason ?? null,
    contentType: object.contentType,
    size: object.size,
    lastSeenAt: now,
  };
}

/** Το πρώτο τμήμα του ονόματος αρχείου πριν από την πρώτη τελεία (`{fileId}.{ext}` ⇒ `fileId`). */
export function stripStorageExtension(fileName: string): string {
  const dot = fileName.indexOf('.');
  return dot === -1 ? fileName : fileName.slice(0, dot);
}

/**
 * **Ποια `FileRecord` κατέχει αυτό το όνομα** — κανόνας `files` του μητρώου κηδεμονίας: path που τελειώνει σε
 * `files/{fileId}.{ext}` ⇒ `fileId`· αλλιώς `null`. Ένας κώδικας για τον κριτή του sweeper **και** για όποιον σημαδεύει
 * «ορφανό κατά τον κανόνα `files`» — αλλιώς το σημάδι θα υποσχόταν κάτι που ο επανέλεγχος δεν αναγνωρίζει.
 */
export function fileRecordIdOfPathSegments(segments: readonly string[]): string | null {
  return segments.length >= 2 && segments[segments.length - 2] === 'files'
    ? stripStorageExtension(segments[segments.length - 1]) || null
    : null;
}
