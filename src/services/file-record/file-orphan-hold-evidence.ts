/**
 * =============================================================================
 * ΣΗΜΑΔΙΑ ΝΟΜΙΜΗΣ ΔΕΣΜΕΥΣΗΣ ΓΙΑ ΑΡΧΕΙΟ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ ΠΙΑ (ADR-916 Ο24 · ADR-864 §21)
 * =============================================================================
 *
 * **Η ερώτηση**: *«κρατούσε αυτό το αρχείο νόμιμη δέσμευση ή record όταν σβήστηκε — εκτός εφαρμογής, χωρίς να ρωτήσει κανέναν;»*
 *
 * Η απάντηση ζούσε στο ίδιο το έγγραφο (`hold` γράφεται σε **κάθε** έκδοση της στοίβας) — και το έγγραφο λείπει. Μένουν δύο
 * ανεξάρτητοι μάρτυρες· οποιοσδήποτε λέει «ναι» ⇒ κρατά (Purview: *«retention/hold wins over deletion»*):
 * 1. **Η στοίβα από τους προκατόχους** — ο δεσμός `supersededByFileId` ζει στον προκάτοχο, άρα επιζεί· η ίδια δέσμευση
 *    γράφτηκε και εκεί. ⚠️ Ο **διάδοχος** δεν βρίσκεται (ο δεσμός του ζούσε στο σβησμένο έγγραφο) ⇒ γι' αυτό ο 2ος μάρτυρας.
 * 2. **Το ίχνος του ίδιου του id** — `hold_place` γράφεται ανά id της στοίβας, άρα και για αυτό· το νεότερο `hold_place` χωρίς
 *    μεταγενέστερο `hold_release` ⇒ κρατά. ⚠️ Το ίχνος είναι best-effort (`recordFileAudit` καταπίνει σφάλμα) — δηλωμένος
 *    υπόλοιπος κίνδυνος στο ADR-916 §5.24, καλυμμένος από ωρίμανση + επανέλεγχο του sweeper.
 *
 * 🛡️ **Αδυναμία ανάγνωσης ⇒ πετά** — ο καλών το μεταφράζει σε «κράτα» (fail-closed). Ποτέ «δεν βρήκα» από σφάλμα.
 *
 * @module services/file-record/file-orphan-hold-evidence
 * @see services/file-record/file-hold.service — ο γραφέας της δέσμευσης
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { hasActiveHold, isDeclaredRecord, type FileHoldSubject } from '@/lib/files/file-hold';
import { readPredecessors, readVersionStack } from '@/services/iso19650/version-stack';

const HOLD_ACTIONS = ['hold_place', 'hold_release'] as const;

const holdsBytes = (data: FileHoldSubject & Parameters<typeof isDeclaredRecord>[0]): boolean => hasActiveHold(data) || isDeclaredRecord(data);

/**
 * (1) Κρατά κάποια επιζώσα έκδοση της στοίβας δέσμευση ή record; — πρώτα τα **ωμά** πεδία κάθε άμεσου προκατόχου (η δέσμευση
 * γράφεται σε κάθε έκδοση, και μια εγγραφή που δεν περνά το `normalizeFileRecord` δεν πρέπει να κάνει τον μάρτυρα να σιωπά),
 * μετά η υπόλοιπη στοίβα.
 */
async function survivingStackHolds(companyId: string, fileId: string): Promise<boolean> {
  const owner = { companyId };
  const predecessors = await readPredecessors(owner, fileId);
  if (predecessors.some(({ data }) => holdsBytes(data))) return true;
  for (const { id: predecessorId } of predecessors) {
    const stack = await readVersionStack(owner, predecessorId);
    if (stack.kind === 'stack' && stack.versions.some((version) => holdsBytes(version))) return true;
  }
  return false;
}

/** (2) Το νεότερο γεγονός δέσμευσης του id είναι `hold_place`; — χρόνος που δεν διαβάζεται ⇒ μετρά ως «κρατά». */
async function auditTrailHolds(companyId: string, fileId: string): Promise<boolean> {
  const snapshot = await getAdminFirestore()
    .collection(COLLECTIONS.FILE_AUDIT_LOG) // το βιβλίο της ΕΤΑΙΡΕΙΑΣ, κυριολεκτικά — ώστε οι πύλες 3.15 · 3.35 · 3.91 να το κρίνουν
    .where('companyId', '==', companyId)
    .where('fileId', '==', fileId)
    .where('action', 'in', [...HOLD_ACTIONS])
    .get();
  let latest: { readonly at: number; readonly action: unknown } | null = null;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const at = normalizeToMillisOrNull(data.timestamp);
    if (at === null) return true;
    if (latest === null || at > latest.at || (at === latest.at && data.action === 'hold_place')) latest = { at, action: data.action };
  }
  return latest !== null && latest.action === 'hold_place';
}

/**
 * **Κρατούσε νόμιμη δέσμευση / record;** — για id εταιρείας που το έγγραφό του **λείπει**. Πετά σε σφάλμα ανάγνωσης.
 */
export async function missingFileHoldEvidence(companyId: string, fileId: string): Promise<boolean> {
  return (await survivingStackHolds(companyId, fileId)) || (await auditTrailHolds(companyId, fileId));
}
