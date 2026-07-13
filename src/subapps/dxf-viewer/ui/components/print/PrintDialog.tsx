'use client';

/**
 * ADR-453 — Print/Export dialog (Revit-grade «Εκτύπωση»).
 *
 * Controlled Radix Dialog. Owns the form via `usePrintDialogState` and delegates
 * the actual job to `onSubmit(request)` (wired by PrintHost → `runPrint`). Both
 * 2D and 3D sources, fit-to-page / drawing-scale, save-PDF / open-print.
 *
 * State ownership:
 *   - Dialog owns form fields (usePrintDialogState) + busy/error.
 *   - Parent owns `open` + supplies `onSubmit` + `canPrint3d`.
 *
 * ADR-040: N/A (zero canvas, zero useSyncExternalStore).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-453-dxf-print-export-engine.md
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import type { PrintRequest } from '../../../print/config/paper-types';
import { usePrintDialogState } from './usePrintDialogState';
import { PrintPaperControls } from './PrintPaperControls';
import { PrintOutputControls } from './PrintOutputControls';
import { PrintComplianceHint } from './PrintComplianceHint';

const logger = createModuleLogger('DXF_PRINT_DIALOG');

export interface PrintDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  /** True when a 3D scene is mounted (enables the 3D source option). */
  readonly canPrint3d: boolean;
  /**
   * ADR-651 Απόφαση #10β — το ενεργό σχέδιο δεν έχει πινακίδα: ο διάλογος το λέει και την
   * προσθέτει στο τυπωμένο φύλλο (το checkbox είναι ήδη επιλεγμένο).
   */
  readonly titleBlockMissing?: boolean;
  /**
   * ADR-651 Φάση Ζ — πόσα φύλλα (όροφοι με scene) έχει το έργο· ≥2 ⇒ ο διάλογος προσφέρει
   * «εκτύπωση όλου του σετ» (πολυσέλιδο PDF, αυτόματη αρίθμηση).
   */
  readonly sheetCount?: number;
  /** Executes the print job (PrintHost → runPrint / runPrintSet). */
  readonly onSubmit: (request: PrintRequest) => Promise<void>;
}

export function PrintDialog({
  open,
  onOpenChange,
  canPrint3d,
  titleBlockMissing = false,
  sheetCount = 1,
  onSubmit,
}: PrintDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = usePrintDialogState(canPrint3d);
  const [busy, setBusy] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  const handleSubmit = React.useCallback(async () => {
    setBusy(true);
    setHasError(false);
    try {
      await onSubmit(state.buildRequest());
      onOpenChange(false);
    } catch (error) {
      setHasError(true);
      logger.error('Print job failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setBusy(false);
    }
  }, [onSubmit, state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('print.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('print.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <PrintPaperControls
            size={state.size}
            onSizeChange={state.setSize}
            orientation={state.orientation}
            onOrientationChange={state.setOrientation}
          />
          <PrintOutputControls
            source={state.source}
            onSourceChange={state.setSource}
            canPrint3d={canPrint3d}
            fitMode={state.fitMode}
            onFitModeChange={state.setFitMode}
            scaleDenominator={state.scaleDenominator}
            onScaleChange={state.setScaleDenominator}
            plotStyle={state.plotStyle}
            onPlotStyleChange={state.setPlotStyle}
            outputMode={state.outputMode}
            onOutputModeChange={state.setOutputMode}
            target={state.target}
            onTargetChange={state.setTarget}
            includeTitleBlock={state.includeTitleBlock}
            onIncludeTitleBlockChange={state.setIncludeTitleBlock}
            titleBlockMissing={titleBlockMissing}
            wholeSet={state.wholeSet}
            onWholeSetChange={state.setWholeSet}
            sheetCount={sheetCount}
          />
        </div>

        {/* ADR-651 Φάση Ε (Απόφαση #4) — τι λείπει για κατάθεση· προειδοποίηση, όχι φράγμα. */}
        <PrintComplianceHint
          includeTitleBlock={state.includeTitleBlock}
          fitMode={state.fitMode}
          scaleDenominator={state.scaleDenominator}
        />

        {hasError && (
          <p role="alert" className="text-sm text-destructive">
            {t('print.error')}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('print.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? t('print.printing') : t('print.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
