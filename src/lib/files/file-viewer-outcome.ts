/**
 * =============================================================================
 * ΤΙ ΔΕΙΧΝΕΙ Ο ΘΕΑΤΗΣ ΓΙΑ ΤΗΝ ΤΑΥΤΟΤΗΤΑ ΠΟΥ ΖΗΤΑ Η ΔΙΕΥΘΥΝΣΗ; — ο ΕΝΑΣ απαντητής (ADR-899 §9 θέμα 10)
 * =============================================================================
 *
 * Η διεύθυνση `/files?file=<id>` μπορεί να ζητήσει **οποιαδήποτε** ταυτότητα: αρχείο που κρύβουν τα φίλτρα,
 * αρχείο του Κάδου, εισερχόμενο, αρχειοθετημένο, ξένου μισθωτή, ανύπαρκτο. Κάθε περίπτωση έχει **όνομα**·
 * καμία δεν καταλήγει σε άδειο πάνελ χωρίς εξήγηση.
 *
 * 🔑 **Η γενική απόφαση δεν ξαναγράφεται εδώ**: το «ζητήθηκε / ψάχνουμε / βρέθηκε / κάδος / δεν υπάρχει» είναι
 * το `deriveEntitySelection` (ADR-777 §8.31). Εδώ μένει **μόνο** ό,τι είναι των αρχείων — τι σημαίνει η
 * **μορφή** μιας ευρεθείσας εγγραφής (κάτοχος, κύκλος ζωής, κατάσταση) για τον θεατή.
 *
 * 🏆 **Πρακτική**: Google Drive — σύνδεσμος προς αρχείο του κάδου δείχνει *«No preview available. File is in the
 * owner's trash»*, **χωρίς** προβολή. Και το «δεν βρέθηκε» **δεν ξεχωρίζει** από το «ανήκει αλλού» (Drive, GitHub):
 * η διάκριση θα επέτρεπε απαρίθμηση ξένων ταυτοτήτων.
 *
 * ⚠️ **Καθαρό module** — κανένα I/O, κανένα React.
 *
 * @module lib/files/file-viewer-outcome
 * @see hooks/entity-selection-state — η γενική απόφαση επιλογής
 * @see lib/files/file-viewer-route — η διεύθυνση
 */

import { FILE_DOMAINS, FILE_LIFECYCLE_STATES, FILE_STATUS } from '@/config/domain-constants';
import type { EntitySelection } from '@/hooks/entity-selection-state';
import { isOwnedByCustody } from '@/lib/workspace/custody-scope';

/** Ό,τι χρειάζεται από μια εγγραφή — **δομικό**, ώστε να μη σέρνει όλο τον `FileRecord`. */
export interface FileViewerSubject {
  readonly id: string;
  readonly companyId?: string | null;
  readonly userId?: string | null;
  readonly status?: string | null;
  readonly domain?: string | null;
  readonly lifecycleState?: string | null;
  readonly isDeleted?: boolean | null;
}

/**
 * **Οι εκβάσεις του θεατή. Κλειστό σύνολο — καμία σιωπηλή.**
 *
 * `shown` και `inbox` **δείχνουν** το αρχείο· όλες οι άλλες δείχνουν **ονομασμένο μήνυμα**.
 */
export type FileViewerOutcome<T extends FileViewerSubject> =
  /** Η διεύθυνση δεν ζήτησε αρχείο. */
  | { readonly kind: 'none' }
  /** Ζητήθηκε· **δεν ξέρουμε ακόμη**. Ποτέ «δεν βρέθηκε» πριν απαντήσουν οι πηγές. */
  | { readonly kind: 'resolving' }
  /** Ενεργό αρχείο του χώρου. `hiddenByFilters` ⇒ υπάρχει, αλλά η λίστα αριστερά **δεν** το δείχνει. */
  | { readonly kind: 'shown'; readonly file: T; readonly hiddenByFilters: boolean }
  /** Εισερχόμενο που δεν έχει ταξινομηθεί — δείχνεται, με ένδειξη. */
  | { readonly kind: 'inbox'; readonly file: T }
  /** Στον Κάδο — **καμία προβολή**, καμία αυτόματη επαναφορά. */
  | { readonly kind: 'trashed' }
  /** Αρχειοθετημένο για διατήρηση. */
  | { readonly kind: 'archived' }
  /** Δεν υπάρχει **ή** δεν ανήκει σε αυτόν τον χώρο — σκόπιμα το ίδιο. */
  | { readonly kind: 'not-found' };

export interface FileViewerContext {
  /** Ο χώρος της σελίδας. Εγγραφή άλλου κατόχου **δεν** δείχνεται, ό,τι κι αν επέτρεψαν οι κανόνες ανάγνωσης. */
  readonly companyId: string;
  /** Τα ids που δείχνει **τώρα** η λίστα (μετά από φίλτρα και αναζήτηση). */
  readonly visibleIds: ReadonlySet<string>;
}

const NOT_FOUND = { kind: 'not-found' } as const;

/**
 * **Ανήκει η εγγραφή στον χώρο της σελίδας;** — με το SSoT `isOwnedByCustody`, ποτέ χειρόγραφο `===`:
 * κενός χώρος είναι **απουσία**, όχι ταίριασμα, και προσωπικό αρχείο δεν ανήκει ποτέ σε εταιρεία.
 */
function belongsToWorkspace(file: FileViewerSubject, context: FileViewerContext): boolean {
  return isOwnedByCustody({ companyId: file.companyId, userId: file.userId }, { companyId: context.companyId });
}

/** Κατατάσσει μια **ευρεθείσα** εγγραφή από τη δική της μορφή. */
function classifyFound<T extends FileViewerSubject>(file: T, context: FileViewerContext): FileViewerOutcome<T> {
  // 🔒 Ο κάτοχος πρώτα: ρόλος με ευρεία ανάγνωση (π.χ. super_admin) **διαβάζει** ξένη εγγραφή — ο θεατής ενός
  //    χώρου δεν τη δείχνει ποτέ. Προσωπικό αρχείο πέφτει στον ίδιο κλάδο.
  if (!belongsToWorkspace(file, context)) return NOT_FOUND;

  if (file.isDeleted === true || file.lifecycleState === FILE_LIFECYCLE_STATES.TRASHED) return { kind: 'trashed' };
  if (file.lifecycleState === FILE_LIFECYCLE_STATES.ARCHIVED) return { kind: 'archived' };
  if (file.lifecycleState === FILE_LIFECYCLE_STATES.PURGED) return NOT_FOUND;

  if (file.status === FILE_STATUS.READY) {
    return { kind: 'shown', file, hiddenByFilters: !context.visibleIds.has(file.id) };
  }
  // Εκκρεμές **εισερχόμενο** έχει bytes και περιμένει ταξινόμηση. Κάθε άλλο μη έτοιμο (ανέβασμα σε εξέλιξη,
  // αποτυχημένο) δεν έχει τι να δείξει.
  if (file.status === FILE_STATUS.PENDING && file.domain === FILE_DOMAINS.INGESTION) return { kind: 'inbox', file };
  return NOT_FOUND;
}

/** Η έκβαση του θεατή για την επιλογή που έβγαλε το `deriveEntitySelection`. */
export function fileViewerOutcomeOf<T extends FileViewerSubject>(
  selection: EntitySelection<T>,
  context: FileViewerContext,
): FileViewerOutcome<T> {
  switch (selection.kind) {
    case 'none':
      return { kind: 'none' };
    case 'resolving':
      return { kind: 'resolving' };
    case 'not-found':
      return NOT_FOUND;
    case 'archived':
      // Βρέθηκε στη λίστα του Κάδου: ο κάτοχος ελέγχεται κι εδώ, για να μη διαρρεύσει «υπάρχει, στον κάδο».
      return belongsToWorkspace(selection.item, context) ? { kind: 'trashed' } : NOT_FOUND;
    case 'selected':
      return classifyFound(selection.item, context);
  }
}

/** Το αρχείο που **δείχνει** ο θεατής, ή `null` όταν η έκβαση είναι μήνυμα. */
export function fileShownBy<T extends FileViewerSubject>(outcome: FileViewerOutcome<T>): T | null {
  return outcome.kind === 'shown' || outcome.kind === 'inbox' ? outcome.file : null;
}
