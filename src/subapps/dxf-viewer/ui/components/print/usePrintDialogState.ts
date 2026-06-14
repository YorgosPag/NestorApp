'use client';

/**
 * ADR-453 — Print dialog · form state hook.
 *
 * Owns the PrintDialog's session form fields and derives a `PrintRequest`.
 * Pure-ish (React state only) — no capture/PDF/IO here.
 *
 * @module subapps/dxf-viewer/ui/components/print/usePrintDialogState
 */

import * as React from 'react';
import type {
  FitMode,
  OutputTarget,
  PaperOrientation,
  PaperSize,
  PrintPlotStyle,
  PrintRequest,
  PrintSource,
} from '../../../print/config/paper-types';

export interface PrintDialogState {
  source: PrintSource;
  setSource: (s: PrintSource) => void;
  size: PaperSize;
  setSize: (s: PaperSize) => void;
  orientation: PaperOrientation;
  setOrientation: (o: PaperOrientation) => void;
  fitMode: FitMode;
  setFitMode: (f: FitMode) => void;
  scaleDenominator: number;
  setScaleDenominator: (n: number) => void;
  plotStyle: PrintPlotStyle;
  setPlotStyle: (p: PrintPlotStyle) => void;
  target: OutputTarget;
  setTarget: (t: OutputTarget) => void;
  includeTitleBlock: boolean;
  setIncludeTitleBlock: (v: boolean) => void;
  buildRequest: () => PrintRequest;
}

export function usePrintDialogState(canPrint3d: boolean): PrintDialogState {
  const [source, setSource] = React.useState<PrintSource>('2d');
  const [size, setSize] = React.useState<PaperSize>('A3');
  const [orientation, setOrientation] = React.useState<PaperOrientation>('landscape');
  const [fitMode, setFitMode] = React.useState<FitMode>('fit-to-page');
  const [scaleDenominator, setScaleDenominator] = React.useState<number>(100);
  // ADR-454 — default 'colour' (white-safe: keeps BIM category colours, white→black).
  const [plotStyle, setPlotStyle] = React.useState<PrintPlotStyle>('colour');
  const [target, setTarget] = React.useState<OutputTarget>('save-pdf');
  const [includeTitleBlock, setIncludeTitleBlock] = React.useState<boolean>(true);

  // 3D has no real-world 1:N → coerce fit mode + source back to valid combos.
  const effectiveSource: PrintSource = source === '3d' && !canPrint3d ? '2d' : source;
  const effectiveFitMode: FitMode =
    effectiveSource === '3d' ? 'fit-to-page' : fitMode;

  const buildRequest = React.useCallback((): PrintRequest => {
    const src: PrintSource = source === '3d' && !canPrint3d ? '2d' : source;
    const fit: FitMode = src === '3d' ? 'fit-to-page' : fitMode;
    return {
      source: src,
      paper: { size, orientation },
      fitMode: fit,
      target,
      includeTitleBlock,
      scaleDenominator: fit === 'drawing-scale' ? scaleDenominator : undefined,
      // ADR-454 — plot style applies to 2D only (3D is WYSIWYG real materials).
      plotStyle: src === '2d' ? plotStyle : undefined,
    };
  }, [source, canPrint3d, fitMode, size, orientation, target, scaleDenominator, plotStyle, includeTitleBlock]);

  return {
    source: effectiveSource,
    setSource,
    size,
    setSize,
    orientation,
    setOrientation,
    fitMode: effectiveFitMode,
    setFitMode,
    scaleDenominator,
    setScaleDenominator,
    plotStyle,
    setPlotStyle,
    target,
    setTarget,
    includeTitleBlock,
    setIncludeTitleBlock,
    buildRequest,
  };
}
