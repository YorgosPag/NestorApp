'use client';

/**
 * @fileoverview **Το κουμπί «Εξαγωγή XLSX»** των καρτελών κτιρίου (ADR-898 Φ4β) — ένα, για Μονάδες · Αποθήκες · Στάθμευση
 * (μέσα στο `BuildingSpaceFilterBar`) και Αντικειμενική. Η κατάσταση έρχεται από το `useExportAction`.
 * @module components/building-management/shared/SpaceExportButton
 *
 * ⛔ **Κανένα κουμπί που δεν κάνει τίποτα**: το component ζητά `action` — χωρίς ενέργεια εξαγωγής **δεν** ζωγραφίζεται.
 */

import { FileSpreadsheet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { ExportAction } from './useExportAction';

export interface SpaceExportButtonProps {
  readonly action: ExportAction;
  /** Η θέση του μηνύματος αποτυχίας — `end` όταν το κουμπί κάθεται στη δεξιά άκρη μιας λωρίδας. */
  readonly align?: 'start' | 'end';
}

export function SpaceExportButton({ action, align = 'end' }: SpaceExportButtonProps) {
  const { t } = useTranslation('building-storage');
  const iconSizes = useIconSizes();
  const busy = action.status === 'busy';
  return (
    <span className={`flex flex-col gap-1 ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <Button type="button" variant="outline" className="flex w-full items-center gap-2" disabled={busy} aria-busy={busy} onClick={action.trigger}>
        <FileSpreadsheet className={iconSizes.sm} aria-hidden="true" />
        {t(busy ? 'spaceExport.busy' : 'spaceExport.button')}
      </Button>
      {action.status === 'failed' && (
        <span role="alert" className="text-xs text-destructive">{t('spaceExport.failed')}</span>
      )}
    </span>
  );
}
