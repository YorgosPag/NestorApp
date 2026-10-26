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
 * ο σκοπός της καρτέλας κερδίζει εκτός αν είναι «μετα-σκοπός» καρτέλας, `META_TAB_PURPOSES`) — ό,τι δεν δηλώνει
 * `purposeAuthority` συμπεριφέρεται όπως πριν, **εκτός** από τις καρτέλες «Έγγραφα»: από 2026-10-07 ο `document`
 * είναι μετα-σκοπός και ο σκοπός του **τύπου** γράφεται (ADR-905 §7 βήμα 6 — πριν, κανένα αρχείο τους δεν
 * ικανοποιούσε γραμμή καταλόγου).
 */

import type { FileCategory, FileDomain } from '@/config/domain-constants';
import type { UploadEntryPoint } from '@/config/upload-entry-points';
import type { FileRecord } from '@/types/file-record';
import { META_TAB_PURPOSES, buildPurposeFilter } from '../hooks/useEntityFiles-purpose-filter';

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
  /** Παράλειψη ⇒ `entry` για μετα-σκοπούς καρτέλας (`META_TAB_PURPOSES`: φωτογραφίες · `document`)/χωρίς σκοπό, αλλιώς `tab`. */
  readonly purposeAuthority?: PurposeAuthority;
}

/**
 * **Η πολιτική εμβέλειας μιας καρτέλας** — ό,τι δίνει το κέλυφος στο `EntityFilesManager` όταν το «τι διαβάζω»
 * **παράγεται** από το «τι προσφέρω» (αντί για σκέτο `domain`/`category`).
 */
export interface FilesTabScopePolicy {
  readonly readScopes: readonly FileScope[];
  readonly purposeAuthority: PurposeAuthority;
  /**
   * ADR-916 Φ-Γ3 — **η καρτέλα-καταφύγιο**: διαβάζει **επιπλέον** ό,τι **δεν** διεκδικούν αυτές οι εμβέλειες (οι
   * εμβέλειες των αδελφών καρτελών). Έτσι κάθε αρχείο της οντότητας φαίνεται σε **ακριβώς μία** καρτέλα — ποτέ σε
   * καμία. Παράλειψη ⇒ η καρτέλα διαβάζει **μόνο** τις δικές της εμβέλειες (ό,τι ίσχυε).
   */
  readonly readsUnclaimedBy?: readonly FileScope[];
}

type ScopeSource = Pick<UploadEntryPoint, 'domain' | 'category' | 'purpose'>;

function purposeAuthorityOf(tab: UploadTabDefaults): PurposeAuthority {
  if (tab.purposeAuthority) return tab.purposeAuthority;
  return !tab.purpose || META_TAB_PURPOSES.has(tab.purpose) ? 'entry' : 'tab';
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
 * **Διαβάζει η καρτέλα αυτό το αρχείο;** — οι δικές της εμβέλειες **ή**, για την καρτέλα-καταφύγιο, «δεν το διεκδικεί
 * καμία αδελφή» (ADR-916 Φ-Γ3). Ο ΕΝΑΣ κριτής: τον ρωτούν το φίλτρο των hooks **και** το `propertyDossierFileTabOf`.
 */
export function matchesTabRead(
  file: Pick<FileRecord, 'domain' | 'category' | 'purpose'>,
  scopes: readonly FileScope[],
  unclaimedBy: readonly FileScope[] | undefined,
): boolean {
  return matchesFileScopes(file, scopes) || (unclaimedBy !== undefined && !matchesFileScopes(file, unclaimedBy));
}

/**
 * **Το ΕΝΑ φίλτρο ανάγνωσης** — κοινό για φόρτωση (`useEntityFiles`) **και** realtime (`useEntityFilesRealtime`).
 * Με εμβέλειες κρίνουν αυτές (+ το καταφύγιο, {@link matchesTabRead})· χωρίς, ο ιστορικός κανόνας σκοπού αυτούσιος.
 */
export function buildFileReadFilter(
  purpose: string | undefined,
  scopes: readonly FileScope[] | undefined,
  unclaimedBy?: readonly FileScope[],
): (file: Pick<FileRecord, 'domain' | 'category' | 'purpose'>) => boolean {
  if (!scopes) return buildPurposeFilter(purpose);
  return (file) => matchesTabRead(file, scopes, unclaimedBy);
}

/** Ό,τι περνά το κέλυφος στο `useEntityFiles` από την πολιτική της καρτέλας — ένα σημείο, όχι δύο πεδία με το χέρι. */
export function tabReadParams(policy: FilesTabScopePolicy | undefined): {
  readonly scopes?: readonly FileScope[];
  readonly unclaimedBy?: readonly FileScope[];
} {
  return { scopes: policy?.readScopes, unclaimedBy: policy?.readsUnclaimedBy };
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

/**
 * **Πώς φτάνουν τα αρχεία στη λίστα** — `true` ⇒ ο ακροατής (`onSnapshot`) **κατέχει** τη λίστα· αλλιώς εφάπαξ ανάγνωση.
 *
 * 🔴 **Γιατί οι καρτέλες με εμβέλειες είναι ΠΑΝΤΑ ζωντανές (ADR-866 §2.10.8 Β5, μετρημένο στην παραγωγή)**: χωρίς
 * στένεμα (`readQueryNarrowing`) όλες οι καρτέλες μιας οντότητας στέλνουν το **ίδιο** canonical ερώτημα. Όταν ένας
 * ακροατής του ζει ήδη, το SDK απαντά την `getDocs` από τη **δική του** όψη — «συγχρονισμένη» (`fromCache: false`)
 * αλλά ~100ms **πίσω** από την εγγραφή που μόλις επιβεβαιώθηκε. Μετρημένο: `getDocs` τη στιγμή του `ready` ⇒ 3
 * έγγραφα· ο ακροατής 97ms μετά ⇒ 4. Άρα «γράφω και ξαναρωτώ» **δεν** εγγυάται ότι βλέπω ό,τι έγραψα· ο ακροατής ναι.
 */
export function fileListIsLive(
  displayStyle: string | undefined,
  scopes: readonly FileScope[] | undefined,
): boolean {
  return displayStyle === 'floorplan-gallery' || scopes !== undefined;
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
