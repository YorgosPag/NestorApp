/**
 * 🧩 **Σβήσε τα συνοδευτικά ενός αρχείου** — μικρογραφίες, σκηνές, επεξεργασμένα δεδομένα (ADR-899 §2.2 · ADR-191 document management).
 *
 * Το καλεί **μόνο** ο γραφέας του purge (`deleteStorageObjectForPurge`), **μετά** το πρωτότυπο: δέσμευση της
 * πλατφόρμας στο πρωτότυπο σταματά τα πάντα πριν φτάσουμε εδώ ⇒ ένα δεσμευμένο αρχείο δεν χάνει ούτε τη μικρογραφία του.
 *
 * Υποψήφιοι = **ένωση** δύο πηγών, περασμένη από τον **ίδιο** φρουρό (`isCompanionPathOf`):
 * 1. τα ονόματα του μητρώου (`lib/files/file-companion-objects`) — βρίσκουν και ό,τι η εγγραφή **ξέχασε**
 *    (το `.processed.json` που το autosave του CAD αντικατέστησε στο `processedDataPath`)·
 * 2. οι δείκτες της εγγραφής (`thumbnailStoragePath`, `thumbnailUrl`, `processedData.*`, `downloadUrl`) —
 *    βρίσκουν ό,τι γράφτηκε με όνομα που το μητρώο δεν ξέρει ακόμη.
 *
 * 🔁 Ιδεμποτής: 404 = «λείπει ήδη». Οποιαδήποτε άλλη αποτυχία ⇒ `refused` ⇒ η εγγραφή **δεν** γίνεται `purged`
 * και ο επόμενος γύρος ξαναδοκιμάζει (το πρωτότυπο θα απαντήσει πια 404). Ποτέ «σβήστηκε» για bytes που υπάρχουν.
 *
 * @module services/file-record/file-companion-purge
 */

import 'server-only';

import {
  fileCompanionCandidates,
  isCompanionPathOf,
  type FileCompanionHome,
} from '@/lib/files/file-companion-objects';
import {
  FILE_STORAGE_PLACEMENT_LEGACY,
  fileStoragePlacementOf,
  type FileStoragePlacement,
  type FileStoragePlacementSubject,
} from '@/lib/files/file-storage-placement';
import { storageObjectFromUrl } from '@/lib/storage/storage-object-url';
import { fileStorageBucket, fileStoragePlacementOfBucket } from '@/server/files/file-record-bucket';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('FileCompanionPurge');

/** Η εγγραφή όπως τη διαβάζει ο κριτής — δομικά, ώστε να δέχεται `DocumentData`. */
export interface FileCompanionSubject extends FileStoragePlacementSubject {
  readonly fileId: string;
  readonly storagePath: string;
  readonly thumbnailUrl?: unknown;
  readonly thumbnailStoragePath?: unknown;
  readonly downloadUrl?: unknown;
  readonly processedData?: unknown;
}

export type CompanionPurgeOutcome = 'done' | 'refused';

interface CompanionTarget {
  readonly path: string;
  readonly placement: FileStoragePlacement;
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function processedField(subject: FileCompanionSubject, key: string): unknown {
  const data = subject.processedData;
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>)[key] : undefined;
}

function placementOfHome(home: FileCompanionHome, recordPlacement: FileStoragePlacement): FileStoragePlacement {
  return home === 'beside-original' ? recordPlacement : FILE_STORAGE_PLACEMENT_LEGACY;
}

/** Μονοπάτι χωρίς κάδο ⇒ και οι δύο δηλωμένες «κατοικίες» (ο γραφέας του είναι άγνωστος). */
function pathPointerTargets(subject: FileCompanionSubject, recordPlacement: FileStoragePlacement): CompanionTarget[] {
  return [subject.thumbnailStoragePath, processedField(subject, 'processedDataPath')]
    .filter(nonEmpty)
    .flatMap((path) => [recordPlacement, FILE_STORAGE_PLACEMENT_LEGACY].map((placement) => ({ path, placement })));
}

/** URL ⇒ ο κάδος **που δηλώνει το URL**· ξένος κάδος ⇒ ποτέ (δεν είναι δικό μας να το σβήσουμε). */
function urlPointerTargets(subject: FileCompanionSubject, recordPlacement: FileStoragePlacement): CompanionTarget[] {
  const urls = [
    subject.thumbnailUrl,
    subject.downloadUrl,
    processedField(subject, 'processedDataUrl'),
    processedField(subject, 'pdfPreviewUrl'),
  ].filter(nonEmpty);
  return urls.flatMap((url) => {
    const ref = storageObjectFromUrl(url);
    if (ref.outcome !== 'object') return [];
    const placement = ref.bucket === null ? recordPlacement : fileStoragePlacementOfBucket(ref.bucket);
    if (placement === null) {
      logger.warn('Companion pointer in a foreign bucket — left alone', { fileId: subject.fileId, bucket: ref.bucket });
      return [];
    }
    return [{ path: ref.storagePath, placement }];
  });
}

/** Η ένωση των υποψηφίων, περασμένη από τον φρουρό, χωρίς διπλότυπα (κάδος · μονοπάτι). */
export function companionTargetsOf(subject: FileCompanionSubject): readonly CompanionTarget[] {
  const recordPlacement = fileStoragePlacementOf(subject);
  const all: CompanionTarget[] = [
    ...fileCompanionCandidates(subject.fileId, subject.storagePath).map((c) => ({
      path: c.path,
      placement: placementOfHome(c.home, recordPlacement),
    })),
    ...pathPointerTargets(subject, recordPlacement),
    ...urlPointerTargets(subject, recordPlacement),
  ];
  const seen = new Map<string, CompanionTarget>();
  for (const target of all) {
    if (!isCompanionPathOf(subject.fileId, subject.storagePath, target.path)) continue;
    seen.set(`${target.placement}\u0000${target.path}`, target);
  }
  return [...seen.values()];
}

async function deleteTarget(target: CompanionTarget): Promise<boolean> {
  try {
    await fileStorageBucket(target.placement).file(target.path).delete();
    return true;
  } catch (error: unknown) {
    if ((error as { code?: unknown }).code === 404) return true;
    logger.warn('Companion deletion refused — the record stays unpurged', {
      path: target.path, placement: target.placement, error: getErrorMessage(error),
    });
    return false;
  }
}

/**
 * Σβήσε **κάθε** συνοδευτικό. `refused` αν **ένα** αρνήθηκε — τα υπόλοιπα έχουν ήδη σβηστεί (ιδεμποτής επανάληψη).
 * ⚠️ Προϋπόθεση: ο καλών έχει ήδη κρίνει τη θέση της εγγραφής (άγνωστη ⇒ δεν φτάνει εδώ).
 */
export async function deleteFileCompanions(subject: FileCompanionSubject): Promise<CompanionPurgeOutcome> {
  const outcomes = await Promise.all(companionTargetsOf(subject).map(deleteTarget));
  return outcomes.every(Boolean) ? 'done' : 'refused';
}
