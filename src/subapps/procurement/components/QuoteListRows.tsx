'use client';

/**
 * Γραμμές-βοηθοί της QuoteList — placeholder σάρωσης (§5.H) + παλιά έκδοση προσφοράς (§5.AA.6).
 * Εξήχθησαν από το QuoteList.tsx (όριο 500 γραμμών, N.7.1).
 */

import { History, Loader2, XCircle } from 'lucide-react';
import type { Quote } from '@/subapps/procurement/types/quote';
import type { ScanQueueItem } from '../hooks/useScanQueue';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function ScanPlaceholderRow({
  item,
  onRetry,
  onRemove,
}: {
  item: ScanQueueItem;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation(['quotes', 'common']);
  const stageKeys = ['reading', 'extracting', 'validating'] as const;
  const stageLabel = item.stage
    ? t(`rfqs.scan.stage.${stageKeys[item.stage - 1]}`)
    : t('rfqs.scan.stage.processing');

  if (item.status === 'error') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-destructive/50 bg-destructive/5 text-destructive text-xs">
        <XCircle className="size-3 shrink-0" />
        <span className="flex-1 truncate font-medium">{item.fileName}</span>
        <span className="text-destructive/80">{t('rfqs.scan.placeholder.failed')}</span>
        <button type="button" onClick={onRetry} className="underline hover:no-underline shrink-0">
          {t('rfqs.scan.placeholder.retry')}
        </button>
        <button type="button" onClick={onRemove} className="underline hover:no-underline shrink-0">
          {t('rfqs.scan.placeholder.delete')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-primary/30 bg-primary/5 text-xs">
      <Loader2 className="size-3 shrink-0 animate-spin text-[hsl(var(--text-info))]" />
      <span className="flex-1 truncate font-medium">{item.fileName}</span>
      <span className="text-muted-foreground">{stageLabel}</span>
    </div>
  );
}

export function SupersededVersionRow({ quote }: { quote: Quote }) {
  const dateStr = (() => {
    const ts = (quote.submittedAt ?? quote.createdAt) as { seconds: number } | null;
    return ts?.seconds ? new Date(ts.seconds * 1000).toLocaleDateString('el-GR') : '—';
  })();
  return (
    <div className="ml-4 flex items-center gap-2 px-3 py-1.5 rounded border border-dashed border-muted text-muted-foreground text-xs opacity-70">
      <History className="size-3 shrink-0" />
      <span className="font-mono">v{quote.version ?? 1}</span>
      <span className="flex-1 truncate">{formatCurrencyRow(quote.totals.total)}</span>
      <span>{dateStr}</span>
    </div>
  );
}

function formatCurrencyRow(n: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(n);
}
