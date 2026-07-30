/**
 * ADR-736 Φ3 — **ΕΠΙΛΥΣΗ**: από «το σχέδιο δηλώνει 10 υπόβαθρα» σε «τα 9 ζωγραφίζονται».
 *
 * Η ΑΝΙΧΝΕΥΣΗ (Φ1) ζει στον `DxfSceneBuilder` και **πετυχαίνει πάντα**. Η ΕΠΙΛΥΣΗ ζει εδώ,
 * είναι **client-only** και **συχνά αποτυγχάνει μερικώς** — που είναι φυσιολογική κατάσταση,
 * όχι σφάλμα. Η διάκριση δεν είναι φιλολογική: γι' αυτό η επίλυση δεν είναι μέρος του
 * builder και γι' αυτό μπορεί να τρέξει **αργότερα**, πάνω σε οποιαδήποτε σκηνή — ακόμη και
 * σε μία που ήρθε από τον server wizard (πόρτα Β) χωρίς επανεισαγωγή.
 *
 * ## Τρία βήματα, με αυτή τη σειρά
 *
 * 1. **ΤΑΥΤΙΣΗ** → `./dxf-external-reference-match` (καθαρή, δοκιμασμένη χωρίς browser).
 * 2. **DEDUP ΜΕ ΠΕΡΙΕΧΟΜΕΝΟ** → SHA-256 των bytes. Ίδια bytes ⇒ **ένα** ανέβασμα, ακόμη κι
 *    όταν ο χρήστης έδωσε το ίδιο αρχείο δύο φορές με άλλο όνομα.
 * 3. **ΑΝΕΒΑΣΜΑ** → injected· η υπηρεσία Storage δεν αγγίζεται από εδώ.
 *
 * ## Η αποτυχία είναι **ανά αναφορά**, ποτέ καθολική
 *
 * Ένα υπόβαθρο 40 MB που κόβεται από τους κανόνες Storage **δεν** ρίχνει τα υπόλοιπα εννιά.
 * Κάθε αποτυχία επιστρέφεται ονομαστικά ({@link ResolveReferenceFailure}) και η αναφορά μένει
 * `missing` — δηλαδή ο χρήστης βλέπει ακριβώς ό,τι έβλεπε πριν, συν τον λόγο. Ίδια στάση με
 * το *Manage Links* του Revit, όπου ένας σύνδεσμος που απέτυχε δεν κλείνει το σχέδιο.
 *
 * ⚠️ **Καμία μετάλλαξη.** Επιστρέφει **νέο** πίνακα αναφορών· το «τι δήλωνε το αρχείο» δεν
 * χάνεται ποτέ. Ο καλών περνά το αποτέλεσμα στο `applyExternalReferencesToEntities` — τη
 * **μία** γέφυρα προς τις οντότητες, την ίδια που χρησιμοποιεί ο builder.
 *
 * @see ./dxf-external-reference-match.ts — η απόφαση «ποιο αρχείο»
 * @see ./dxf-external-reference-deps.ts — η καλωδίωση με τα πραγματικά SSoT (Storage/ids)
 * @see ../utils/dxf-external-reference-apply.ts — η προβολή στις οντότητες
 */

import type { DxfExternalReference } from '../types/dxf-external-reference';
import {
  matchExternalReferences,
  isResolvableReference,
  type ReferenceAmbiguity,
  type ReferenceMatchDeps,
} from './dxf-external-reference-match';

/** Γιατί απέτυχε η επίλυση **μιας** αναφοράς. Ονομαστικά — ποτέ σιωπηλά. */
export type ResolveFailureCode = 'unsupported-format' | 'too-large' | 'upload-failed' | 'hash-failed';

export interface ResolveReferenceFailure {
  readonly refId: string;
  readonly fileName: string;
  readonly code: ResolveFailureCode;
  readonly detail?: string;
}

export interface ResolveExternalReferencesDeps extends ReferenceMatchDeps {
  /** SHA-256 (hex) των bytes — η ταυτότητα περιεχομένου (SSoT: `foreign-asset-content-hash`). */
  readonly hashFile: (file: Blob) => Promise<string>;
  /**
   * Ανεβάζει το αρχείο **υπό την ταυτότητα του περιεχομένου του** και επιστρέφει download URL.
   * Οφείλει να είναι **idempotent**: ίδιο `contentHash` ⇒ ίδιο αντικείμενο, ποτέ δεύτερο
   * αντίγραφο. Πετά με `code` όταν η μορφή/το μέγεθος δεν γίνεται δεκτό.
   */
  readonly uploadByContent: (file: File, contentHash: string) => Promise<string>;
}

export interface ResolveExternalReferencesInput {
  readonly references: readonly DxfExternalReference[];
  /** Ό,τι έδωσε ο χρήστης: αδέλφια του `.dxf`, φάκελος, ή τα περιεχόμενα ενός `.zip`. */
  readonly files: readonly File[];
  /**
   * Ρητές επιλογές του χρήστη για διφορούμενες αναφορές (`refId → αρχείο`). Παρακάμπτουν τη
   * σκάλα ταύτισης: όταν ο άνθρωπος αποφάσισε, ο αλγόριθμος **δεν** ξαναρωτά.
   */
  readonly overrides?: ReadonlyMap<string, File>;
}

export interface ResolveExternalReferencesResult {
  /** Νέος πίνακας: οι επιλυμένες φέρουν `status:'resolved'` + `url`· οι άλλες αναλλοίωτες. */
  readonly references: DxfExternalReference[];
  readonly ambiguous: readonly ReferenceAmbiguity[];
  readonly failures: readonly ResolveReferenceFailure[];
  /** Πόσα **ξεχωριστά** αρχεία ανέβηκαν (μετά το dedup περιεχομένου). */
  readonly uploadedCount: number;
}

/** Ο κωδικός μιας αποτυχίας, όταν το σφάλμα τον κουβαλά· αλλιώς «απέτυχε το ανέβασμα». */
function failureCodeOf(error: unknown): ResolveFailureCode {
  const code = (error as { code?: unknown })?.code;
  if (code === 'format') return 'unsupported-format';
  if (code === 'size') return 'too-large';
  return 'upload-failed';
}

const detailOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Ανεβάζει **μία φορά ανά περιεχόμενο**. Το `Map` κρατά το *Promise*, όχι το αποτέλεσμα: δύο
 * αναφορές στο ίδιο αρχείο ξεκινούν **ταυτόχρονα** και θα ανέβαζαν και οι δύο αν περιμέναμε
 * να ολοκληρωθεί η πρώτη πριν καταχωρηθεί.
 */
class ContentUploader {
  private readonly inFlight = new Map<string, Promise<string>>();
  private uploads = 0;

  constructor(private readonly deps: ResolveExternalReferencesDeps) {}

  get uploadedCount(): number {
    return this.uploads;
  }

  async urlFor(file: File): Promise<string> {
    const hash = await this.deps.hashFile(file);
    const existing = this.inFlight.get(hash);
    if (existing) return existing;
    this.uploads += 1;
    const pending = this.deps.uploadByContent(file, hash);
    this.inFlight.set(hash, pending);
    return pending;
  }
}

/**
 * Επιλύει όσες αναφορές μπορεί. Ασφαλής σε επανάληψη (idempotent): οι ήδη `resolved` δεν
 * ξαναγγίζονται, και το ίδιο περιεχόμενο δεν ξανανεβαίνει.
 */
export async function resolveExternalReferences(
  input: ResolveExternalReferencesInput,
  deps: ResolveExternalReferencesDeps,
): Promise<ResolveExternalReferencesResult> {
  const { references, files, overrides } = input;

  const auto = await matchExternalReferences(references, files, deps);
  // Οι ρητές επιλογές του χρήστη γράφουν πάνω από την αυτόματη ταύτιση, και αφαιρούν την
  // αντίστοιχη αναφορά από τα «διφορούμενα»: η ερώτηση απαντήθηκε.
  const chosen = new Map<string, File>();
  for (const match of auto.matched) chosen.set(match.refId, match.file);
  if (overrides) {
    for (const [refId, file] of overrides) {
      const ref = references.find((r) => r.id === refId);
      if (ref && isResolvableReference(ref)) chosen.set(refId, file);
    }
  }
  const ambiguous = auto.ambiguous.filter((a) => !chosen.has(a.refId));

  const uploader = new ContentUploader(deps);
  const failures: ResolveReferenceFailure[] = [];
  const urlByRefId = new Map<string, string>();

  // Σειριακά και όχι `Promise.all`: δεκάδες σαρώσεις υψηλής ανάλυσης παράλληλα σημαίνουν
  // δεκάδες ταυτόχρονα ανεβάσματα σε οικιακή σύνδεση — ο χρήστης βλέπει «κόλλησε». Το dedup
  // περιεχομένου εξάλλου κάνει την παραλληλία σχεδόν άχρηστη (τα ίδια bytes ανεβαίνουν άπαξ).
  for (const [refId, file] of chosen) {
    try {
      urlByRefId.set(refId, await uploader.urlFor(file));
    } catch (error) {
      failures.push({ refId, fileName: file.name, code: failureCodeOf(error), detail: detailOf(error) });
    }
  }

  const resolved = references.map((ref) => {
    const url = urlByRefId.get(ref.id);
    return url ? { ...ref, status: 'resolved' as const, url } : ref;
  });

  return { references: resolved, ambiguous, failures, uploadedCount: uploader.uploadedCount };
}
