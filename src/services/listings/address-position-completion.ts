/**
 * **Η ΘΕΣΗ ΠΟΥ ΔΕΝ ΠΡΟΛΑΒΕ ΤΗΝ ΑΠΟΘΗΚΕΥΣΗ, ΓΡΑΦΕΤΑΙ ΜΕΤΑ** — ADR-332 D29.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Ο γραφέας θέσης δουλεύει με **προθεσμία** (Ζ5): όταν ο πάροχος αργεί, η διεύθυνση γράφεται
 * χωρίς νέα θέση και ονομάζεται `budget-exhausted`. Στις επαφές αυτό αρκεί — ο πελάτης ξαναρωτά.
 * Στα έργα και στα κτίρια όμως **κανείς δεν ξαναρωτούσε**: η θέση θα έμενε κενή (ή, χειρότερα, της
 * *προηγούμενης* διεύθυνσης) ως την επόμενη χειροκίνητη αποθήκευση, και κάθε αγγελία μαζί της.
 *
 * 🏆 **Πρακτική**: Salesforce Data Integration Rules — η αποθήκευση επιστρέφει αμέσως, οι
 * συντεταγμένες γράφονται ασύγχρονα. **Το βήμα πέρα από αυτήν**: δεν υπάρχει δεύτερο αίτημα προς
 * τον πάροχο. Η κλήση που ξεπέρασε την προθεσμία **συνεχίζει** και γεμίζει τη μνήμη της μηχανής·
 * εδώ απλώς **περιμένουμε την ίδια απάντηση** (κοινή υπόσχεση / μνήμη βαθμίδας) και τη γράφουμε.
 *
 * 🔑 **Ιδεμποτικό και χωρίς αγώνα με τον άνθρωπο.** Η γραφή γίνεται σε συναλλαγή και **μόνο αν**
 * η διεύθυνση είναι ακόμη αυτή που ρωτήθηκε: αν στο μεταξύ άλλαξε το κείμενο ή σύρθηκε η πινέζα,
 * η απάντηση αφορά κάτι που δεν υπάρχει πια και **πετιέται** — την επόμενη κρίση την κάνει η
 * επόμενη αποθήκευση. Δεύτερη εκτέλεση δεν βρίσκει τίποτα να αλλάξει.
 *
 * 🔑 **Η έκδοση (`_v`) ΔΕΝ ανεβαίνει — επίτηδες, και για τα κτίρια.** Το `_v` προστατεύει
 * **ανθρώπινες** αλλαγές από χαμένη ενημέρωση. Αυτή η γραφή δεν μπορεί να πατήσει ανθρώπινη αλλαγή
 * (ο κανόνας από πάνω), ενώ αν ανέβαζε `_v` η επόμενη αποθήκευση του ανθρώπου θα έπαιρνε **409 για
 * αλλαγή που δεν έκανε κανείς άνθρωπος**. Αν ο πελάτης στείλει αργότερα το παλιό του αντίγραφο, ο
 * γραφέας θέσης απλώς ξαναρωτά — και η απάντηση είναι ήδη στη μνήμη της μηχανής.
 *
 * ⚠️ **«Δεν μπόρεσα να ρωτήσω» ⇒ καμία γραφή.** Ίδιος κανόνας με όλο το module: η άγνοια δεν
 * σβήνει ούτε γράφει θέση.
 *
 * 📜 **Κάθε γραφή αφήνει γραμμή ιστορικού** (ADR-195), με ταυτότητα **μηχανής**. ⚠️ Το CHECK 3.17
 * **δεν** θα το απαιτούσε: αποδίδει μια γραφή σε συλλογή μόνο από κοντινό `COLLECTIONS.X`, και εδώ
 * η συλλογή είναι **μεταβλητή** — πράσινο που σημαίνει «δεν κοίταξα». Η γραμμή υπάρχει επειδή ένα
 * έγγραφο που αλλάζει χωρίς άνθρωπο πρέπει να λέει **ποιος** το άλλαξε, όχι επειδή το ζητά πύλη.
 *
 * @module services/listings/address-position-completion
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { ADDRESS_COLLECTION_DEF } from '@/config/audit-tracked-fields';
import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { diffTrackedFields } from '@/lib/audit/audit-diff';
import { addressIdentityChanged } from '@/lib/geocoding/address-position';
import { pointChanged } from '@/lib/geocoding/address-position-rules';
import { EntityAuditService } from '@/services/entity-audit.service';
import { storedPositionSignature, withStoredAddressPosition } from '@/utils/address/stored-address-position';
import type { StoredAddressPosition } from '@/types/address-position';
import type { AuditEntityType, AuditFieldChange } from '@/types/audit-trail';
import { resolveProjectAddressPositions, type ProjectAddressLike } from './address-place-writeback';

const logger = createModuleLogger('AddressPositionCompletion');

/** Το πεδίο του εγγράφου που φέρει τις διευθύνσεις — και το όνομά του στο ιστορικό. */
const ADDRESSES_FIELD = 'addresses';

export interface PendingAddressPositions {
  /** Η συλλογή του εγγράφου που φέρει `addresses[]`. */
  readonly collection: string;
  readonly docId: string;
  /** Ο τύπος της οντότητας στο ιστορικό (ADR-195) — η γραμμή γράφεται στο **δικό της** χρονολόγιο. */
  readonly entityType: AuditEntityType;
  /** Οι διευθύνσεις που η αποθήκευση άφησε εκκρεμείς (`budget-exhausted`). */
  readonly pendingIds: readonly string[];
  /**
   * Όσες από τις εκκρεμείς ήταν **ρητή** «μετακίνησε την πινέζα στη διεύθυνση» (Φ2β).
   *
   * 🔴 Χωρίς αυτό η μετακίνηση που έληξε η προθεσμία της **δεν ολοκληρωνόταν ποτέ**: η αποθηκευμένη
   * πινέζα είναι ανθρώπου, ο γραφέας την κρίνει `human-pinned` και δεν ρωτά τη μηχανή — δηλαδή ο
   * άνθρωπος πάτησε «Μετακίνησε», είδε επιτυχία, και η πινέζα έμεινε εκεί που ήταν.
   */
  readonly relocateIds?: readonly string[];
  /**
   * Πεδία του εγγράφου που **παράγονται** από τις διευθύνσεις και γράφονται στην **ίδια** συναλλαγή
   * (κτίριο: `latitude`/`longitude` της κύριας). Δεύτερη γραφή θα άφηνε παράθυρο όπου τα δύο διαφωνούν.
   */
  readonly derive?: (addresses: readonly ProjectAddressLike[]) => Record<string, unknown>;
}

export interface AddressPositionCompletion {
  /** Πόσες διευθύνσεις απέκτησαν (ή έχασαν) θέση. `0` ⇒ καμία γραφή. */
  readonly written: number;
}

/** Μια εκκρεμής διεύθυνση όπως **ρωτήθηκε**, και η απόφαση του γραφέα γι' αυτήν. */
interface Decision {
  readonly asked: ProjectAddressLike;
  readonly decided: ProjectAddressLike;
}

/** Ό,τι έγραψε η συναλλαγή — αρκετό για να ειπωθεί στο ιστορικό, χωρίς δεύτερη ανάγνωση. */
interface Written {
  /** Πόσες διευθύνσεις άλλαξαν θέση στο έγγραφο. */
  readonly moved: number;
  readonly changes: AuditFieldChange[];
  readonly entityName: string | null;
  readonly companyId: string | null;
}

function readAddresses(data: FirebaseFirestore.DocumentData | undefined): ProjectAddressLike[] {
  return Array.isArray(data?.[ADDRESSES_FIELD]) ? (data[ADDRESSES_FIELD] as ProjectAddressLike[]) : [];
}

function readText(data: FirebaseFirestore.DocumentData, field: string): string | null {
  const value: unknown = data[field];
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Ρωτά τον **ίδιο** γραφέα θέσης για κάθε εκκρεμή διεύθυνση — χωρίς προθεσμία: ο άνθρωπος έχει
 * ήδη πάρει την απάντησή του. Σειριακά, όπως πάντα (1 αίτημα/δευτ.).
 */
async function decide(
  targets: readonly ProjectAddressLike[],
  relocateIds: ReadonlySet<string>,
): Promise<Map<string, Decision>> {
  const decisions = new Map<string, Decision>();
  for (const asked of targets) {
    if (!asked.id) continue;
    // Η ρητή μετακίνηση ταξιδεύει ως **δήλωση**, όπως στην αποθήκευση, και η διεύθυνση δίνεται ΚΑΙ ως
    // αποθηκευμένη: μόνο έτσι ο γραφέας βλέπει «τίποτα δεν άλλαξε, αλλά ζητήθηκε μετακίνηση» (κανόνας
    // 1β). Χωρίς αποθηκευμένη, η συρμένη πινέζα κρίνεται «νέα ανθρώπινη τοποθέτηση» (κανόνας 1) και η
    // μηχανή δεν ρωτιέται ποτέ. Για τις υπόλοιπες εκκρεμείς ισχύει το αντίθετο: με αποθηκευμένη θα
    // κρίνονταν `unchanged` — γι' αυτό ρωτιούνται ως νέες.
    const relocate = relocateIds.has(asked.id);
    const { addresses, tally } = await resolveProjectAddressPositions(
      relocate ? [asked] : [],
      [asked],
      Date.now(),
      { relocateIds: relocate ? new Set([asked.id]) : new Set<string>() },
    );
    // Άγνοια ⇒ δεν αγγίζουμε τίποτα· η επόμενη αποθήκευση θα ξαναρωτήσει.
    if (tally['geocoder-unavailable'] > 0 || addresses.length === 0) continue;
    // Πινέζα ανθρώπου **χωρίς** δήλωση μετακίνησης: η μηχανή δεν ρωτήθηκε, άρα δεν υπάρχει απάντηση.
    if (tally['human-pinned'] > 0) continue;
    decisions.set(asked.id, { asked, decided: addresses[0] });
  }
  return decisions;
}

/** Η διεύθυνση όπως είναι **τώρα**, με τη θέση που αποφασίστηκε — ή αυτούσια αν δεν αφορά πια. */
function applyDecision(current: ProjectAddressLike, decision: Decision | undefined): ProjectAddressLike {
  if (!decision) return current;
  // Το κείμενο ή η πινέζα άλλαξαν στο μεταξύ: η απάντηση αφορά διεύθυνση που δεν υπάρχει πια.
  if (addressIdentityChanged(decision.asked, current) || pointChanged(decision.asked, current)) {
    return current;
  }
  return withStoredAddressPosition(current, decision.decided as Readonly<StoredAddressPosition>);
}

/** Ίδια θέση; — **χωρίς** τη στιγμή επαλήθευσης (βλ. `storedPositionSignature`): αλλιώς μια δεύτερη
 * εκτέλεση «άλλαζε» τη θέση όποτε έπεφτε σε άλλο χιλιοστό — δεύτερη γραφή και δεύτερη γραμμή
 * ιστορικού για **καμία** αλλαγή. */
function samePosition(a: ProjectAddressLike, b: ProjectAddressLike): boolean {
  const signature = (address: ProjectAddressLike) =>
    storedPositionSignature(address as Readonly<StoredAddressPosition>);
  return signature(a) === signature(b);
}

// ============================================================================
// ΙΣΤΟΡΙΚΟ — τι άλλαξε η μηχανή, σε γλώσσα ανθρώπου
// ============================================================================

/** Πόσες διευθύνσεις άλλαξαν θέση — η **πύλη της γραφής** (υπογραφή θέσης, όχι κείμενο ιστορικού). */
function movedCount(before: readonly ProjectAddressLike[], after: readonly ProjectAddressLike[]): number {
  return after.filter((address, index) => address.id && !samePosition(address, before[index])).length;
}

/**
 * Τι άλλαξε, όπως το λέει η **ίδια** μηχανή διαφορών που γράφει και τις ανθρώπινες αλλαγές
 * (ADR-195 Φ11) — από τον **ίδιο** ορισμό (`ADDRESS_COLLECTION_DEF`).
 *
 * 🔑 Ήταν χειρόγραφη εγγραφή με δικό της μορφοποιητή συντεταγμένων, επειδή το μητρώο
 * παρακολουθούσε στις διευθύνσεις **μόνο κείμενο**. Από τότε που η θέση είναι παρακολουθούμενο
 * υπο-πεδίο (με προβολέα — ποτέ ωμό JSON), ο άνθρωπος που σέρνει την πινέζα και η μηχανή που την
 * ολοκληρώνει γράφουν **την ίδια** διατύπωση, από ένα σημείο.
 *
 * ⚠️ Μπορεί να είναι **κενό** ενώ έγινε γραφή: ίδιο σημείο με άλλη προέλευση/απόδειξη αλλάζει το
 * έγγραφο αλλά όχι ό,τι βλέπει άνθρωπος — και μια γραμμή «ίδιο → ίδιο» δεν γράφεται.
 */
function positionChanges(
  before: readonly ProjectAddressLike[],
  after: readonly ProjectAddressLike[],
): AuditFieldChange[] {
  return diffTrackedFields(
    { [ADDRESSES_FIELD]: before },
    { [ADDRESSES_FIELD]: after },
    { [ADDRESSES_FIELD]: ADDRESS_COLLECTION_DEF },
  );
}

/** Η γραμμή ιστορικού της μηχανής. **Μετά** το commit: παρενέργεια μέσα στη συναλλαγή θα έφευγε ξανά σε κάθε επανάληψη. */
async function recordCompletion(job: PendingAddressPositions, written: Written): Promise<void> {
  if (written.changes.length === 0) return;
  if (!written.companyId) {
    logger.warn('Ολοκλήρωση θέσεων χωρίς κάτοχο ιστορικού — η γραμμή δεν γράφτηκε', {
      collection: job.collection,
      docId: job.docId,
    });
    return;
  }
  await EntityAuditService.recordChange({
    entityType: job.entityType,
    entityId: job.docId,
    entityName: written.entityName,
    action: 'updated',
    changes: written.changes,
    performedBy: SYSTEM_IDENTITY.ADDRESS_POSITION_ID,
    performedByName: SYSTEM_IDENTITY.DISPLAY_NAME,
    companyId: written.companyId,
  });
}

/**
 * Ολοκληρώνει τις εκκρεμείς θέσεις ενός εγγράφου.
 *
 * 🔑 **Δεν πετά ποτέ**: τρέχει μετά την απάντηση (`after()`), όπου μια εξαίρεση δεν έχει ποιον να
 * ενημερώσει. Η αποτυχία καταγράφεται· το δίχτυ είναι η επόμενη αποθήκευση, που ξαναρωτά.
 */
export async function completePendingAddressPositions(
  adminDb: AdminFirestore,
  job: PendingAddressPositions,
): Promise<AddressPositionCompletion> {
  const pending = new Set(job.pendingIds);
  if (pending.size === 0) return { written: 0 };
  const ref = adminDb.collection(job.collection).doc(job.docId);

  try {
    const snapshot = await ref.get();
    const targets = readAddresses(snapshot.data()).filter((address) => address.id && pending.has(address.id));
    const decisions = await decide(targets, new Set(job.relocateIds ?? []));
    if (decisions.size === 0) return { written: 0 };

    const outcome = await adminDb.runTransaction(async (tx): Promise<Written | null> => {
      const data = (await tx.get(ref)).data() ?? {};
      const current = readAddresses(data);
      const next = current.map((address) => applyDecision(address, address.id ? decisions.get(address.id) : undefined));
      const moved = movedCount(current, next);
      if (moved === 0) return null;
      tx.update(ref, { [ADDRESSES_FIELD]: next, ...(job.derive?.(next) ?? {}) });
      return {
        moved,
        changes: positionChanges(current, next),
        entityName: readText(data, 'name'),
        companyId: readText(data, 'companyId'),
      };
    });

    const written = outcome?.moved ?? 0;
    if (outcome) await recordCompletion(job, outcome);

    logger.info('Εκκρεμείς θέσεις διευθύνσεων ολοκληρώθηκαν', {
      collection: job.collection,
      docId: job.docId,
      pending: pending.size,
      written,
    });
    return { written };
  } catch (error) {
    logger.warn('Ολοκλήρωση θέσεων εκκρεμής — θα ξαναρωτηθεί στην επόμενη αποθήκευση', {
      collection: job.collection,
      docId: job.docId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { written: 0 };
  }
}
