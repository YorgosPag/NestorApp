/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΔΕΣΜΕΥΣΗΣ ΑΡΧΕΙΟΥ (ADR-864 §21)
 * =============================================================================
 *
 * **Η πράξη**: *«πάγωσε αυτό το αρχείο — βάση ΚΑΙ bytes — ώσπου να το αποδεσμεύσει κάποιος
 * που δικαιούται»*. Ο κριτής δικαιώματος ζει στη διαδρομή (ADR-801)· εδώ μόνο η πράξη.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΕΙΣ ΑΠΟΦΑΣΕΙΣ, ΜΕ ΤΗΝ ΠΗΓΗ ΤΟΥΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. **Όλη η στοίβα εκδόσεων**, όχι ένα έγγραφο — Google Vault: *«Vault retains all
 *    versions»*. Μια δέσμευση που φυλά την κεφαλή και αφήνει την προηγούμενη έκδοση να
 *    σβηστεί χάνει ακριβώς το αποδεικτικό που χρειάζεται μια διαφορά («τι ίσχυε τότε;»).
 * 2. **Τα bytes τα φυλά η πλατφόρμα** — GCS `temporaryHold`: *«the object cannot be deleted
 *    or replaced»*. Ο κανόνας Storage δεν ξέρει τη βάση (οι `firestore.get` αφαιρέθηκαν ως
 *    αναξιόπιστοι)· η πλατφόρμα αρνείται ακόμη και τον Admin SDK.
 * 3. **Σειρά που δεν αφήνει ποτέ «δεσμευμένο στη βάση, ελεύθερο στο bucket»**:
 *    τοποθέτηση = bytes **πρώτα**, βάση μετά· αποδέσμευση = βάση **πρώτα**, bytes μετά —
 *    και **κάθε** πράξη τελειώνει με `reconcileBytes` (τα bytes ακολουθούν τη βάση), ώστε
 *    ταυτόχρονες πράξεις και μισές αποτυχίες να συγκλίνουν με επανάληψη.
 *
 * ⚠️ **Μία δέσμευση τη φορά**: δεύτερη τοποθέτηση σε ήδη δεσμευμένη στοίβα ⇒ `already-held`,
 * ποτέ σιωπηλή αντικατάσταση του είδους/λόγου της πρώτης.
 *
 * @module services/file-record/file-hold.service
 * @see lib/files/file-hold — ο καθαρός κριτής · app/api/files/[fileId]/hold — η διαδρομή
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { HOLD_TYPES } from '@/config/domain-constants';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { hasActiveHold, type PlaceableHoldType } from '@/lib/files/file-hold';
import { fileStoragePlacementOf, type FileStoragePlacement } from '@/lib/files/file-storage-placement';
import { fileStorageBucket } from '@/server/files/file-record-bucket';
import { createModuleLogger } from '@/lib/telemetry';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { readVersionStack } from '@/services/iso19650/version-stack';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { custodyKindOfScope, type CustodyScope } from '@/lib/workspace/custody-scope';
import type { FileRecord } from '@/types/file-record';

const logger = createModuleLogger('FileHoldService');

/** Το ελάχιστο bucket που χρειάζεται η πράξη — ώστε οι άγκυρες να τρέχουν χωρίς GCS. */
export interface HoldableBucket {
  file(path: string): { setMetadata(patch: { readonly temporaryHold: boolean }): Promise<unknown> };
}

export interface FileHoldActor {
  readonly uid: string;
  /**
   * Ο **κάτοχος** της στοίβας — εταιρεία (νόμιμη δέσμευση, ADR-864 §21) **ή** άνθρωπος (σταλμένη έκδοση transmittal,
   * ADR-901 Φ4.4 / ADR-864 §21.9). Διαλέγει διαμέρισμα σε **κάθε** ανάγνωση/εγγραφή — ποτέ μισή στοίβα αλλού.
   */
  readonly owner: CustodyScope;
}

export type FileHoldOutcome =
  | { readonly kind: 'placed' | 'released'; readonly fileIds: readonly string[] }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'already-held'; readonly holdType: string }
  | { readonly kind: 'not-held' }
  | { readonly kind: 'failed' };

class HoldConflict extends Error {
  constructor(readonly holdType: string) {
    super('already-held');
  }
}

// =============================================================================
// BYTES
// =============================================================================

/**
 * 🌍 ADR-895: ΠΟΙΟΣ κάδος για μια δοθείσα θέση — προεπιλογή ο **ΕΝΑΣ επιλογέας** (`fileStorageBucket`).
 * Οι άγκυρες περνούν δικό τους (δύο ψεύτικους κάδους) — η στοίβα μπορεί να έχει εκδόσεις σε
 * ΔΙΑΦΟΡΕΤΙΚΟΥΣ κάδους (μετάβαση εν εξελίξει), άρα δεν αρκεί **ένας** ενέσιμος κάδος πια.
 */
export type HoldBucketResolver = (placement: FileStoragePlacement) => HoldableBucket;

const defaultHoldBucketResolver: HoldBucketResolver = (placement) => fileStorageBucket(placement);

/** Τα storagePath της στοίβας, ομαδοποιημένα ανά ΘΕΣΗ (ADR-895 Α3) — όχι ένα επίπεδο σύνολο πια. */
function pathsByPlacement(versions: readonly FileRecord[]): ReadonlyMap<FileStoragePlacement, readonly string[]> {
  const map = new Map<FileStoragePlacement, string[]>();
  for (const version of versions) {
    const path = version.storagePath;
    if (typeof path !== 'string' || path.length === 0) continue;
    const placement = fileStoragePlacementOf(version);
    const existing = map.get(placement);
    if (existing) {
      if (!existing.includes(path)) existing.push(path);
    } else {
      map.set(placement, [path]);
    }
  }
  return map;
}

/** Γύρισε τον διακόπτη σε κάθε αντικείμενο — ή πέτα. 404 = το αντικείμενο δεν έχει bytes. */
async function setTemporaryHold(bucket: HoldableBucket, paths: readonly string[], temporaryHold: boolean): Promise<void> {
  for (const path of paths) {
    try {
      await bucket.file(path).setMetadata({ temporaryHold });
    } catch (error: unknown) {
      if ((error as { code?: unknown }).code !== 404) throw error;
    }
  }
}

/** Ίδιος διακόπτης σε ΚΑΘΕ κάδο που εμπλέκεται στη στοίβα — μία εγγραφή ανά θέση (ADR-895 Α3). */
async function setTemporaryHoldAcrossStack(
  versions: readonly FileRecord[],
  bucketOf: HoldBucketResolver,
  temporaryHold: boolean,
): Promise<void> {
  for (const [placement, paths] of pathsByPlacement(versions)) {
    await setTemporaryHold(bucketOf(placement), paths, temporaryHold);
  }
}

/**
 * 🔑 **ΤΑ BYTES ΑΚΟΛΟΥΘΟΥΝ ΤΗ ΒΑΣΗ** — η μία απάντηση σε κάθε συνδυασμό ταυτόχρονων πράξεων.
 * Διαβάζει την κατάσταση **μετά** τη γραφή και θέτει τον διακόπτη ανάλογα. Χωρίς αυτό, δύο
 * ταυτόχρονες τοποθετήσεις (η χαμένη «αντισταθμίζει» ⇒ ξεκλειδώνει τα bytes της νικήτριας) ή
 * τοποθέτηση + αποδέσμευση θα άφηναν «δεσμευμένο στη βάση, ελεύθερο στο bucket».
 * Κάθε ενδιάμεση ασυμφωνία είναι προς την **ασφαλή** πλευρά (bytes κλειδωμένα, βάση ελεύθερη).
 */
async function reconcileBytes(owner: CustodyScope, fileIds: readonly string[], versions: readonly FileRecord[], bucketOf: HoldBucketResolver): Promise<void> {
  const db = getAdminFirestore();
  const collection = db.collection(COLLECTIONS[FILE_COLLECTION[custodyKindOfScope(owner)]]);
  const snapshots = await Promise.all(fileIds.map((id) => collection.doc(id).get()));
  const held = snapshots.some((snapshot) => snapshot.exists && hasActiveHold(snapshot.data() ?? {}));
  await setTemporaryHoldAcrossStack(versions, bucketOf, held);
}

// =============================================================================
// ΒΑΣΗ — μία συναλλαγή ανά πράξη
// =============================================================================

type HoldPatch = Readonly<Record<string, string>>;

/**
 * Ξαναδιάβασε **μέσα** στη συναλλαγή και γράψε — `judge` αποφασίζει ανά έγγραφο:
 * `null` = μην αγγίξεις, αντικείμενο = γράψε. Επιστρέφει τα ids που γράφτηκαν.
 */
async function writeStack(
  owner: CustodyScope,
  fileIds: readonly string[],
  judge: (current: Record<string, unknown>) => HoldPatch | null,
): Promise<string[]> {
  const db = getAdminFirestore();
  return db.runTransaction(async (tx) => {
    const collection = db.collection(COLLECTIONS[FILE_COLLECTION[custodyKindOfScope(owner)]]);
    const refs = fileIds.map((id) => collection.doc(id));
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    const writes = snapshots.flatMap((snapshot, index) => {
      const patch = snapshot.exists ? judge(snapshot.data() ?? {}) : null;
      return patch === null ? [] : [{ ref: refs[index], patch }];
    });
    for (const { ref, patch } of writes) tx.update(ref, { ...patch, updatedAt: nowISO() });
    return writes.map(({ ref }) => ref.id);
  });
}

async function auditEach(fileIds: readonly string[], actor: FileHoldActor, action: 'hold_place' | 'hold_release', metadata: Record<string, string | number>): Promise<void> {
  await Promise.all(fileIds.map((fileId) =>
    recordFileAudit({ fileId, action, performedBy: actor.uid, ...actor.owner, metadata: { ...metadata, stackSize: fileIds.length } })));
}

/**
 * 🗂️ **Η στοίβα του αρχείου, στο διαμέρισμα του ΚΑΤΟΧΟΥ** — ADR-866 2β.3β · ADR-864 §21.9.
 *
 * Δύο κάτοχοι, **ένας** γραφέας: η **νόμιμη δέσμευση** (εταιρεία — υπεύθυνος συμμόρφωσης, ADR-864 §21)
 * και η **σταλμένη έκδοση** ενός transmittal (άνθρωπος — ADR-901 Φ4.4: ό,τι έλαβε ο άλλος δεν σβήνεται
 * οριστικά). Ο κάτοχος έρχεται **με τον actor** και διαλέγει διαμέρισμα σε ανάγνωση, εγγραφή **και**
 * συμφιλίωση bytes — μία πηγή, ώστε να μη δεσμευτεί η μία στοίβα και να ελεγχθεί άλλη.
 *
 * ⚠️ **Εξήχθη επειδή οι δύο πράξεις το ζητούσαν ολόιδια** (CHECK 3.28 · N.18 — μετρημένος κλώνος
 * 6 γραμμών **μέσα στο ίδιο commit**): δύο χειρόγραφα αντίγραφα θα μπορούσαν να αποκλίνουν στο
 * διαμέρισμα, δηλαδή να δεσμεύσουν τη μία στοίβα και να αποδεσμεύσουν άλλη.
 */
function heldVersionStack(actor: FileHoldActor, fileId: string): ReturnType<typeof readVersionStack> {
  return readVersionStack(actor.owner, fileId);
}

// =============================================================================
// ΟΙ ΔΥΟ ΠΡΑΞΕΙΣ
// =============================================================================

export interface PlaceFileHoldInput {
  readonly actor: FileHoldActor;
  readonly fileId: string;
  readonly holdType: PlaceableHoldType;
  readonly reason: string;
}

/** **Τοποθέτηση** στη στοίβα του αρχείου: bytes πρώτα (σε ΚΑΘΕ κάδο της στοίβας), βάση μετά, συμφιλίωση στο τέλος. */
export async function placeFileHold(input: PlaceFileHoldInput, bucketOf: HoldBucketResolver = defaultHoldBucketResolver): Promise<FileHoldOutcome> {
  const stack = await heldVersionStack(input.actor, input.fileId);
  if (stack.kind === 'not-found') return { kind: 'not-found' };
  const held = stack.versions.find((version) => hasActiveHold(version));
  if (held) return { kind: 'already-held', holdType: String(held.hold) };

  const ids = stack.versions.map((v) => v.id);
  try {
    await setTemporaryHoldAcrossStack(stack.versions, bucketOf, true);
    const placedAt = nowISO();
    const fileIds = await writeStack(input.actor.owner, ids, (current) => {
      if (hasActiveHold(current)) throw new HoldConflict(String(current.hold));
      return { hold: input.holdType, holdPlacedBy: input.actor.uid, holdPlacedAt: placedAt, holdReason: input.reason };
    });
    await auditEach(fileIds, input.actor, 'hold_place', { holdType: input.holdType, reason: input.reason });
    await reconcileBytes(input.actor.owner, ids, stack.versions, bucketOf);
    return { kind: 'placed', fileIds };
  } catch (error: unknown) {
    await reconcileBytes(input.actor.owner, ids, stack.versions, bucketOf).catch((e: unknown) =>
      logger.error('Byte reconciliation failed — bytes stay locked (safe side)', { fileId: input.fileId, error: getErrorMessage(e) }));
    if (error instanceof HoldConflict) return { kind: 'already-held', holdType: error.holdType };
    logger.error('File hold was not placed', { fileId: input.fileId, error: getErrorMessage(error) });
    return { kind: 'failed' };
  }
}

export interface ReleaseFileHoldInput {
  readonly actor: FileHoldActor;
  readonly fileId: string;
}

/** **Αποδέσμευση**: βάση πρώτα, bytes μετά (σε ΚΑΘΕ κάδο της στοίβας) — και τα bytes συμφιλιώνονται πάντα (ιδεμπότητο). */
export async function releaseFileHold(input: ReleaseFileHoldInput, bucketOf: HoldBucketResolver = defaultHoldBucketResolver): Promise<FileHoldOutcome> {
  const stack = await heldVersionStack(input.actor, input.fileId);
  if (stack.kind === 'not-found') return { kind: 'not-found' };

  try {
    const ids = stack.versions.map((v) => v.id);
    const releasedAt = nowISO();
    const fileIds = await writeStack(input.actor.owner, ids, (current) =>
      hasActiveHold(current) ? { hold: HOLD_TYPES.NONE, holdReleasedBy: input.actor.uid, holdReleasedAt: releasedAt } : null);
    if (fileIds.length > 0) await auditEach(fileIds, input.actor, 'hold_release', {});
    // Και όταν η βάση έλεγε ήδη «καμία»: μισή αποτυχία προηγούμενης αποδέσμευσης διορθώνεται εδώ.
    await reconcileBytes(input.actor.owner, ids, stack.versions, bucketOf);
    return fileIds.length > 0 ? { kind: 'released', fileIds } : { kind: 'not-held' };
  } catch (error: unknown) {
    logger.error('File hold was not released', { fileId: input.fileId, error: getErrorMessage(error) });
    return { kind: 'failed' };
  }
}
