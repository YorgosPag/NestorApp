/**
 * @fileoverview **Η ΔΙΑΒΑΘΜΙΣΗ ΕΙΝΑΙ ΠΡΑΞΗ, ΟΧΙ ΠΕΔΙΟ** — ο ΕΝΑΣ γραφέας του `classification`.
 * @related ADR-845 §7.17 (κλάση Ο-35) · ADR-862 Φ0 Β4/Β6 (το πρότυπο) · ADR-801 (ο ΕΝΑΣ κριτής)
 * @module services/file-record/file-classification.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ 2026-10-08
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `classification: 'public'` είναι ο **φρουρός #1** της δημοσίευσης
 * *(`isPubliclyClassified`, `agency-media-publication`)*: ό,τι το φέρει, **φεύγει στο κοινό**.
 * Ως σήμερα το έγραφε ο **browser** με σκέτο `updateDoc`:
 *
 * 1. φωτογραφία που έγινε `internal` **έμενε** στο `public_listings.gallery`, με το `.webp` της
 *    να απαντά **200** στο δημόσιο ράφι — καμία επαναπροβολή δεν έτρεχε·
 * 2. το σκέλος LINK/UNLINK των κανόνων το δεχόταν από **κάθε μέλος** της εταιρείας, χωρίς ρόλο·
 * 3. **καμία** γραμμή ίχνους: κανείς δεν μπορούσε να πει ποιος δημοσιοποίησε τι.
 *
 * ⇒ Ίδια θεραπεία με το `cdeState` *(ADR-862 Φ0)*: ο πελάτης **ζητά**, ο διακομιστής **κρίνει,
 * γράφει και καταγράφει**· οι κανόνες παγώνουν το πεδίο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΟΙΟΣ ΕΠΙΤΡΕΠΕΤΑΙ — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ **ΑΣΥΜΜΕΤΡΟ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | μετάβαση | ποιος |
 * |---|---|
 * | `internal ⇄ confidential` *(δεν αγγίζει το κοινό)* | κάθε μέλος του μισθωτή — όπως πάντα |
 * | **προς** ή **από** `public` | `listings:listings:publish`, από τον ΕΝΑ κριτή |
 *
 * ⚠️ **Και η ΑΠΟΣΥΡΣΗ θέλει το δικαίωμα**, όχι μόνο η δημοσίευση: η αγγελία είναι η βιτρίνα του
 * γραφείου, και ένα μέλος χωρίς δικαίωμα δημοσίευσης που «κατεβάζει» τις φωτογραφίες της την
 * αδειάζει εξίσου. Η δημοσίευση ορίζει **τι βλέπει ο κόσμος**· το ορίζει όποιος έχει την ευθύνη της.
 *
 * ⛔ **Καμία λίστα ρόλων εδώ** (CHECK 3.68) — ρωτιέται ο `decideCapability`.
 */

import 'server-only';

import type { DocumentReference } from 'firebase-admin/firestore';

import { FILE_CLASSIFICATIONS, type FileClassification } from '@/config/domain-constants';
import { decideCapability } from '@/lib/auth/authority';
import { nowISO } from '@/lib/date-local';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import type { FileBatchActResponse } from '@/services/file-record/file-batch-act.types';
import { isGranted, type CapabilitySubject } from '@/types/capability-authority';

/**
 * **Η απάντηση της πόρτας στο σύρμα** — ο κοινός φάκελος κάθε μαζικής πράξης αρχείων
 * *(`file-batch-act.types`)*. Το όνομα μένει ώστε η πύλη του πελάτη να μη χρειαστεί αλλαγή.
 */
export type FileClassificationResponse = FileBatchActResponse;

/** Το δικαίωμα που ορίζει **τι βλέπει ο κόσμος** — το ίδιο που διαχειρίζεται την αγγελία (ADR-884 Φ0.3). */
const PUBLICATION_CAPABILITY = 'listings:listings:publish' as const;

/** Οι τιμές του λεξιλογίου, **ρωτημένες** — ποτέ δεύτερη λίστα. */
const KNOWN_CLASSIFICATIONS: readonly string[] = Object.values(FILE_CLASSIFICATIONS);

/** Στενεύει `unknown → FileClassification` — η πόρτα δεν εμπιστεύεται το σώμα του αιτήματος. */
export function isFileClassification(value: unknown): value is FileClassification {
  return typeof value === 'string' && KNOWN_CLASSIFICATIONS.includes(value);
}

/** Ο αιτών: ταυτότητα για το ίχνος, και η όψη ρόλου για τον κριτή. */
export interface ClassificationActor {
  readonly uid: string;
  readonly companyId: string;
  readonly capability: CapabilitySubject;
}

/**
 * **Τι έγινε** — ονομασμένα, ποτέ boolean *(ADR-844 §1)*.
 *
 * 🔑 Το `unchanged` είναι **δηλωμένη** απάντηση: δεύτερο κλικ στην ίδια τιμή δεν γράφει, δεν
 * καταγράφει και **δεν** ξαναπροβάλλει αγγελία (N.7.2 #3).
 */
export type ClassificationOutcome =
  | { readonly kind: 'changed'; readonly from: FileClassification | null }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly why: 'not-capable' };

/** Η αποθηκευμένη τιμή, ή `null` όταν λείπει / είναι εκτός λεξιλογίου *(= «δεν έχει διαβαθμιστεί»)*. */
function storedClassification(data: Readonly<Record<string, unknown>>): FileClassification | null {
  return isFileClassification(data.classification) ? data.classification : null;
}

/**
 * **Αγγίζει αυτή η μετάβαση το κοινό;** — καθαρή, ώστε η ασυμμετρία να δοκιμάζεται χωρίς βάση.
 *
 * ⚠️ **`||`, όχι μόνο ο στόχος**: δες την κεφαλή — η απόσυρση είναι εξίσου πράξη δημοσίευσης.
 */
export function touchesPublication(
  from: FileClassification | null,
  to: FileClassification,
): boolean {
  return from === FILE_CLASSIFICATIONS.PUBLIC || to === FILE_CLASSIFICATIONS.PUBLIC;
}

/**
 * **Μπορεί αυτός ο άνθρωπος να αλλάξει τι βλέπει ο κόσμος;** — ο ΕΝΑΣ τόπος της απάντησης.
 *
 * 🔑 Τον ρωτά **κάθε** πράξη που ανεβάζει ή **κατεβάζει** δημοσιευμένο υλικό: διαβάθμιση (εδώ) ·
 * κάδος και επαναφορά (`file-trash.service`) · αρχειοθέτηση. Αλλιώς το λουκέτο της διαβάθμισης
 * παρακάμπτεται με **βαρύτερη** πράξη *(πρακτική Contentful: για να διαγράψεις ή να
 * αρχειοθετήσεις **δημοσιευμένο** περιεχόμενο χρειάζεσαι το δικαίωμα δημοσίευσης)*.
 */
export function mayChangePublication(subject: CapabilitySubject): boolean {
  return isGranted(decideCapability({ subject, action: PUBLICATION_CAPABILITY }).verdict);
}

/**
 * 🧬 **Ποια διαβάθμιση ΚΛΗΡΟΝΟΜΕΙ η νέα έκδοση;** (ADR-845 §7.17 Α3γ) — καθαρή.
 *
 * Η αντικατάσταση δεν είναι αλλαγή διαβάθμισης: είναι **το ίδιο αρχείο, νέα έκδοση**. Άρα ο διάδοχος
 * συνεχίζει ό,τι ίσχυε — δημόσια φωτογραφία **μένει** στην αγγελία, και εμπιστευτικό έγγραφο **δεν**
 * γίνεται αδιαβάθμητο επειδή ήρθε νέα έκδοσή του.
 *
 * 🔑 **Ό,τι δηλώνει ήδη ο διάδοχος ΝΙΚΑ** (δόγμα του γραφέα διαδοχής): ρητή διαβάθμιση του ανθρώπου
 * πάνω στη νέα έκδοση δεν ξαναγράφεται ποτέ από κληρονομιά.
 *
 * ⚠️ **Το δικαίωμα ΔΕΝ κρίνεται εδώ**: για δημόσιο προκάτοχο το έχει ήδη κρίνει η κρίση διαδοχής
 * *(`publication-not-capable`, Α3β)* — πριν φτάσει κανείς ως εδώ.
 *
 * @returns τα πεδία προς εγγραφή στον διάδοχο, ή `null` όταν δεν κληρονομείται τίποτα.
 */
export function inheritedClassificationOf(
  predecessor: Readonly<Record<string, unknown>>,
  successor: Readonly<Record<string, unknown>> | null,
): { readonly classification: FileClassification } | null {
  const inherited = storedClassification(predecessor);
  if (inherited === null) return null;
  if (successor !== null && storedClassification(successor) !== null) return null;
  return { classification: inherited };
}

/**
 * **Το ίχνος της κληρονομημένης διαβάθμισης** — ίδια ενέργεια `classify`, με την προέλευση ονομασμένη.
 *
 * Το *«ποιος δημοσιοποίησε τι»* πρέπει να απαντιέται **και** για τη νέα έκδοση: χωρίς αυτή τη γραμμή
 * ένα αρχείο θα ήταν δημόσιο χωρίς **καμία** πράξη στο βιβλίο του. Δεν πετά ποτέ (`recordFileAudit`).
 */
export async function recordInheritedClassification(params: {
  readonly fileId: string;
  readonly inheritedFrom: string;
  readonly classification: FileClassification;
  readonly performedBy: string;
  readonly companyId: string;
}): Promise<void> {
  await recordFileAudit({
    fileId: params.fileId,
    action: 'classify',
    performedBy: params.performedBy,
    companyId: params.companyId,
    metadata: { from: null, to: params.classification, inheritedFrom: params.inheritedFrom },
  });
}

export interface WriteClassificationParams {
  readonly fileId: string;
  /** Το έγγραφο, **ήδη φορτωμένο και κριμένο ως δικό του** από τον PEP της διαδρομής (ADR-742). */
  readonly ref: DocumentReference;
  readonly data: Readonly<Record<string, unknown>>;
  readonly classification: FileClassification;
  readonly actor: ClassificationActor;
}

/**
 * **Γράψε τη διαβάθμιση ενός αρχείου** — κρίση, γραφή, ίχνος.
 *
 * ⛔ **ΔΕΝ ξαναπροβάλλει αγγελία.** Αυτό το κάνει ο **καλών**, μία φορά ανά ακίνητο για όλη τη
 * δέσμη *(`refreshListingsAfterFileChanges`)*: μια επαναπροβολή εδώ θα έψηνε την ίδια αγγελία
 * τόσες φορές όσα και τα αρχεία της μαζικής σήμανσης.
 *
 * ⚠️ **Το ίχνος είναι awaited** — σε αντίθεση με τον κάδο του πελάτη: το *«ποιος δημοσιοποίησε
 * τι»* είναι ο λόγος ύπαρξης αυτής της πράξης. Ο `recordFileAudit` δεν πετά ποτέ, άρα η αναμονή
 * δεν μπορεί να ακυρώσει γραφή που έγινε.
 */
export async function writeFileClassification(
  params: WriteClassificationParams,
): Promise<ClassificationOutcome> {
  const { fileId, ref, data, classification, actor } = params;
  const from = storedClassification(data);

  if (from === classification) return { kind: 'unchanged' };

  if (touchesPublication(from, classification) && !mayChangePublication(actor.capability)) {
    return { kind: 'refused', why: 'not-capable' };
  }

  await ref.update({ classification, updatedAt: nowISO() });

  await recordFileAudit({
    fileId,
    action: 'classify',
    performedBy: actor.uid,
    companyId: actor.companyId,
    metadata: { from, to: classification },
  });

  return { kind: 'changed', from };
}
