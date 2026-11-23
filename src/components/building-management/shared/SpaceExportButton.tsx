'use client';

/**
 * @fileoverview **Το κουμπί «Εξαγωγή XLSX»** των καρτελών κτιρίου (ADR-898 Φ4β) — ένα, για Μονάδες · Αποθήκες · Στάθμευση
 * (μέσα στο `BuildingSpaceFilterBar`) και Αντικειμενική. Η κατάσταση έρχεται από το `useExportAction`.
 * @module components/building-management/shared/SpaceExportButton
 * @related components/shared/ExportFileButton.tsx (η ΜΙΑ παρουσίαση — εδώ μόνο οι λέξεις και το εικονίδιο του XLSX)
 *
 * ⛔ **Κανένα κουμπί που δεν κάνει τίποτα**: το component ζητά `action` — χωρίς ενέργεια εξαγωγής **δεν** ζωγραφίζεται.
 */

import { FileSpreadsheet } from 'lucide-react';

import { ExportFileButton } from '@/components/shared/ExportFileButton';
import type { ExportAction } from '@/hooks/useExportAction';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface SpaceExportButtonProps {
  readonly action: ExportAction;
  /** Η θέση του μηνύματος αποτυχίας — `end` όταν το κουμπί κάθεται στη δεξιά άκρη μιας λωρίδας. */
  readonly align?: 'start' | 'end';
}

export function SpaceExportButton({ action, align = 'end' }: SpaceExportButtonProps) {
  const { t } = useTranslation('building-storage');
  const labels = { idle: t('spaceExport.button'), busy: t('spaceExport.busy'), failed: t('spaceExport.failed') };
  return <ExportFileButton action={action} icon={FileSpreadsheet} labels={labels} align={align} />;
}
