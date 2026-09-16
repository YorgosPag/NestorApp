/**
 * =============================================================================
 * «ΒΛΕΠΕΙΣ ΚΑΝ ΑΥΤΟ ΤΟ ΔΟΧΕΙΟ;» — ο ΕΝΑΣ PEP των διαδρομών (ADR-862 Φ0 Β8)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Πριν σου δώσω ό,τι ζητάς για αυτό το αρχείο — το **βλέπεις**;»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΞΑΓΕΤΑΙ ΤΩΡΑ, ΚΑΙ ΟΧΙ ΣΤΟ Β7 ΠΟΥ ΓΕΝΝΗΘΗΚΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * Στο **Β7** αυτό το σώμα είχε **έναν** καταναλωτή (`api/files/[fileId]/cde`), και
 * ένα module με έναν καλούντα είναι αφαίρεση χωρίς λόγο. Στο **Β8** αποκτά
 * **τρεις** *(`cde` · `[fileId]/download` · `batch-download`)*.
 *
 * ⚠️ Τρίτο χειρόγραφο αντίγραφο θα ήταν ακριβώς η αστοχία που ονομάζει ο **N.18**
 * *(«κεντρικοποιείς το Α και γράφεις Β+Γ ως δίδυμα»)* — και το **CHECK 3.28** τη
 * μετρά **μέσα στο ίδιο commit**. Η εξαγωγή δεν είναι καλλωπισμός· είναι η πύλη.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΙΚΕΥΜΕΝΟ ΣΕ `R` ΚΑΙ ΟΧΙ `NextResponse`
 * ─────────────────────────────────────────────────────────────────────────────
 * **Κάθε διαδρομή κρατά το ΔΙΚΟ ΤΗΣ «όχι»** (ADR-742 §7.1): το `download` γράφει
 * σκέτο `{ error }`, το `cde` γράφει `{ success, act, refused }`. Ένα κοινό σχήμα
 * εδώ θα **πρόδιδε** τη διαφορά — ο αιτών θα μάθαινε από το **σχήμα** ότι τον
 * έκοψε ο φρουρός δοχείου και όχι το γνήσιο «δεν βρέθηκε» της διαδρομής.
 *
 * ⇒ Ο τύπος `R` κρατά αυτό το module **καθαρό από `next/server`** — ίδιο ιδίωμα με
 * το `loadOwnedDocOrRefusal` (`lib/auth/owned-doc-loader`), που το δηλώνει ρητά.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ **ΔΕΝ** ΕΙΝΑΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * **Δεν** είναι φρουρός **μισθωτή** — εκείνος είναι το `fileResource.load()`
 * (ADR-742) για ό,τι έχει `FileRecord`, και ο `judgeStorageCustody`
 * (`lib/storage/storage-path-custody`) για ωμά μονοπάτια. Καλείται **μετά**, ποτέ
 * αντί.
 *
 * **Δεν** διαβάζει το έγγραφο: το `raw` έρχεται από τον καλούντα, που το έχει ήδη
 * στο χέρι από το `load()`. Δεύτερο `get()` θα πρόσθετε κόστος **και** ένα
 * παράθυρο όπου τα δύο διαβάσματα διαφωνούν.
 *
 * @module lib/auth/container-visibility-guard
 * @see lib/auth/container-access — ο κριτής (Β5)
 * @see lib/auth/container-subject — ο καλών του κριτή (Β7)
 * @see lib/files/file-record-read — ο θεματοφύλακας (Β1)
 */

import 'server-only';

import { containerFactsOf, readFileRecord } from '@/lib/files/file-record-read';
import { isContainerVisible } from '@/types/container-access';

import { decideContainerAccess } from './container-access';
import { containerSubjectFor } from './container-subject';
import type { ProjectMemberRead } from './project-member-read';
import type { AuthContext, PermissionId } from './types';

// =============================================================================
// ΤΟ ΕΡΩΤΗΜΑ
// =============================================================================

/**
 * @typeParam R Ό,τι απαντά η διαδρομή στο «όχι» — συνήθως `NextResponse`. Αυτό το
 *   module δεν το γνωρίζει, και γι' αυτό μένει καθαρό από `next/server`.
 */
export interface ContainerVisibilityQuery<R> {
  readonly fileId: string;
  /** Η **ήδη επαληθευμένη** ταυτότητα (`withAuth`). */
  readonly caller: AuthContext;
  /**
   * 🔑 **Η ικανότητα της ΣΥΓΚΕΚΡΙΜΕΝΗΣ πράξης** — ποτέ καρφωμένο «δες».
   *
   * Ο κριτής κλείνει με τον `decideCapability` (ADR-801), οπότε ένα γενικό όνομα
   * εδώ θα έκρινε **άλλη** εξουσιοδότηση από αυτή που πρόκειται να ασκηθεί: η
   * λήψη ρωτά `dxf:files:view`, η σφράγιση `iso19650:containers:seal`.
   */
  readonly action: PermissionId;
  /**
   * Το έγγραφο **όπως βγήκε από τη βάση** (`owned.doc.data`), ποτέ στενεμένο.
   * ⛔ **ΜΗΝ** περάσεις εδώ αντικείμενο που έφτιαξες από σώμα αιτήματος.
   */
  readonly raw: unknown;
  /**
   * Το «δεν βρέθηκε» **της διαδρομής**, με **μηδέν ορίσματα**.
   *
   * ⚠️ Καλείται **και** για το `unreadable` **και** για την άρνηση ορατότητας: δεν
   * υπάρχει τιμή που να τα διαφοροποιεί, άρα ο αιτών δεν μπορεί να χρησιμοποιήσει
   * τη διαδρομή ως **μαντείο ύπαρξης** (ADR-742 §7.1).
   */
  readonly notFound: () => R;
  /**
   * 🔴 **Η αυθεντία δεν απάντησε** — ποτέ «δεν επιτρέπεσαι».
   *
   * *Άγνωστο ≠ κενό* (N.12). Ένα 403/404 εδώ θα έλεγε στον μηχανικό «δεν
   * συμμετέχεις σε αυτή την υπόθεση» επειδή **έπεσε το δίκτυο**, και θα τον
   * έστελνε να ζητήσει δικαιώματα που **έχει**.
   */
  readonly unavailable: () => R;
  /**
   * Ανά-**αίτημα** απομνημόνευση της αναζήτησης μέλους.
   *
   * 🔑 **Το batch το χρειάζεται ζωτικά**: 50 αρχεία της ίδιας υπόθεσης ⇒ **μία**
   * ανάγνωση μέλους αντί για 50. Χωρίς αυτό, ο φρουρός θα ήταν σωστός και
   * **απαγορευτικά ακριβός** — δηλαδή ο επόμενος θα τον παρέκαμπτε «για ταχύτητα».
   */
  readonly cache?: Map<string, ProjectMemberRead>;
}

// =============================================================================
// Ο PEP
// =============================================================================

/**
 * **Το «όχι» της διαδρομής, ή `null` αν βλέπει.**
 *
 * 🔑 Επιστρέφει **την άρνηση**, όχι `boolean`: ο καλών γράφει
 * `const refusal = await …; if (refusal) return refusal;` και **δεν μπορεί** να
 * ξεχάσει να απαντήσει — η τιμή *είναι* η απάντηση.
 *
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**:
 *   1. **ακατάληπτο έγγραφο** ⇒ «δεν βρέθηκε» *(fail-closed, πριν από κάθε άλλο)*
 *   2. **η αυθεντία δεν απάντησε** ⇒ «ξαναδοκίμασε» *(ποτέ άρνηση)*
 *   3. **ο κριτής** ⇒ ορατό, ή «δεν βρέθηκε»
 *
 * @example
 * const refusal = await containerVisibilityRefusal({
 *   fileId, caller: ctx, action: 'dxf:files:view',
 *   raw: owned.doc.data, notFound: fileNotFoundResponse, unavailable: authorityUnavailable,
 * });
 * if (refusal) return refusal;
 */
export async function containerVisibilityRefusal<R>(
  query: ContainerVisibilityQuery<R>,
): Promise<R | null> {
  const { fileId, caller, action, raw, notFound, unavailable, cache } = query;

  const read = readFileRecord(raw, fileId);
  if (read.outcome === 'unreadable') return notFound();

  const built = await containerSubjectFor({
    caller,
    // 🔑 Η υπόθεση έρχεται από το **έγγραφο**, ποτέ από το σώμα του αιτήματος —
    //    αλλιώς ο αιτών θα διάλεγε **σε ποια υπόθεση** είναι μέλος.
    projectId: read.record.projectId,
    ...(cache === undefined ? {} : { cache }),
  });
  if (built.outcome === 'unknown') return unavailable();

  const decision = decideContainerAccess({
    subject: built.subject,
    facts: containerFactsOf(read.record, read.state),
    action,
  });

  return isContainerVisible(decision.verdict) ? null : notFound();
}
