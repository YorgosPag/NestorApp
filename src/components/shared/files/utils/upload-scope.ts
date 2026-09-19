/**
 * @fileoverview **Πού γράφει ένα ανέβασμα — και τι διαβάζει η καρτέλα** · η ΜΙΑ αλήθεια για το εύρος ενός αρχείου.
 * @related ADR-866 §2.10 (Β1) · ADR-588 (κέλυφος καρτελών) · ADR-031 · ADR-293
 * @module components/shared/files/utils/upload-scope
 *
 * 🔴 **Η βλάβη που γέννησε αυτό το module (ζωντανή επαλήθευση 2026-09-19)**: η καρτέλα **διάβαζε** με το δικό της
 * `domain`/`category` (`useEntityFiles`), ενώ το ανέβασμα **έγραφε** το `domain`/`category` του τύπου εγγράφου
 * (`useFileUpload`). Δύο ανεξάρτητες αλήθειες για το ίδιο ερώτημα, **χωρίς** κανέναν να ελέγχει ότι συμφωνούν ⇒
 * είτε κανένας τύπος για ανέβασμα (αδιέξοδο) είτε — χειρότερα — ανέβασμα που **πετυχαίνει και δεν φαίνεται**.
 *
 * 🔑 **Εδώ το «τι διαβάζω» ΠΑΡΑΓΕΤΑΙ από το «πού γράφω»**: οι αναγνωστικές εμβέλειες μιας καρτέλας είναι η **εικόνα**
 * της `resolveUploadScope` πάνω σε **κάθε** είσοδο που η καρτέλα προσφέρει (+ «χωρίς επιλογή»: λήψη, σημείωση).
 * Ό,τι μπορείς να ανεβάσεις, το βλέπεις — κατασκευαστικά, όχι κατά σύμπτωση.
 *
 * ⚠️ `resolveUploadScope` είναι **αυτούσια** η παλιά λογική του `useFileUpload` (επιλογή γράφει `domain`/`category`·
 * ο σκοπός της καρτέλας κερδίζει εκτός αν είναι «μετα-σκοπός» φωτογραφίας) — ό,τι δεν δηλώνει `purposeAuthority`
 * συμπεριφέρεται **ακριβώς** όπως πριν.
 */

import type { FileCategory, FileDomain } from '@/config/domain-constants';
import type { UploadEntryPoint } from '@/config/upload-entry-points';
import type { FileRecord } from '@/types/file-record';
import { META_PHOTO_PURPOSES, buildPurposeFilter } from '../hooks/useEntityFiles-purpose-filter';

/** Το εύρος ενός αρχείου — τα τρία πεδία με τα οποία μια καρτέλα το **βρίσκει**. */
export interface FileScope {
  readonly domain: FileDomain;
  readonly category: FileCategory;
  /** `undefined` ⇒ οποιοσδήποτε σκοπός μέσα στο `domain`/`category`. */
  readonly purpose?: string;
}

/**
 * **Ποιος ορίζει τον σκοπό του αρχείου** — η καρτέλα ή ο τύπος εγγράφου.
 * · `tab` — ο σκοπός της καρτέλας (π.χ. `parking-floorplan`: ξεχωρίζει καρτέλες της **ίδιας** κατηγορίας).
 * · `entry` — ο σκοπός του τύπου (π.χ. `study-title-deed`): ο **τύπος** είναι η ταυτότητα του εγγράφου — «Συμβόλαιο
 *   Μεταβίβασης» είναι το ίδιο έγγραφο όποιος κι αν το ανεβάσει (ADR-866 §3.1). Ο σκοπός της καρτέλας = εφεδρεία.
 */
export type PurposeAuthority = 'tab' | 'entry';

/** Οι προεπιλογές της καρτέλας — ό,τι γράφεται όταν **δεν** επιλέχθηκε τύπος (λήψη κάμερας, σημείωση, ήχος). */
export interface UploadTabDefaults {
  readonly domain: FileDomain;
  readonly category: FileCategory;
  readonly purpose?: string;
  /** Παράλειψη ⇒ ο παλιός κανόνας: `entry` για μετα-σκοπούς φωτογραφίας/χωρίς σκοπό, αλλιώς `tab`. */
  readonly purposeAuthority?: PurposeAuthority;
}

/**
 * **Η πολιτική εμβέλειας μιας καρτέλας** — ό,τι δίνει το κέλυφος στο `EntityFilesManager` όταν το «τι διαβάζω»
 * **παράγεται** από το «τι προσφέρω» (αντί για σκέτο `domain`/`category`).
 */
export interface FilesTabScopePolicy {
  readonly readScopes: readonly FileScope[];
  readonly purposeAuthority: PurposeAuthority;
}

type ScopeSource = Pick<UploadEntryPoint, 'domain' | 'category' | 'purpose'>;

function purposeAuthorityOf(tab: UploadTabDefaults): PurposeAuthority {
  if (tab.purposeAuthority) return tab.purposeAuthority;
  return !tab.purpose || META_PHOTO_PURPOSES.has(tab.purpose) ? 'entry' : 'tab';
}

/** **Πού θα γραφτεί** ένα ανέβασμα αυτής της καρτέλας, με (ή χωρίς) επιλεγμένο τύπο εγγράφου. */
export function resolveUploadScope(entry: ScopeSource | null, tab: UploadTabDefaults): FileScope {
  const purpose = purposeAuthorityOf(tab) === 'entry' ? (entry?.purpose || tab.purpose) : tab.purpose;
  return {
    domain: entry?.domain || tab.domain,
    category: entry?.category || tab.category,
    ...(purpose ? { purpose } : {}),
  };
}

function scopeKey(scope: FileScope): string {
  return `${scope.domain}|${scope.category}|${scope.purpose ?? '*'}`;
}

/**
 * **Τι διαβάζει η καρτέλα** = η εικόνα του `resolveUploadScope` πάνω σε ό,τι προσφέρει **+** «χωρίς επιλογή».
 * Χωρίς διπλότυπα, σταθερή σειρά (σειρά προσφοράς) ⇒ σταθερή ταυτότητα για τα `useEffect`.
 */
export function tabReadScopes(offered: readonly ScopeSource[], tab: UploadTabDefaults): readonly FileScope[] {
  const seen = new Map<string, FileScope>();
  for (const scope of [...offered.map((entry) => resolveUploadScope(entry, tab)), resolveUploadScope(null, tab)]) {
    if (!seen.has(scopeKey(scope))) seen.set(scopeKey(scope), scope);
  }
  return [...seen.values()];
}

/** Ανήκει το αρχείο σε **μία** από τις εμβέλειες; (ακριβές `domain`+`category`· σκοπός μόνο όταν δηλώνεται) */
export function matchesFileScopes(
  file: Pick<FileRecord, 'domain' | 'category' | 'purpose'>,
  scopes: readonly FileScope[],
): boolean {
  return scopes.some((scope) =>
    file.domain === scope.domain
    && file.category === scope.category
    && (scope.purpose === undefined || file.purpose === scope.purpose));
}

/**
 * **Το ΕΝΑ φίλτρο ανάγνωσης** — κοινό για φόρτωση (`useEntityFiles`) **και** realtime (`useEntityFilesRealtime`).
 * Με εμβέλειες κρίνουν αυτές· χωρίς, ο ιστορικός κανόνας σκοπού (`buildPurposeFilter`) αυτούσιος.
 */
export function buildFileReadFilter(
  purpose: string | undefined,
  scopes: readonly FileScope[] | undefined,
): (file: Pick<FileRecord, 'domain' | 'category' | 'purpose'>) => boolean {
  if (!scopes) return buildPurposeFilter(purpose);
  return (file) => matchesFileScopes(file, scopes);
}

/**
 * **Τι στενεύει το ΕΡΩΤΗΜΑ** — με εμβέλειες κανένα `domain`/`category` στον διακομιστή: ζητούνται τα αρχεία της
 * οντότητας και κρίνει το φίλτρο στον πελάτη. ⇒ **καμία** νέα μορφή ερωτήματος (CHECK 3.15), όσες εμβέλειες κι αν έχει.
 */
export function readQueryNarrowing(
  narrowing: { readonly domain?: FileDomain; readonly category?: FileCategory },
  scopes: readonly FileScope[] | undefined,
): { readonly domain?: FileDomain; readonly category?: FileCategory } {
  return scopes ? {} : narrowing;
}

const INTERNED_SCOPES = new Map<string, readonly FileScope[]>();

/**
 * **Ίδιο περιεχόμενο ⇒ ίδιο αντικείμενο** (interning) — οι λίστες εμβελειών μπαίνουν σε dependencies hooks χωρίς
 * κίνδυνο βρόχου, όσο συχνά κι αν ξαναχτίζει ο καλών (σχήμα «selector `?? []` = νέος πίνακας», MEMORY). Ο πίνακας
 * μεγαλώνει μόνο με **διακριτά** σύνολα εμβελειών — λίγες δεκάδες σε όλη την εφαρμογή.
 */
export function internFileScopes(scopes: readonly FileScope[] | undefined): readonly FileScope[] | undefined {
  if (!scopes) return undefined;
  const key = scopes.map(scopeKey).join(',');
  const interned = INTERNED_SCOPES.get(key);
  if (interned) return interned;
  INTERNED_SCOPES.set(key, scopes);
  return scopes;
}
