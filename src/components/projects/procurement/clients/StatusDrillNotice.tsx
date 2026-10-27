'use client';

/**
 * StatusDrillNotice — Η ορατή ένδειξη ότι η λίστα είναι φιλτραρισμένη από drill-down (ADR-330 §5.1 S3.1).
 *
 * Κανένα κρυφό φίλτρο: ο άνθρωπος βλέπει ΤΙ φιλτράρει τη λίστα και το αφαιρεί με ένα κλικ
 * (το ίδιο πρότυπο με τα «chips» ενεργού φίλτρου των Linear / Jira).
 */

import { Filter, X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';

interface StatusDrillNoticeProps {
  /** Μεταφρασμένες ετικέτες των ενεργών καταστάσεων. */
  labels: readonly string[];
  onClear: () => void;
}

export function StatusDrillNotice({ labels, onClear }: StatusDrillNoticeProps) {
  const { t } = useTranslation('procurement');
  if (labels.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
    >
      <p className="flex items-center gap-2 text-muted-foreground">
        <Filter className="h-4 w-4 shrink-0" aria-hidden />
        {t('overview.drill.activeFilter', { statuses: labels.join(', ') })}
      </p>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="mr-1 h-4 w-4" aria-hidden />
        {t('overview.drill.clear')}
      </Button>
    </aside>
  );
}
