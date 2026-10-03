/**
 * =============================================================================
 * Η δέσμευση της ΣΤΑΛΜΕΝΗΣ έκδοσης (ADR-901 Φ4.4 · άγκυρα Α26 · ADR-864 §21.9)
 * =============================================================================
 *
 * *«Ό,τι έλαβε ο άλλος δεν σβήνεται οριστικά»*: όσο υπάρχει ζωντανό transmittal, η στοίβα εκδόσεων του αρχείου
 * (βάση **και** bytes) είναι σε **σιωπηλή δέσμευση** — ο συντάκτης μπορεί να τη στείλει στον κάδο, **όχι** να τη
 * σβήσει οριστικά (Google Vault · Box Governance). **Κάδος ≠ απόσυρση**: η απόσυρση είναι ρητή πράξη με ίχνος.
 *
 * Τρεις κανόνες, όλοι εδώ:
 * 1. **Αιτιολογία ανά υπόθεση** (`conveyance-transmittal:<caseId>`) — η δέσμευση είναι ανά **στοίβα**, και μια στοίβα
 *    μπορεί να καρφώνεται από πολλές αποστολές (v1, v2 της ίδιας γραμμής).
 * 2. **Νέα έκδοση σε ήδη δεσμευμένη στοίβα**: ο γραφέας δέσμευσης απαντά `already-held` χωρίς να καλύψει τη νέα
 *    έκδοση. Αν η υπάρχουσα δέσμευση είναι **δική μας**, αποδεσμεύεται και ξανατοποθετείται σε **όλη** τη στοίβα.
 * 3. **Ποτέ ξένη δέσμευση**: δέσμευση άλλης αιτιολογίας δεν αποδεσμεύεται ούτε αντικαθίσταται — ονομάζεται.
 *
 * Ιδεμπότητο: κάθε κλήση **συγκλίνει** στο ίδιο τέλος, άρα η επανάληψη ενός αιτήματος διορθώνει μισή αποτυχία.
 *
 * @module services/conveyance/conveyance-transmittal-hold
 */

import 'server-only';

import { hasActiveHold } from '@/lib/files/file-hold';
import { createModuleLogger } from '@/lib/telemetry';
import { placeFileHold, releaseFileHold, type FileHoldActor } from '@/services/file-record/file-hold.service';
import { readVersionStack } from '@/services/iso19650/version-stack';
import type { FileRecord } from '@/types/file-record';

const logger = createModuleLogger('conveyance-transmittal-hold');

const REASON_PREFIX = 'conveyance-transmittal:';

function reasonOf(caseId: string): string {
  return `${REASON_PREFIX}${caseId}`;
}

function isTransmittalHold(version: FileRecord): boolean {
  return typeof version.holdReason === 'string' && version.holdReason.startsWith(REASON_PREFIX);
}

function authorActor(authorUid: string): FileHoldActor {
  return { uid: authorUid, owner: { userId: authorUid } };
}

type TransmittalHoldOutcome = 'held' | 'released' | 'kept' | 'not-held' | 'foreign-hold' | 'failed';

/** Ξανακάλυψε όλη τη στοίβα όταν η **δική μας** δέσμευση δεν πιάνει τη νέα έκδοση. */
async function recoverStack(authorUid: string, fileId: string, caseId: string): Promise<TransmittalHoldOutcome> {
  const stack = await readVersionStack({ userId: authorUid }, fileId);
  if (stack.kind === 'not-found') return 'failed';
  if (stack.versions.find((v) => v.id === fileId && hasActiveHold(v))) return 'held';
  const held = stack.versions.find((v) => hasActiveHold(v));
  if (held && !isTransmittalHold(held)) return 'foreign-hold';
  const actor = authorActor(authorUid);
  if (held) await releaseFileHold({ actor, fileId });
  const placed = await placeFileHold({ actor, fileId, holdType: 'admin', reason: reasonOf(caseId) });
  return placed.kind === 'placed' ? 'held' : 'failed';
}

/** Βεβαιώσου ότι η σταλμένη έκδοση (και όλη η στοίβα της) είναι σε δέσμευση. */
export async function ensureTransmittalHold(authorUid: string, fileId: string, caseId: string): Promise<TransmittalHoldOutcome> {
  try {
    const placed = await placeFileHold({ actor: authorActor(authorUid), fileId, holdType: 'admin', reason: reasonOf(caseId) });
    if (placed.kind === 'placed') return 'held';
    if (placed.kind === 'already-held') return await recoverStack(authorUid, fileId, caseId);
    return 'failed';
  } catch (error) {
    logger.error('Η δέσμευση της σταλμένης έκδοσης δεν τοποθετήθηκε', { fileId, error: error instanceof Error ? error.message : String(error) });
    return 'failed';
  }
}

/**
 * Αποδέσμευσε τη στοίβα — **μόνο** αν καμία άλλη ζωντανή αποστολή δεν καρφώνει έκδοσή της (`stillPinned`) και η
 * δέσμευση είναι δική μας.
 */
export async function releaseTransmittalHold(authorUid: string, fileId: string, stillPinned: ReadonlySet<string>): Promise<TransmittalHoldOutcome> {
  try {
    const stack = await readVersionStack({ userId: authorUid }, fileId);
    if (stack.kind === 'not-found') return 'not-held';
    if (stack.versions.some((v) => stillPinned.has(v.id))) return 'kept';
    const held = stack.versions.find((v) => hasActiveHold(v));
    if (!held) return 'not-held';
    if (!isTransmittalHold(held)) return 'foreign-hold';
    const released = await releaseFileHold({ actor: authorActor(authorUid), fileId });
    return released.kind === 'released' || released.kind === 'not-held' ? 'released' : 'failed';
  } catch (error) {
    logger.error('Η δέσμευση της σταλμένης έκδοσης δεν αποδεσμεύτηκε', { fileId, error: error instanceof Error ? error.message : String(error) });
    return 'failed';
  }
}
