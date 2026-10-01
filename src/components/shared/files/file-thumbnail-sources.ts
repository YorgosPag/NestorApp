/**
 * =============================================================================
 * ΤΙ ΔΕΙΧΝΕΙ ΜΙΑ ΜΙΚΡΟΓΡΑΦΙΑ ΑΡΧΕΙΟΥ, ΚΑΙ ΜΕ ΤΙ ΣΕΙΡΑ; (ADR-899 §4.1)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Για αυτή την εγγραφή, σε κουτί N px, ποιες πηγές εικόνας δοκιμάζω — με ποια σειρά;»*
 *
 * 🔴 **Γιατί**: η μικρογραφία έβαζε `<img src={downloadUrl}>` ⇒ κουτί 40 px κατέβαζε **ολόκληρο** το πρωτότυπο
 * (MB ανά γραμμή λίστας), και εγγραφή χωρίς `downloadUrl` (seed/παλιές ροές) έδειχνε **εικονίδιο** ενώ τα bytes
 * υπήρχαν. Τώρα: ο ΕΝΑΣ αναγνώστης (`fileDisplayUrlOf`) και η κλίμακα παραγώγων του server.
 *
 * 🏆 **Πρακτική Google Drive / Dropbox / Immich**: μικρογραφίες από **παράγωγα του server**, όχι από το πρωτότυπο
 * ούτε από ό,τι έφτιαξε ο browser του ανεβάσαντα. Η σειρά:
 *   1. `preview` (srcset + `sizes` = το **ίδιο** px με το κουτί) — ο browser διαλέγει `w=320` σε DPR 2·
 *   2. `thumbnailUrl` (client `_thumb.webp`, ADR-899 §1) — **εφεδρεία** για εγγραφές χωρίς μονοπάτι·
 *   3. το πρωτότυπο — **μόνο** για εικόνα που δεν προεπισκοπείται (svg/gif: ο κωδικοποιητής δεν τις αγγίζει).
 * Κάθε `onError` προχωρά στην επόμενη· στο τέλος, εικονίδιο (ή σελίδα 1 του PDF).
 *
 * ⚠️ **Καθαρό module** — κανένα React, ώστε η σειρά να ελέγχεται χωρίς DOM.
 *
 * @module components/shared/files/file-thumbnail-sources
 * @see lib/files/file-display-url — ο ένας αναγνώστης
 */

import { fileDisplayUrlOf, type FileDisplayUrlSubject } from '@/lib/files/file-display-url';

export type ThumbnailSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * **Ένας πίνακας για κλάση ΚΑΙ px**: το `sizes` του `<img>` προκύπτει από το ίδιο κελί με το πλάτος του κουτιού,
 * άρα δεν μπορεί να «ξεφύγει» από αυτό (άγκυρα: `px` = πλάτος της κλάσης Tailwind, 1 μονάδα = 4 px).
 */
export const THUMBNAIL_SIZE_CONFIG: Readonly<Record<ThumbnailSize, { readonly container: string; readonly iconSize: string; readonly px: number }>> = {
  xs: { container: 'w-8 h-8', iconSize: 'h-4 w-4', px: 32 },
  sm: { container: 'w-10 h-10', iconSize: 'h-5 w-5', px: 40 },
  md: { container: 'w-16 h-16', iconSize: 'h-8 w-8', px: 64 },
  lg: { container: 'w-24 h-24', iconSize: 'h-12 w-12', px: 96 },
};

/** Ό,τι χρειάζεται η μικρογραφία από μια εγγραφή — **δομικό**, το ικανοποιεί κάθε `FileRecord`. */
export interface FileThumbnailSubject extends FileDisplayUrlSubject {
  readonly ext?: string | null;
  /** Η client μικρογραφία του ανεβάσματος (`_thumb.webp`) — εφεδρεία, όχι πρώτη επιλογή. */
  readonly thumbnailUrl?: string | null;
}

/** Μία πηγή για το `<img>`. */
export interface ThumbnailCandidate {
  readonly src: string;
  readonly srcSet?: string;
  readonly sizes?: string;
}

export interface ThumbnailKind {
  readonly isImage: boolean;
}

const nonEmpty = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** **Οι πηγές της μικρογραφίας, με σειρά προτίμησης.** Κενή λίστα ⇒ εικονίδιο (ή σελίδα PDF). */
export function thumbnailCandidatesOf(
  file: FileThumbnailSubject,
  kind: ThumbnailKind,
  boxPx: number,
): readonly ThumbnailCandidate[] {
  const resolved = fileDisplayUrlOf(file);
  const candidates: ThumbnailCandidate[] = [];
  const preview = resolved.kind === 'url' ? resolved.preview : null;

  if (kind.isImage && preview) {
    candidates.push({ src: preview.src, srcSet: preview.srcSet, sizes: `${boxPx}px` });
  }
  if (nonEmpty(file.thumbnailUrl)) candidates.push({ src: file.thumbnailUrl });
  if (kind.isImage && !preview && resolved.kind === 'url') candidates.push({ src: resolved.url });
  return candidates;
}

/** Ταυτότητα της λίστας — όταν αλλάζει το αρχείο, η κλιμάκωση σφαλμάτων ξεκινά από την αρχή. */
export function thumbnailCandidatesKey(candidates: readonly ThumbnailCandidate[]): string {
  return candidates.map((candidate) => candidate.src).join('\n');
}
