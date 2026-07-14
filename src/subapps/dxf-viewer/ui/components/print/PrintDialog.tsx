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
import {
  suggestPaperSpec,
  type DrawingExtentMm,
} from '../../../text-engine/title-block/suggest-paper';
import type {
  SheetIdentityEdits,
  SheetRow,
} from '../../../text-engine/title-block/sheet-set';
import { usePrintDialogState } from './usePrintDialogState';
import { PrintPaperControls } from './PrintPaperControls';
import { PrintOutputControls } from './PrintOutputControls';
import { PrintComplianceHint } from './PrintComplianceHint';
import { SheetSetEditor } from './SheetSetEditor';
import { useSheetSetEdits } from './useSheetSetEdits';

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
  /**
   * ADR-651 Φάση Ι — οι γραμμές του σετ (ένα φύλλο ανά όροφο), για τον πίνακα μαζικής
   * επεξεργασίας αριθμού/τίτλου. Τις χτίζει ο host από τα levels (`buildSheetRows`).
   */
  readonly sheetRows?: readonly SheetRow[];
  /**
   * ADR-651 §8 #9 — το bbox του ενεργού σχεδίου σε **mm μοντέλου** (ο host το βγάζει με
   * `drawingExtentMmOf`). Τροφοδοτεί την **πρόταση χαρτιού**· `null` ⇒ καμία πρόταση.
   */
  readonly drawingExtentMm?: DrawingExtentMm | null;
  /**
   * Executes the print job (PrintHost → runPrint / runPrintSet). Τα `edits` είναι οι
   * pending αλλαγές ταυτότητας φύλλων: ο host τις **γράφει** στους ορόφους ΚΑΙ τις τυπώνει
   * (μηδέν race με το Firestore snapshot — N.7.2 #2).
   */
  readonly onSubmit: (request: PrintRequest, edits: SheetIdentityEdits) => Promise<void>;
}

export function PrintDialog({
  open,
  onOpenChange,
  canPrint3d,
  titleBlockMissing = false,
  sheetCount = 1,
  sheetRows = [],
  drawingExtentMm = null,
  onSubmit,
}: PrintDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = usePrintDialogState(canPrint3d);
  const sheetEdits = useSheetSetEdits(sheetRows);
  const [busy, setBusy] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  // ADR-651 §8 #9 — δεύτερος καταναλωτής της ΙΔΙΑΣ καθαρής συνάρτησης με το in-scene εργαλείο.
  // Νόημα έχει μόνο σε τυπωμένη κλίμακα (στο fit-to-page **κάθε** χαρτί «χωράει» εξ ορισμού) και
  // σε 2Δ. Δεν προτείνουμε ό,τι έχει ήδη επιλέξει ο χρήστης — καμία θορυβώδης αυτονόητη γραμμή.
  const suggestedPaper = React.useMemo(() => {
    if (!drawingExtentMm || state.source === '3d' || state.fitMode !== 'drawing-scale') return null;
    const spec = suggestPaperSpec(drawingExtentMm, state.scaleDenominator);
    const sameAsChosen = spec.size === state.size && spec.orientation === state.orientation;
    return sameAsChosen ? null : spec;
  }, [
    drawingExtentMm,
    state.source,
    state.fitMode,
    state.scaleDenominator,
    state.size,
    state.orientation,
  ]);

  const applySuggestedPaper = React.useCallback(() => {
    if (!suggestedPaper) return;
    state.setSize(suggestedPaper.size);
    state.setOrientation(suggestedPaper.orientation);
  }, [suggestedPaper, state]);

  // Ο πίνακας φύλλων εμφανίζεται μόνο όταν τυπώνεται όντως σετ (2Δ, ≥2 φύλλα) — ίδιος
  // κανόνας με το checkbox «όλο το σετ», μία αλήθεια για το «υπάρχει σετ;».
  const editingSet = state.wholeSet && state.source === '2d' && sheetRows.length >= 2;

  const handleSubmit = React.useCallback(async () => {
    setBusy(true);
    setHasError(false);
    try {
      await onSubmit(state.buildRequest(), sheetEdits.edits);
      onOpenChange(false);
    } catch (error) {
      setHasError(true);
      logger.error('Print job failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setBusy(false);
    }
  }, [onSubmit, state, sheetEdits.edits, onOpenChange]);

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
            suggestion={suggestedPaper}
            onApplySuggestion={applySuggestedPaper}
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

        {/* ADR-651 Φάση Ι — αριθμός & τίτλος ανά φύλλο + μαζική επαναρίθμηση (must-have #3).
            Ό,τι είναι ΚΟΙΝΟ στα φύλλα δεν ζει εδώ: το αλλάζεις μία φορά στο πρότυπο/έργο. */}
        {editingSet && (
          <SheetSetEditor rows={sheetRows} state={sheetEdits} disabled={busy} />
        )}

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
