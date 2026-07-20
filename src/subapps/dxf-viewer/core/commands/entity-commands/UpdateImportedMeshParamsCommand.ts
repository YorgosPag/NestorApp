/**
 * UPDATE IMPORTED MESH PARAMS COMMAND — ADR-683 Φ3.
 *
 * Ενημερώνει τα `params` ενός `ImportedMeshEntity` και **ξαναϋπολογίζει** `geometry` + `validation`
 * ατομικά, ώστε ο renderer να μη διαβάζει ποτέ γεωμετρία ασύμφωνη με την παραμετρική πηγή.
 *
 * Στην πράξη τα μόνα πεδία που αλλάζουν είναι `position` και `rotationDeg` — οι **μόνες** νόμιμες
 * μεταβολές ενός ψημένου πλέγματος (§10.1). Οι μετρημένες διαστάσεις δεν επεξεργάζονται· ο
 * {@link validate} το επιβάλλει ως συμβόλαιο, όχι ως ευχή.
 *
 * Ο σκελετός merge/undo/redo κληρονομείται από το `MergeableUpdateCommand` (ADR-507 §8), ώστε ένα
 * συνεχές drag να καταρρέει σε **ΕΝΑ** βήμα αναίρεσης.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.1
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type {
  ImportedMeshGeometry,
  ImportedMeshParams,
} from '../../../bim/entities/imported-mesh/imported-mesh-types';
import {
  computeImportedMeshGeometry,
  validateImportedMeshParams,
} from '../../../bim/entities/imported-mesh/imported-mesh-geometry';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateImportedMeshParamsCommand extends MergeableUpdateCommand<ImportedMeshParams> {
  readonly name = 'UpdateImportedMeshParams';
  readonly type = 'update-imported-mesh-params';

  constructor(
    importedMeshId: string,
    params: ImportedMeshParams,
    previousParams: ImportedMeshParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(importedMeshId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: ImportedMeshParams): void {
    const geometry: ImportedMeshGeometry = computeImportedMeshGeometry(params);
    const validation = validateImportedMeshParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: ImportedMeshParams): UpdateImportedMeshParamsCommand {
    return new UpdateImportedMeshParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update imported mesh params (${this.patch.nodeName})`;
  }

  /**
   * Φρουρεί ΚΑΙ το όριο του §3: αν κάποια μελλοντική διαδρομή προσπαθήσει να αλλάξει τις
   * μετρημένες διαστάσεις, η εντολή **απορρίπτεται**. Η γεωμετρία του συνεργάτη δεν
   * παραμορφώνεται — ούτε κατά λάθος.
   */
  validate(): string | null {
    if (!this.entityId) return 'Imported mesh entity ID is required';
    if (!this.patch.uploadId || !this.patch.nodeName) return 'imported mesh source ref is required';
    if (!Number.isFinite(this.patch.rotationDeg)) return 'rotationDeg must be finite';
    if (!Number.isFinite(this.patch.position.x) || !Number.isFinite(this.patch.position.y)) {
      return 'position must be finite';
    }
    const p = this.previousPatch;
    if (
      this.patch.measuredWidthMm !== p.measuredWidthMm ||
      this.patch.measuredDepthMm !== p.measuredDepthMm ||
      this.patch.measuredHeightMm !== p.measuredHeightMm
    ) {
      return 'imported mesh dimensions are measured, not editable (ADR-683 §3)';
    }
    return null;
  }
}
