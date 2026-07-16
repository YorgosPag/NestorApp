'use client';

/**
 * WallTypePreviewPanel (ADR-414) — left-hand live 3D preview for the «Edit Wall
 * Type» dialog.
 *
 * The whole shell — mount/dispose, prop→renderer effects, texture-version swap,
 * pointer→pick, markup — lives in the shared `BandStackPreviewPanel` SSoT. This
 * file binds it to the wall renderer + the wall i18n keys, and nothing else.
 *
 * @see BandStackPreviewPanel.tsx — the shared panel
 * @see ../../../bim-3d/preview/WallTypePreviewRenderer.ts — the mini renderer
 * @see ../wall-advanced-panel/sections/WallDnaEditor.tsx — the editor (rows)
 */

import React, { useCallback } from 'react';
import type { WallDna } from '../../../bim/types/wall-dna-types';
import { WallTypePreviewRenderer } from '../../../bim-3d/preview/WallTypePreviewRenderer';
import { BandStackPreviewPanel } from './BandStackPreviewPanel';

export interface WallTypePreviewPanelProps {
  readonly dna: WallDna | undefined;
  readonly highlightLayerId: string | null;
  readonly onHighlightLayer: (layerId: string | null) => void;
}

export function WallTypePreviewPanel({
  dna,
  highlightLayerId,
  onHighlightLayer,
}: WallTypePreviewPanelProps): React.ReactElement {
  const createRenderer = useCallback(
    (container: HTMLElement) => new WallTypePreviewRenderer(container),
    [],
  );

  return (
    <BandStackPreviewPanel
      dna={dna}
      highlightLayerId={highlightLayerId}
      onHighlightLayer={onHighlightLayer}
      createRenderer={createRenderer}
      titleKey="ribbon.commands.bimFamilyType.preview.title"
      emptyHintKey="ribbon.commands.bimFamilyType.preview.emptyHint"
    />
  );
}
