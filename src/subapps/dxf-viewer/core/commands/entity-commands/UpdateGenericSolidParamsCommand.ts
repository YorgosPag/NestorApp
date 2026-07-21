/**
 * UPDATE GENERIC SOLID PARAMS COMMAND — ADR-684 Φ2/Φ3.
 *
 * Ενημερώνει τα `params` ενός `GenericSolidEntity` και **ξαναϋπολογίζει** `geometry` + `validation`
 * ατομικά, ώστε ο renderer να μη διαβάζει ποτέ γεωμετρία ασύμφωνη με την παραμετρική πηγή (SSoT =
 * params, geometry = παράγωγο).
 *
 * Σε αντίθεση με το `UpdateImportedMeshParamsCommand` (ψημένη γεωμετρία → μόνο position/rotation),
 * εδώ το σχήμα **ΕΙΝΑΙ** παραμετρικό: το box corner-resize επεξεργάζεται νόμιμα τα `shape.widthMm`/
 * `depthMm`. Ο έλεγχος εγκυρότητας ζει στο `validateGenericSolidParams` (SSoT) — μη-θετική διάσταση
 * ή εκφυλισμένο σχήμα → η εντολή απορρίπτεται πριν την εκτέλεση.
 *
 * Ο σκελετός merge/undo/redo κληρονομείται από το `MergeableUpdateCommand`, ώστε ένα συνεχές drag να
 * καταρρέει σε **ΕΝΑ** βήμα αναίρεσης (ADR-031).
 *
 * @see ../../../bim/entities/generic-solid/generic-solid-geometry — computeGenericSolidGeometry + validateGenericSolidParams
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type {
  GenericSolidGeometry,
  GenericSolidParams,
} from '../../../bim/entities/generic-solid/generic-solid-types';
import {
  computeGenericSolidGeometry,
  validateGenericSolidParams,
} from '../../../bim/entities/generic-solid/generic-solid-geometry';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateGenericSolidParamsCommand extends MergeableUpdateCommand<GenericSolidParams> {
  readonly name = 'UpdateGenericSolidParams';
  readonly type = 'update-generic-solid-params';

  constructor(
    genericSolidId: string,
    params: GenericSolidParams,
    previousParams: GenericSolidParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(genericSolidId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: GenericSolidParams): void {
    const geometry: GenericSolidGeometry = computeGenericSolidGeometry(params);
    const validation = validateGenericSolidParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: GenericSolidParams): UpdateGenericSolidParamsCommand {
    return new UpdateGenericSolidParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update generic solid params (${this.patch.shape.kind})`;
  }

  /**
   * Φρουρεί το ίχνος + τις διαστάσεις: μη-πεπερασμένη θέση/περιστροφή ή σκληρό σφάλμα σχήματος
   * (μη-θετική διάσταση, πρίσμα < 3 πλευρές) → απόρριψη. Ο έλεγχος διαστάσεων ζει στο SSoT
   * `validateGenericSolidParams`, όχι εδώ — μηδέν διπλή λογική.
   */
  validate(): string | null {
    if (!this.entityId) return 'Generic solid entity ID is required';
    if (!Number.isFinite(this.patch.rotationDeg)) return 'rotationDeg must be finite';
    if (!Number.isFinite(this.patch.position.x) || !Number.isFinite(this.patch.position.y)) {
      return 'position must be finite';
    }
    const { hardErrors } = validateGenericSolidParams(this.patch);
    if (hardErrors.length > 0) return hardErrors[0];
    return null;
  }
}
