/**
 * Builds the DxfSaveContext propagated from the floorplan import wizard to
 * `handleFileImportWithEncoding`. Extracted from DxfViewerContent to keep that
 * orchestrator file under the 500-line ceiling.
 *
 * ADR-340 Phase 9 follow-up: propagate wizard `fileRecordId` so auto-save reuses
 * the canonical FileRecord instead of racing on name-based lookup against the
 * cadFiles processor.
 *
 * ADR-368: propagate `userDrawingUnits` so CanvasSection uses the user override
 * instead of the resolveSceneUnits() heuristic.
 *
 * @module subapps/dxf-viewer/app/dxf-import-save-context
 */

import type { WizardCompleteMeta } from '@/features/floorplan-import/FloorplanImportWizard';
import type { DxfSaveContext } from '../services/dxf-firestore.service';

export function buildDxfImportSaveContext(meta: WizardCompleteMeta): DxfSaveContext {
  return {
    companyId: meta.companyId || undefined,
    projectId: meta.projectId || undefined,
    ...(meta.entityType === 'floor' ? { floorId: meta.entityId } : {}),
    ...(meta.entityType === 'building' ? { buildingId: meta.entityId } : {}),
    entityType: meta.entityType as DxfSaveContext['entityType'],
    filesCategory: 'floorplans' as const,
    purpose: meta.purpose || undefined,
    entityLabel: meta.entityLabel,
    ...(meta.fileId ? { fileRecordId: meta.fileId } : {}),
    ...(meta.userDrawingUnits ? { userDrawingUnits: meta.userDrawingUnits } : {}),
  };
}
