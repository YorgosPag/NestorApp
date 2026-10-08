/**
 * =============================================================================
 * 🧬 Η ΚΛΗΡΟΝΟΜΙΑ ΤΗΣ ΔΙΑΔΟΧΗΣ — ό,τι ίσχυε για την παλιά έκδοση **συνεχίζει** στη νέα (ADR-845 §7.17 Α3γ)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Τι παίρνει μαζί της η νέα έκδοση, πέρα από τη θέση της;»*
 *
 * | τι | πού ζει | ποιος το αποφασίζει |
 * |---|---|---|
 * | η **διαβάθμιση** | στο αρχείο | `inheritedClassificationOf` (ο ΕΝΑΣ τόπος της διαβάθμισης) |
 * | οι **δηλώσεις** του γραφείου *(σειρά · κατόψεις · εστίαση · σημείο λήψης · βορράς)* | στο **ακίνητο**, με το id της έκδοσης | `repointDeclarations` (καθαρή, `lib/listings`) |
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ως την Α3γ η αντικατάσταση δημόσιας φωτογραφίας την **κατέβαζε από την αγγελία**, ακόμη και από
 * όποιον είχε δικαίωμα δημοσίευσης: ο διάδοχος γεννιόταν αδιαβάθμητος, και το ακίνητο εξακολουθούσε
 * να δείχνει στο **αρχειοθετημένο** id. Ξανασήμανση με το χέρι ⇒ τελευταία στη σειρά, χωρίς εστίαση.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΑΤΟΜΙΚΟΤΗΤΑ: ΤΡΙΑ ΕΓΓΡΑΦΑ, **ΜΙΑ** ΣΥΝΑΛΛΑΓΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Παλιά έκδοση *(αρχειοθέτηση)* · νέα έκδοση *(διαβάθμιση)* · ακίνητο *(δηλώσεις)* γράφονται **μαζί ή
 * καθόλου**. Σε δύο βήματα θα υπήρχε στιγμή όπου η αγγελία ξαναπροβάλλεται με τη νέα φωτογραφία
 * **τελευταία** — δηλαδή το εξώφυλλο θα άλλαζε για λίγο, μπροστά στο κοινό.
 *
 * ⚠️ Το ακίνητο γράφεται με τη **ΜΙΑ** σφραγίδα έκδοσης (`versionedWrite`): browser που κρατά παλιά
 * εικόνα της σειράς παίρνει τη γνωστή σύγκρουση `_v` αντί να **πατήσει** τη μεταφορά.
 *
 * ⛔ **Δεν είναι «επεξεργασία ακινήτου»** και δεν ζητά το δικαίωμά της: αλλάζει **μόνο** ποια έκδοση
 * εννοεί κάθε δήλωση — ποτέ τη σειρά, την εστίαση ή το ποιες κατόψεις φεύγουν. Αυτά τα αποφασίζει
 * μόνο ο άνθρωπος, από την πόρτα του ακινήτου.
 *
 * @module services/iso19650/succession-inheritance
 * @see services/iso19650/container-transitions — ο ΕΝΑΣ γραφέας που την καλεί
 * @see lib/listings/declaration-succession — η καθαρή μεταφορά + η κλειστή λίστα δηλώσεων
 */

import 'server-only';

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { ENTITY_TYPES, type FileClassification } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { versionedWrite } from '@/lib/firestore/version-check';
import { repointDeclarations } from '@/lib/listings/declaration-succession';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { EntityAuditService } from '@/services/entity-audit.service';
import {
  inheritedClassificationOf,
  recordInheritedClassification,
} from '@/services/file-record/file-classification.service';
import { AGENCY_ENTITY_TYPE } from '@/services/listings/agency-media-publication';

import type { ContainerActor } from './container-transition-vocabulary';

/** Οι δηλώσεις του ακινήτου που μεταφέρονται — έτοιμες για **μία** `update()`. */
interface PropertyCarry {
  readonly ref: DocumentReference;
  readonly propertyId: string;
  readonly propertyName: string | null;
  readonly companyId: string;
  /** Τα πεδία που άλλαξαν — για το ιστορικό. */
  readonly fields: readonly string[];
  /** Δηλώσεις **και** σφραγίδα έκδοσης. */
  readonly data: Readonly<Record<string, unknown>>;
}

/** **Τι κληρονομείται** σε αυτή τη διαδοχή — υπολογισμένο από αναγνώσεις, πριν από κάθε εγγραφή. */
export interface InheritancePlan {
  readonly predecessorId: string;
  readonly successorId: string;
  readonly classification: FileClassification | null;
  readonly property: PropertyCarry | null;
}

export interface InheritanceQuery {
  readonly predecessor: Readonly<Record<string, unknown>>;
  readonly predecessorId: string;
  /** Η εγγραφή του διαδόχου που **κρίθηκε** — η γέννηση, ή το αποθηκευμένο έγγραφο. */
  readonly successor: Readonly<Record<string, unknown>> | null;
  readonly successorId: string;
  readonly actor: ContainerActor;
}

function nothingInherited(query: InheritanceQuery): InheritancePlan {
  return { predecessorId: query.predecessorId, successorId: query.successorId, classification: null, property: null };
}

/**
 * Το ακίνητο του προκατόχου — **μόνο** αν είναι αρχείο ακινήτου του **ίδιου** μισθωτή και το ακίνητο
 * αναφέρει πράγματι την παλιά έκδοση. Κάθε άλλη απάντηση ⇒ `null` ⇒ το ακίνητο **δεν αγγίζεται**.
 */
async function propertyCarryOf(
  transaction: Transaction,
  db: Firestore,
  query: InheritanceQuery,
  companyId: string,
): Promise<PropertyCarry | null> {
  const { entityType, entityId } = query.predecessor;
  if (entityType !== AGENCY_ENTITY_TYPE || typeof entityId !== 'string' || entityId === '') return null;

  const ref = db.collection(COLLECTIONS.PROPERTIES).doc(entityId);
  const snapshot = await transaction.get(ref);
  if (!snapshot.exists) return null;
  const property = (snapshot.data() ?? {}) as Record<string, unknown>;
  // 🔒 Ξένος μισθωτής = ανύπαρκτο: `entityId` πάνω σε αρχείο είναι **ισχυρισμός**, όχι απόδειξη.
  if (property.companyId !== companyId) return null;

  const patch = repointDeclarations(property, query.predecessorId, query.successorId);
  if (patch === null) return null;
  return {
    ref,
    propertyId: entityId,
    propertyName: typeof property.name === 'string' ? property.name : null,
    companyId,
    fields: Object.keys(patch),
    data: versionedWrite(property, patch, query.actor.uid).data,
  };
}

/**
 * **Η ανάγνωση** — μέσα στη συναλλαγή της διαδοχής, **πριν** από κάθε εγγραφή της.
 *
 * 🔑 **Μόνο στον εταιρικό χώρο**: ο προσωπικός φάκελος δεν έχει αγγελία γραφείου ούτε διαβάθμιση
 * που βλέπει τρίτος ⇒ δεν υπάρχει τίποτα να κληρονομηθεί.
 */
export async function planInheritance(
  transaction: Transaction,
  db: Firestore,
  query: InheritanceQuery,
): Promise<InheritancePlan> {
  const { companyId } = query.actor.custody;
  if (companyId === undefined) return nothingInherited(query);

  return {
    predecessorId: query.predecessorId,
    successorId: query.successorId,
    classification: inheritedClassificationOf(query.predecessor, query.successor)?.classification ?? null,
    property: await propertyCarryOf(transaction, db, query, companyId),
  };
}

/** Ο διάδοχος, όπως θα γραφτεί: **γεννιέται** εδώ (`birth`) ή υπάρχει ήδη. */
export interface SuccessorWrite {
  readonly ref: DocumentReference;
  /** Η εγγραφή γέννησης — `null` όταν ο διάδοχος υπάρχει ήδη ως FileRecord. */
  readonly birth: Readonly<Record<string, unknown>> | null;
  /** Ό,τι σφραγίστηκε στην είσοδο στο CDE· ό,τι δηλώνει **ήδη** η γέννηση το νικά. */
  readonly custody: Readonly<Record<string, unknown>>;
}

/**
 * **Οι εγγραφές** — διάδοχος και ακίνητο, στην **ίδια** συναλλαγή με την αρχειοθέτηση του προκατόχου.
 *
 * 🔑 Η γέννηση και η κληρονομημένη διαβάθμιση είναι **μία** `set()`: διάδοχος που γεννιέται δημόσιος
 * δεν περνά ποτέ από στιγμή «αδιαβάθμητος».
 */
export function writeInheritance(
  transaction: Transaction,
  plan: InheritancePlan,
  successor: SuccessorWrite,
): void {
  const inherited = plan.classification === null ? {} : { classification: plan.classification };

  if (successor.birth !== null) {
    transaction.set(successor.ref, { ...successor.custody, ...successor.birth, ...inherited });
  } else if (plan.classification !== null) {
    transaction.update(successor.ref, { ...inherited, updatedAt: nowISO() });
  }
  if (plan.property !== null) transaction.update(plan.property.ref, { ...plan.property.data });
}

/**
 * **Το ίχνος** — μετά το commit, μη-μπλοκάρον (ίδιο δόγμα με το `recordTrace` του γραφέα: το σώμα της
 * συναλλαγής ξαναεκτελείται σε σύγκρουση, και η αποτυχία του ίχνους δεν ακυρώνει πράξη που έγινε).
 *
 * | γραμμή | βιβλίο | λέει |
 * |---|---|---|
 * | `classify` + `inheritedFrom` | του **νέου** αρχείου | γιατί είναι δημόσιο χωρίς δική του πράξη διαβάθμισης |
 * | `updated` | του **ακινήτου** | ποιες δηλώσεις πέρασαν στη νέα έκδοση |
 */
export function traceInheritance(plan: InheritancePlan, actor: ContainerActor): void {
  const { companyId } = actor.custody;
  if (companyId === undefined) return;
  const context = { predecessorId: plan.predecessorId, successorId: plan.successorId };

  if (plan.classification !== null) {
    safeFireAndForget(
      recordInheritedClassification({
        fileId: plan.successorId,
        inheritedFrom: plan.predecessorId,
        classification: plan.classification,
        performedBy: actor.uid,
        companyId,
      }),
      'SuccessionInheritance.classification',
      context,
    );
  }
  if (plan.property !== null) {
    safeFireAndForget(recordDeclarationCarry(plan, plan.property, actor.uid), 'SuccessionInheritance.declarations', context);
  }
}

/** Η γραμμή ιστορικού του **ακινήτου**: ποια δήλωση, από ποια έκδοση, σε ποια. */
function recordDeclarationCarry(plan: InheritancePlan, carry: PropertyCarry, performedBy: string): Promise<string | null> {
  return EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: carry.propertyId,
    entityName: carry.propertyName,
    action: 'updated',
    changes: carry.fields.map((field) => ({ field, oldValue: plan.predecessorId, newValue: plan.successorId })),
    performedBy,
    performedByName: null,
    companyId: carry.companyId,
  });
}
