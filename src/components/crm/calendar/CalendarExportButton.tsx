/**
 * Calendar export button — triggers print dialog for PDF export.
 * MVP approach using window.print() with @media print CSS.
 */

'use client';

import { useCallback } from 'react';
import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import '@/lib/design-system';

export function CalendarExportButton() {
  const { t } = useTranslation(['crm', 'crm-inbox']);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      className="gap-1.5"
    >
      <Printer className="h-4 w-4" />
      {t('calendarPage.export.print')}
    </Button>
  );
}
