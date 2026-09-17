/**
 * =============================================================================
 * ΤΟ ΚΑΘΕΣΤΩΣ ΤΟΥ ΔΟΧΕΙΟΥ — «ΦΑΣΕΙΣ ISO 19650, Ή ΜΟΝΟ ΕΚΔΟΣΕΙΣ;» (ADR-862 §5.3.7)
 * =============================================================================
 *
 * **Το ερώτημα**: *«όταν ένα αρχείο δέχεται την πρώτη του πράξη, μπαίνει σε ροή φάσεων (WIP →
 * SHARED → PUBLISHED), ή αποκτά μόνο στοίβα εκδόσεων;»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🌐 Η ΠΡΑΚΤΙΚΗ (πρωτογενείς πηγές, 2026-09-17)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Procore       Company Documents = εκδόσεις χωρίς ροή· το Document Management (καταστάσεις)
 *                 ζει μόνο στο έργο — «there is no integration with the Company … Documents tools»
 *   ProjectWise   η ροή ανατίθεται ανά φάκελο· «does not have a workflow assigned … set to <none>»
 *   Autodesk ACC  κανένας χώρος εγγράφων έξω από έργο
 *   ISO 19650-1   §3.3.15 CDE «for any given project or asset»· §3.3.12 το information
 *                 container **δεν** απαιτεί status
 *
 * ⇒ **Εκδόσεις σε κάθε δοχείο· φάσεις μόνο όπου υπάρχει ομάδα με μέλη.** Εδώ «ομάδα» = έργο
 *   (ADR-862 §5.3.6 Α2). Φάση χωρίς μέλη θα έκανε το αρχείο **αόρατο σε όλους**: ο κριτής
 *   (`decideContainerAccess`) ζητά συμμετοχή σε κάθε φάση CDE.
 *
 * 🏆 **Πού ξεπερνάμε**: στο Procore είναι δύο ασύνδετα εργαλεία, στο ProjectWise ρύθμιση φακέλου που
 * αποκλίνει σιωπηλά από το περιεχόμενο. Εδώ το καθεστώς **παράγεται** από τον server μέσα στη
 * συναλλαγή του γραφέα — καμία ρύθμιση να ξεχαστεί — και αρχείο που **αργότερα** δεθεί σε έργο
 * μπαίνει στις φάσεις με την επόμενη πράξη, **χωρίς** μετανάστευση.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΠΟΤΕ ΥΠΟΒΙΒΑΣΜΟΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το καθεστώς κρίνεται **μόνο** στην είσοδο (`pre-cde`). Δοχείο ήδη σε φάση μένει σε φάσεις, ακόμη
 * κι αν σήμερα δεν λύνεται σε έργο: αφαίρεση φάσης θα άλλαζε **εκ των υστέρων** ποιος το βλέπει.
 * Γι' αυτό ο καλών (`container-custody.ts`) δεν ρωτά καν το έργο εκτός `pre-cde` και δίνει
 * {@link CDE_REGIME}.
 *
 * ✅ **ADR-866 (προσωπικά αρχεία) — ΕΓΙΝΕ (2β.3β, 2026-09-17)**: ο άνθρωπος-κάτοχος δεν έχει ομάδα ⇒
 * ίδιο `versions-only`, με **δικό του** λόγο ({@link PERSONAL_REGIME}) στην **ίδια** ένωση — όχι
 * δεύτερη κρίση, όπως ζητούσε αυτή η γραμμή. Ο γραφέας διαβάζει πλέον **και** το `files_personal`.
 *
 * ⚠️ **ΚΑΘΑΡΟ, ΧΩΡΙΣ ΔΙΣΚΟ** — ίδιο δόγμα με το `container-transition-policy.ts`.
 *
 * @module services/iso19650/container-regime-policy
 * @see services/iso19650/container-custody — ο καλών, μέσα στη συναλλαγή
 * @see lib/files/container-project — ο αναλυτής έργου
 */

import type {
  ContainerProjectAbsence,
  ContainerProjectResolution,
} from '@/lib/files/container-project';

import type { ContainerAct } from './container-transition-vocabulary';

/** Τα δύο καθεστώτα — **κλειστό σύνολο**. */
type ContainerRegimeKind = 'cde' | 'versions-only';

/**
 * **Γιατί αυτό το δοχείο δεν έχει φάσεις** — η απουσία έργου (`ContainerProjectAbsence`) **ή**
 * ο κάτοχος-άνθρωπος (ADR-866 Ε-Φ0-1).
 *
 * 🔑 **Ξεχωριστός λόγος, όχι δανεικός** (ADR-866 §2.6.10 Β2): το προσωπικό αρχείο **ήδη** έπεφτε
 * σε `versions-only`, αλλά με λόγο `'no-entity'` — γιατί το `resolveContainerProject` διαβάζει
 * `raw.companyId` και, όταν λείπει, λέει *«δεν δηλώνει οντότητα»*. Το αρχείο όμως **δηλώνει**
 * οντότητα· απλώς δεν έχει εταιρεία. Ο λόγος ταξιδεύει ως τα ίχνη, και ένα ψεύτικο όνομα θα
 * έστελνε τον επόμενο να ψάξει σπασμένη αλυσίδα που δεν υπάρχει.
 */
export type ContainerRegimeAbsence = ContainerProjectAbsence | 'personal-custody';

/**
 * Το καθεστώς ενός δοχείου — με **όνομα** για το «γιατί όχι φάσεις», ποτέ σκέτο `boolean`.
 * Ο λόγος ταξιδεύει ως τα ίχνη, ώστε «εκτός έργου» και «σπασμένη αλυσίδα» να μη μοιάζουν.
 */
export type ContainerRegime =
  | { readonly kind: 'cde' }
  | { readonly kind: 'versions-only'; readonly why: ContainerRegimeAbsence };

/** Το καθεστώς δοχείου που είναι **ήδη** σε φάση — ή λύθηκε σε έργο. */
export const CDE_REGIME: ContainerRegime = { kind: 'cde' };

/**
 * 🔑 **Το καθεστώς του ΠΡΟΣΩΠΙΚΟΥ δοχείου** — ADR-866 Ε-Φ0-1: *εκδόσεις ΝΑΙ, φάσεις CDE ΟΧΙ*.
 *
 * 🌐 Google Drive «Ο Δίσκος μου»: **Manage versions** χωρίς καμία ροή έγκρισης· Dropbox «Roll back
 * to this version»· Box Personal Pro κρατά εκδόσεις, **καμία** κατάσταση. Η ροή ISO 19650 οργανώνει
 * παράδοση **μεταξύ ομάδων εργασίας** — ο άνθρωπος-κάτοχος δεν έχει ομάδα.
 *
 * 🔴 **ΔΕΝ είναι «δεν βρέθηκε έργο»**: είναι **δομική** ιδιότητα του κατόχου, και γι' αυτό
 * κρίνεται **πριν** από κάθε ανάγνωση αλυσίδας (`container-custody.ts`). Ένα προσωπικό αρχείο
 * που *έτυχε* να λύνεται σε έργο δεν αποκτά φάσεις: ο κριτής ορατότητας (`decideContainerAccess`)
 * ζητά **μέλος έργου** σε κάθε φάση CDE ⇒ το αρχείο θα γινόταν **αόρατο στον ίδιο του τον κάτοχο**.
 */
export const PERSONAL_REGIME: ContainerRegime = { kind: 'versions-only', why: 'personal-custody' };

/**
 * **Το καθεστώς στην είσοδο** — από την ανάλυση έργου ενός `pre-cde` δοχείου.
 *
 * @example
 * regimeOfEntry({ outcome: 'none', why: 'entity-outside-projects' }); // { kind: 'versions-only', … }
 */
export function regimeOfEntry(resolution: ContainerProjectResolution): ContainerRegime {
  return resolution.outcome === 'none'
    ? { kind: 'versions-only', why: resolution.why }
    : CDE_REGIME;
}

/**
 * **Σε ποια καθεστώτα έχει νόημα κάθε πράξη** — δεδομένα, ποτέ αλυσίδα `if`.
 *
 * 🔑 `Record<ContainerAct, …>` ⇒ έκτη πράξη **δεν χτίζει** χωρίς να δηλώσει αν θέλει μέλη.
 * Μόνο η **αντικατάσταση** ζει και στα δύο: η νέα έκδοση είναι ανάγκη κάθε αρχείου, η φάση όχι.
 */
const ACT_REGIMES: Readonly<Record<ContainerAct, readonly ContainerRegimeKind[]>> = {
  share: ['cde'],
  seal: ['cde'],
  release: ['cde'],
  withdraw: ['cde'],
  supersede: ['cde', 'versions-only'],
};

/**
 * **Επιτρέπει το καθεστώς αυτή την πράξη;** — `null` ⇒ ναι· αλλιώς η **ονομασμένη** άρνηση.
 *
 * @example
 * regimeRefusal('share', { kind: 'versions-only', why: 'no-entity' }); // 'no-project'
 */
export function regimeRefusal(act: ContainerAct, regime: ContainerRegime): 'no-project' | null {
  return ACT_REGIMES[act].includes(regime.kind) ? null : 'no-project';
}
