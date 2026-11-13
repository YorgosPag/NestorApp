'use client';

/**
 * ADR-941 Φ1 — «Εισαγωγή γραμμών και κειμένων από το PDF»: όταν το υπόβαθρο είναι **διανυσματικό** PDF, οι γραμμές και τα
 * κείμενα έρχονται όπως είναι στο αρχείο (AutoCAD `PDFIMPORT`), αντί να ξαναβρεθούν από την εικόνα. Καθαρή παρουσίαση: η
 * πράξη φεύγει ως callback, το αποτέλεσμα λέγεται ΠΑΝΤΑ με όνομα.
 *
 * @see ../../../app/usePdfVectorImportWiring.ts — η καλωδίωση
 * @see ../../../systems/pdf-vector-import/pdf-vector-import-commit.ts — η εγγραφή
 */

import * as React from 'react';
import { FileInput, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PdfVectorImportOutcome } from '../../../systems/pdf-vector-import/pdf-vector-import-commit';
import { MUTED, type Translate } from './ModelFromDrawingSections';

export interface PdfVectorImportView {
  /** Το υπόβαθρο του ενεργού ορόφου είναι διανυσματικό PDF. */
  readonly available: boolean;
  readonly running: boolean;
  /** Το αποτέλεσμα της τελευταίας εισαγωγής σε αυτό το υπόβαθρο. */
  readonly outcome: PdfVectorImportOutcome | null;
}

/** Κάθε αποτυχία με το δικό της ρητό κλειδί (ορατό στο CHECK 3.8 — κανένα συναρμολογημένο κλειδί). */
const FAILURE_LABEL_KEY: Readonly<Record<Exclude<PdfVectorImportOutcome['kind'], 'imported'>, string>> = {
  'not-vector': 'modelFromDrawing.pdfVector.outcome.notVector',
  'source-changed': 'modelFromDrawing.pdfVector.outcome.sourceChanged',
  refused: 'modelFromDrawing.pdfVector.outcome.refused',
};

function OutcomeMessage({ outcome, t }: { readonly outcome: PdfVectorImportOutcome; readonly t: Translate }): React.ReactElement {
  if (outcome.kind !== 'imported') {
    return <p className="m-0 text-[11px] text-destructive" role="status">{t(FAILURE_LABEL_KEY[outcome.kind])}</p>;
  }
  return (
    <section className="flex flex-col gap-0.5" role="status" data-testid="mfd-pdf-vector-outcome">
      <p className="m-0 text-[11px] text-foreground">
        {t('modelFromDrawing.pdfVector.imported', { lines: outcome.lines, texts: outcome.texts })}
      </p>
      {outcome.replaced > 0 ? <p className={MUTED}>{t('modelFromDrawing.pdfVector.replaced', { count: outcome.replaced })}</p> : null}
      {outcome.skippedFills > 0 ? <p className={MUTED}>{t('modelFromDrawing.pdfVector.skippedFills', { count: outcome.skippedFills })}</p> : null}
    </section>
  );
}

export function PdfVectorImportSection({ view, onImport, t }: {
  readonly view: PdfVectorImportView;
  readonly onImport: () => void;
  readonly t: Translate;
}): React.ReactElement | null {
  if (!view.available) return null;
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-2" data-testid="mfd-pdf-vector-import">
      <p className={MUTED}>{t('modelFromDrawing.pdfVector.hint')}</p>
      <Button type="button" size="sm" variant="default" disabled={view.running} onClick={onImport} data-testid="mfd-pdf-vector-import-run">
        {view.running
          ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          : <FileInput className="size-3.5" aria-hidden="true" />}
        {view.running ? t('modelFromDrawing.pdfVector.running') : t('modelFromDrawing.pdfVector.start')}
      </Button>
      {view.outcome ? <OutcomeMessage outcome={view.outcome} t={t} /> : null}
    </section>
  );
}
