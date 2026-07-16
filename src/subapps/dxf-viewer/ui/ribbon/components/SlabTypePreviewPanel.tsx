'use client';

/**
 * SlabTypePreviewPanel (ADR-412/ADR-414) — live 3D preview for the «Edit Slab
 * Type» dialog (and, unchanged, the roof one — roof DNA IS `SlabDna`).
 *
 * The whole shell — mount/dispose, prop→renderer effects, texture-version swap,
 * pointer→pick, markup — lives in the shared `BandStackPreviewPanel` SSoT. This
 * file binds it to the slab renderer + the slab i18n keys, and nothing else.
 *
 * @see BandStackPreviewPanel.tsx — the shared panel
 * @see ../../../bim-3d/preview/SlabTypePreviewRenderer.ts — the mini renderer
 */

import React, { useCallback } from 'react';
import type { SlabDna } from '../../../bim/types/slab-dna-types';
import { SlabTypePreviewRenderer } from '../../../bim-3d/preview/SlabTypePreviewRenderer';
import { BandStackPreviewPanel } from './BandStackPreviewPanel';

export interface SlabTypePreviewPanelProps {
  readonly dna: SlabDna | undefined;
  readonly highlightLayerId: string | null;
  readonly onHighlightLayer: (layerId: string | null) => void;
}

export function SlabTypePreviewPanel({
  dna,
  highlightLayerId,
  onHighlightLayer,
}: SlabTypePreviewPanelProps): React.ReactElement {
  const createRenderer = useCallback(
    (container: HTMLElement) => new SlabTypePreviewRenderer(container),
    [],
  );

  return (
    <BandStackPreviewPanel
      dna={dna}
      highlightLayerId={highlightLayerId}
      onHighlightLayer={onHighlightLayer}
      createRenderer={createRenderer}
      titleKey="ribbon.commands.slabFamilyType.preview.title"
      emptyHintKey="ribbon.commands.slabFamilyType.preview.emptyHint"
    />
  );
}
