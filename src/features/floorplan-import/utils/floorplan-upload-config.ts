/**
 * SPEC-237D — από την επιλογή του οδηγού στη ρύθμιση ανεβάσματος (βήμα 6).
 *
 * Pure: ποια οντότητα κατέχει το αρχείο, με ποια ετικέτα και ποιον σκοπό. Βγήκε από το
 * `useFloorplanImportState` ώστε να δοκιμάζεται χωρίς React.
 *
 * @module features/floorplan-import/utils/floorplan-upload-config
 */

import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { EntityType, FileCategory, FileDomain } from '@/config/domain-constants';
import { fileLinkTag } from '@/lib/files/file-link-tag';
import { FLOORPLAN_PURPOSE_BY_TYPE, type FloorplanImportSelection } from '../hooks/floorplan-import-types';

/** Ό,τι χρειάζεται από τον συνδεδεμένο χρήστη. */
export interface FloorplanUploadActor {
  readonly uid?: string | null;
  readonly companyId?: string | null;
}

interface UploadTarget {
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly entityLabel: string | undefined;
}

function resolveUploadTarget(selection: FloorplanImportSelection): UploadTarget | null {
  switch (selection.floorplanType) {
    case 'project':
      return selection.projectId
        ? { entityType: ENTITY_TYPES.PROJECT, entityId: selection.projectId, entityLabel: selection.projectName ?? undefined }
        : null;
    case 'building':
      return selection.buildingId
        ? { entityType: ENTITY_TYPES.BUILDING, entityId: selection.buildingId, entityLabel: selection.buildingName ?? undefined }
        : null;
    case 'floor':
      return selection.floorId
        ? { entityType: ENTITY_TYPES.FLOOR, entityId: selection.floorId, entityLabel: selection.floorName ?? undefined }
        : null;
    case 'property':
      return selection.propertyId
        ? {
            entityType: ENTITY_TYPES.PROPERTY,
            entityId: selection.propertyId,
            entityLabel: selection.levelName
              ? `${selection.propertyName} — ${selection.levelName}`
              : selection.propertyName ?? undefined,
          }
        : null;
    default:
      return null;
  }
}

/**
 * Οι γονείς στους οποίους δένεται το αρχείο πέρα από τον κάτοχό του.
 *
 * Ο όροφος μιας κάτοψης ακινήτου είναι αυτός που ΑΠΕΙΚΟΝΙΖΕΙ (ADR-914 §2.20): για επίπεδο
 * πολυεπίπεδης μονάδας το `levelFloorId`, αλλιώς ο όροφος του βήματος 4. Το βήμα 4 μόνο του
 * είναι ο ΚΥΡΙΟΣ όροφος του ακινήτου — το ίδιο κριτήριο με το `wizardMetaToBinding`.
 */
function resolveLinkedTo(selection: FloorplanImportSelection): string[] {
  const linkedTo: string[] = [];
  if (selection.floorplanType === 'property') {
    const depictedFloorId = selection.levelFloorId ?? selection.floorId;
    if (depictedFloorId) linkedTo.push(fileLinkTag(ENTITY_TYPES.FLOOR, depictedFloorId));
    if (selection.buildingId) linkedTo.push(fileLinkTag(ENTITY_TYPES.BUILDING, selection.buildingId));
  } else if (selection.floorplanType === 'floor') {
    if (selection.buildingId) linkedTo.push(fileLinkTag(ENTITY_TYPES.BUILDING, selection.buildingId));
  }
  return linkedTo;
}

/** `null` όσο η επιλογή δεν ορίζει στόχο ή ο χρήστης δεν είναι γνωστός. */
export function buildFloorplanUploadConfig(
  selection: FloorplanImportSelection,
  actor: FloorplanUploadActor | null | undefined,
): FloorplanUploadConfig | null {
  if (!selection.companyId || !selection.floorplanType || !actor?.uid) return null;
  const target = resolveUploadTarget(selection);
  if (!target) return null;
  const linkedTo = resolveLinkedTo(selection);

  return {
    companyId: actor.companyId ?? selection.companyId,
    projectId: selection.projectId ?? undefined,
    ...target,
    domain: 'construction' as FileDomain,
    category: 'floorplans' as FileCategory,
    userId: actor.uid,
    purpose: FLOORPLAN_PURPOSE_BY_TYPE[selection.floorplanType],
    ...(selection.levelFloorId ? { levelFloorId: selection.levelFloorId } : {}),
    ...(linkedTo.length > 0 ? { linkedTo } : {}),
  };
}
