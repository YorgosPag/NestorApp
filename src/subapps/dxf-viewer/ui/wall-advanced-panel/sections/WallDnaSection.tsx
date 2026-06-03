'use client';

/**
 * ADR-363 Phase 1D — WallDna Editor section ("Σύνθεση Στρώσεων") for a placed
 * wall INSTANCE.
 *
 * Thin wrapper (ADR-412 Φ5 Boy-Scout): the layer-editing UI now lives in the
 * entity-agnostic `WallDnaEditor`. This wrapper binds it to the selected
 * `WallEntity` + `dispatchPatch`, preserving the SSoT contract
 * (`thickness === dna.totalThickness`) across the ribbon/panel/grip write paths.
 * Detach keeps the wall's current manual thickness (Revit Generic Wall).
 *
 * @see WallDnaEditor.tsx — the shared editor core
 * @see ../commands/dispatchWallParamPatch.ts — UpdateWallParamsCommand sink
 */

import React, { useCallback } from 'react';
import type { BimMaterial } from '../../../bim/types/bim-material-types';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { WallDna } from '../../../bim/types/wall-dna-types';
import type { DispatchWallParamPatch } from '../commands/dispatchWallParamPatch';
import { WallDnaEditor } from './WallDnaEditor';

export interface WallDnaSectionProps {
  readonly wall: WallEntity;
  readonly dispatchPatch: DispatchWallParamPatch;
  readonly libraryMaterials?: readonly BimMaterial[];
  readonly libraryLoading?: boolean;
}

export function WallDnaSection({
  wall,
  dispatchPatch,
  libraryMaterials = [],
  libraryLoading = false,
}: WallDnaSectionProps): React.ReactElement {
  const onChange = useCallback(
    (next: WallDna | undefined): void => {
      // With DNA: write both dna + derived thickness (SSoT invariant).
      // Detach: drop dna only, keep the wall's current manual thickness.
      if (next) dispatchPatch(wall, { dna: next, thickness: next.totalThickness });
      else dispatchPatch(wall, { dna: undefined });
    },
    [wall, dispatchPatch],
  );

  return (
    <WallDnaEditor
      dna={wall.params.dna}
      category={wall.params.category}
      fallbackThickness={wall.params.thickness}
      onChange={onChange}
      libraryMaterials={libraryMaterials}
      libraryLoading={libraryLoading}
    />
  );
}
