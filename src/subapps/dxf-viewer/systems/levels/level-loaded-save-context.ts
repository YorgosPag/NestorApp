/**
 * level-loaded-save-context — το `DxfSaveContext` ενός επιπέδου όπως προκύπτει από το
 * FileRecord που μόλις φορτώθηκε (ADR-293 · ADR-358 Phase 9).
 *
 * Εξήχθη από τον `useLevelSceneLoader` (N.7.1) και έγινε pure, ώστε να δοκιμάζεται αυτόνομο.
 *
 * ADR-913: το context δηλώνει πλέον ΡΗΤΑ σε ποιο αρχείο ανήκει (`fileRecordId`). Το ticket
 * αποθήκευσης δέχεται context μόνο αν ανήκει στο αρχείο του (`ownedSaveContext`) — η ρητή
 * δήλωση το κάνει ανεξάρτητο από το αν το path έτυχε να περιέχει το id.
 *
 * @module subapps/dxf-viewer/systems/levels/level-loaded-save-context
 */

import { isCadLinkableEntityType } from '@/config/domain-constants';
import type { DxfFileRecord, DxfSaveContext } from '../../services/dxf-firestore.types';
import { deriveScenePath } from '../../services/dxf-scene-path';

/** Τα πεδία του φορτωμένου FileRecord που καθορίζουν το save context. */
export type LoadedFileScope = Pick<
  DxfFileRecord,
  'storagePath' | 'companyId' | 'projectId' | 'entityType' | 'entityId'
>;

/**
 * Το πλήρες save context του φορτωμένου αρχείου, ή `null` όταν το FileRecord δεν δίνει
 * ούτε path ούτε κάτοχο (τότε ο καλών αφήνει το context ως έχει — προϋπάρχουσα συμπεριφορά).
 *
 * Fail-closed στο `entityType`: ιστορικό FileRecord μπορεί να κρατά τύπο που το CAD pipeline
 * δεν δένει (π.χ. 'unit'). Παραλείπεται το κλειδί αντί να γίνει cast — αλλιώς το επόμενο
 * save θα απορριπτόταν με 400.
 */
export function buildLoadedLevelSaveContext(
  fileRecord: LoadedFileScope,
  fileId: string,
): DxfSaveContext | null {
  if (!fileRecord.storagePath && !fileRecord.entityType) return null;
  return {
    fileRecordId: fileId,
    ...(fileRecord.storagePath
      ? { canonicalScenePath: deriveScenePath(fileRecord.storagePath) }
      : {}),
    ...(fileRecord.companyId ? { companyId: fileRecord.companyId } : {}),
    ...(fileRecord.projectId ? { projectId: fileRecord.projectId } : {}),
    ...(isCadLinkableEntityType(fileRecord.entityType)
      ? { entityType: fileRecord.entityType }
      : {}),
    ...(fileRecord.entityType === 'floor' && fileRecord.entityId
      ? { floorId: fileRecord.entityId }
      : {}),
    ...(fileRecord.entityType === 'building' && fileRecord.entityId
      ? { buildingId: fileRecord.entityId }
      : {}),
  };
}
