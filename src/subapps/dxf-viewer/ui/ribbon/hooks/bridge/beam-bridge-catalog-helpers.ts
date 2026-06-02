/**
 * ADR-363 Φ2 — Catalog-change helpers για `useRibbonBeamBridge` (mirror του
 * `column-bridge-catalog-helpers`). Κρατά το bridge hook κάτω από το 500-line
 * όριο (N.7.1). Καλύπτει: εφαρμογή EN 10365 preset (entity path) + custom-
 * sentinel logic (clear catalogProfile σε χειροκίνητη αλλαγή διάστασης).
 *
 * Διαφορά από την κολώνα: το δοκάρι δεν έχει drawing-tool bridge store, οπότε
 * υπάρχει μόνο το entity-edit path· επίσης η επιλογή catalog θέτει ΚΑΙ
 * `sectionKind='I-shape'` (στην κολώνα ο διαχωριστής `kind` είχε ήδη οριστεί).
 */

import type { BeamEntity, BeamIShapeParams, BeamParams } from '../../../../bim/types/beam-types';
import { CATALOG_CUSTOM_SENTINEL, findIShapePreset } from '../../../../bim/columns/section-catalog';
import { BEAM_RIBBON_KEYS } from './beam-command-keys';

// ─── Custom-sentinel guards ──────────────────────────────────────────────────

/**
 * True όταν μια αλλαγή top-level διάστασης (width/depth) πρέπει να καθαρίσει το
 * ενεργό catalog preset. Revit: χειροκίνητη αλλαγή → «Custom».
 */
export function catalogOwnsDimension(commandKey: string, sectionKind?: string): boolean {
  if (sectionKind !== 'I-shape') return false;
  return (
    commandKey === BEAM_RIBBON_KEYS.params.width ||
    commandKey === BEAM_RIBBON_KEYS.params.depth
  );
}

/** True όταν αλλαγή nested param (flange/web) πρέπει να καθαρίσει το catalog. */
export function catalogOwnsNestedParam(commandKey: string, sectionKind?: string): boolean {
  if (sectionKind !== 'I-shape') return false;
  return (
    commandKey === BEAM_RIBBON_KEYS.params.flangeThickness ||
    commandKey === BEAM_RIBBON_KEYS.params.webThickness
  );
}

// ─── Entity path ─────────────────────────────────────────────────────────────

type DispatchParams = (beam: BeamEntity, nextParams: BeamParams) => void;

/**
 * Εφαρμογή EN 10365 preset σε επιλεγμένο δοκάρι. Batch-write όλων των διαστάσεων
 * του preset + `sectionKind='I-shape'` + `catalogProfile` σε ΕΝΑ
 * `UpdateBeamParamsCommand` (single undo). No-op σε 'custom' ή άγνωστο ID.
 */
export function applyEntityBeamCatalogPreset(
  beam: BeamEntity,
  presetId: string,
  dispatchParams: DispatchParams,
): void {
  if (presetId === CATALOG_CUSTOM_SENTINEL) return;
  const preset = findIShapePreset(presetId);
  if (!preset) return;

  const nextIshape: BeamIShapeParams = {
    ...(beam.params.ishape ?? {}),
    flangeThickness: preset.flangeThickness,
    webThickness: preset.webThickness,
  };
  dispatchParams(beam, {
    ...beam.params,
    sectionKind: 'I-shape',
    width: preset.flangeWidth,    // b → BeamParams.width (πλάτος πέλματος = κάτοψη)
    depth: preset.sectionDepth,   // h → BeamParams.depth (δομικό βάθος)
    ishape: nextIshape,
    catalogProfile: preset.id,
    profileDesignation: preset.id.replace('-', ' '), // canvas label ("IPE 300")
  });
}
