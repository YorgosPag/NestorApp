'use client';

/**
 * @fileoverview **Το κουμπί που γράφει αρχείο στον δίσκο του ανθρώπου** — η ΜΙΑ παρουσίαση της κατάστασης
 * `useExportAction` (`idle` · `busy` · `failed`): XLSX των καρτελών κτιρίου (ADR-898 Φ4β) · PDF πληροφοριακού
 * υπολογισμού (ADR-947 Φ2β).
 * @module components/shared/ExportFileButton
 * @related hooks/useExportAction.ts · components/building-management/shared/SpaceExportButton.tsx ·
 *   components/objective-value/ObjectiveValuePdfButton.tsx
 *
 * ⛔ **Κανένα κουμπί που δεν κάνει τίποτα**: ζητά `action` — χωρίς ενέργεια εξαγωγής **δεν** ζωγραφίζεται.
 * 🔑 **Οι λέξεις έρχονται από τον καλούντα**: κάθε οθόνη λέει το δικό της αρχείο («Εξαγωγή XLSX» · «Λήψη PDF»), η
 *    συμπεριφορά (όχι δεύτερο κλικ · `aria-busy` · λόγος αποτυχίας με `role="alert"`) είναι μία.
 */

import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ExportAction } from '@/hooks/useExportAction';
import { useIconSizes } from '@/hooks/useIconSizes';

interface ExportFileButtonLabels {
  readonly idle: string;
  readonly busy: string;
  readonly failed: string;
}

interface ExportFileButtonProps {
  readonly action: ExportAction;
  readonly icon: LucideIcon;
  readonly labels: ExportFileButtonLabels;
  /** Η θέση του μηνύματος αποτυχίας — `end` όταν το κουμπί κάθεται στη δεξιά άκρη μιας λωρίδας. */
  readonly align?: 'start' | 'end';
}

export function ExportFileButton({ action, icon: Icon, labels, align = 'end' }: ExportFileButtonProps) {
  const iconSizes = useIconSizes();
  const busy = action.status === 'busy';
  return (
    <span className={`flex flex-col gap-1 ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <Button type="button" variant="outline" className="flex w-full items-center gap-2" disabled={busy} aria-busy={busy} onClick={action.trigger}>
        <Icon className={iconSizes.sm} aria-hidden="true" />
        {busy ? labels.busy : labels.idle}
      </Button>
      {action.status === 'failed' && (
        <span role="alert" className="text-xs text-destructive">{labels.failed}</span>
      )}
    </span>
  );
}
