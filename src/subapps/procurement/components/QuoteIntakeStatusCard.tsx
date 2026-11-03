'use client';

/**
 * QuoteIntakeStatusCard — η κατάσταση της εξαγωγής AI όσο δεν υπάρχουν δεδομένα (ADR-327 §6.10).
 *
 * Spinner **μόνο** σε `extracting`. Σε `failed` / `stalled` ο άνθρωπος δεν περιμένει ποτέ κάτι που δεν θα έρθει:
 * βλέπει τον λόγο και δύο δρόμους — «Επανάληψη» (Rossum: νέα εισαγωγή) ή «Χειροκίνητη καταχώριση» (η προσφορά
 * ανοίγει στην προβολή/επεξεργασία, όπως μια προσφορά πύλης).
 *
 * 🔑 Κωδικός → κείμενο με **στατικές** κλήσεις `t('…')`: δυναμικό κλειδί θα έκανε το route slice να αρνηθεί
 * (ADR-744) και θα έκρυβε τα κλειδιά από το CHECK 3.8.
 */

import { AlertTriangle, Loader2, PenLine, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { QuoteExtractionErrorCode } from '../types/quote';
import type { PendingQuoteIntakeView } from '../utils/quote-intake-view';
import type { RescanError } from '../hooks/useRescanQuote';

type Translate = (key: string) => string;

export interface QuoteIntakeStatusCardProps {
  view: PendingQuoteIntakeView;
  onRetry: () => void;
  onEnterManually: () => void;
  retrying: boolean;
  retryError: RescanError | null;
}

/** Άγνωστος/παλιός κωδικός (αποθηκευμένο έγγραφο) ⇒ γενικό μήνυμα. */
function failureHint(t: Translate, errorCode: QuoteExtractionErrorCode | null): string {
  switch (errorCode) {
    case 'not_a_quote': return t('quotes.scan.notAQuote');
    case 'document_unavailable': return t('quotes.intake.documentUnavailable');
    default: return t('quotes.intake.failedHint');
  }
}

function retryErrorText(t: Translate, error: RescanError): string {
  switch (error) {
    case 'not_retryable': return t('quotes.intake.rescanErrors.not_retryable');
    case 'no_document': return t('quotes.intake.rescanErrors.no_document');
    case 'file_unavailable': return t('quotes.intake.rescanErrors.file_unavailable');
    case 'failed': return t('quotes.intake.rescanErrors.failed');
  }
}

function ExtractingState({ t }: { t: Translate }) {
  return (
    <section role="status" aria-live="polite" className="space-y-2 py-10 text-center">
      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">{t('quotes.scan.processing')}</p>
      <p className="text-xs text-muted-foreground">{t('quotes.scan.processingHint')}</p>
    </section>
  );
}

export function QuoteIntakeStatusCard({ view, onRetry, onEnterManually, retrying, retryError }: QuoteIntakeStatusCardProps) {
  const { t } = useTranslation('quotes');

  if (view.kind === 'extracting') {
    return <Card><CardContent><ExtractingState t={t} /></CardContent></Card>;
  }

  const stalled = view.kind === 'stalled';
  return (
    <Card>
      <CardContent>
        <section role="alert" className="space-y-4 py-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-destructive" aria-hidden="true" />
          <header className="space-y-1">
            <h2 className="text-sm font-semibold">
              {stalled ? t('quotes.intake.stalledTitle') : t('quotes.scan.processingFailed')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {stalled ? t('quotes.intake.stalledHint') : failureHint(t, view.errorCode)}
            </p>
          </header>
          <footer className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" onClick={onRetry} disabled={retrying}>
              {retrying
                ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                : <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />}
              {t('quotes.intake.retry')}
            </Button>
            <Button size="sm" variant="outline" onClick={onEnterManually} disabled={retrying}>
              <PenLine className="mr-1 h-4 w-4" aria-hidden="true" />
              {t('quotes.intake.enterManually')}
            </Button>
          </footer>
          {retryError && <p className="text-xs text-destructive">{retryErrorText(t, retryError)}</p>}
        </section>
      </CardContent>
    </Card>
  );
}
