"use client";

/**
 * BimViewport3DRenderPanel — ADR-366 §B.4/§B.6 render-surface leaf.
 *
 * Owns the floating "Render" trigger button, the in-progress overlay, the
 * incremental DXF-text streaming progress indicator, and the final-render
 * config dialog. Pure presentational wiring — all render orchestration stays
 * in `useBim3DRenderControls` (parent hook); this component only renders the
 * DOM for it.
 *
 * Extracted from BimViewport3D.tsx (Google file-size SSoT, N.7.1): keeps the
 * viewport component a thin ADR-040 leaf while this cluster of render-UI JSX
 * lives here instead.
 */

import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RenderFinalDialog } from '../render/RenderFinalDialog';
import { RenderProgressOverlay } from '../render/RenderProgressOverlay';
// ADR-645 Φάση A — Forge-style «loading %» overlay for the incremental 3D DXF text streaming build.
import { Dxf3dStreamProgressLeaf } from './Dxf3dStreamProgressLeaf';
import type { FinalRenderConfig } from '../stores/ViewMode3DStore';

export interface BimViewport3DRenderPanelProps {
  isRendering: boolean;
  readOnly: boolean;
  renderDialogOpen: boolean;
  setRenderDialogOpen: (open: boolean) => void;
  handleRenderConfirm: (config: FinalRenderConfig) => void;
  handleRenderCancel: () => void;
  handleCalibrateSample: () => void;
  canvasEl: HTMLCanvasElement | null;
}

export function BimViewport3DRenderPanel({
  isRendering,
  readOnly,
  renderDialogOpen,
  setRenderDialogOpen,
  handleRenderConfirm,
  handleRenderCancel,
  handleCalibrateSample,
  canvasEl,
}: BimViewport3DRenderPanelProps) {
  const { t } = useTranslation('bim3d');

  return (
    <>
      {/* Floating Render button — bottom-right, above Performance HUD (ADR-366 §B.4 Phase 6).
          ADR-371: hidden in readOnly mode (Properties pipeline). */}
      {!isRendering && !readOnly && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setRenderDialogOpen(true)}
              aria-label={t('render.button.triggerLabel')}
              className="absolute bottom-14 right-3 z-[70] flex select-none items-center gap-1.5 rounded-md border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-primary/80"
            >
              ✦ {t('render.button.render')}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{t('render.button.triggerLabel')}</TooltipContent>
        </Tooltip>
      )}

      {/* Render progress overlay — visible only during final render. Suppressed in readOnly. */}
      {isRendering && !readOnly && (
        <RenderProgressOverlay onCancel={handleRenderCancel} />
      )}

      {/* ADR-645 Φάση A — incremental 3D DXF text streaming «loading %» (self-hides when idle).
          Shown in readOnly too — the streamed build runs there as well. */}
      <Dxf3dStreamProgressLeaf />

      {/* Render dialog — Radix (ADR-001). Suppressed in readOnly. */}
      {!readOnly && (
        <RenderFinalDialog
          open={renderDialogOpen}
          onOpenChange={setRenderDialogOpen}
          onConfirm={handleRenderConfirm}
          rendererCanvas={canvasEl}
          onCalibrateSample={handleCalibrateSample}
        />
      )}
    </>
  );
}
