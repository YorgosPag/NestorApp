'use client';

/**
 * ============================================================================
 * useDxfImportNotifications — DXF import notifications (SSoT, ADR-635 Φ3)
 * ============================================================================
 *
 * Owns the Revit-style "Import Warnings" toast for DXF import. Both import paths
 * (client-side `dxfImportService` and the server `/api/floorplans/process` route)
 * dispatch through this ONE hook, so the "when to fire" lives in one place and the
 * i18n key routing is not duplicated.
 *
 * The toast title is localized (count-aware, ICU plural); the detail lines are the
 * server/parser-provided technical diagnostics (entity types, clamp reasons) shown
 * verbatim — the same raw-detail pattern already used by `useFilesNotifications`
 * for server messages.
 *
 * @module hooks/notifications/useDxfImportNotifications
 * @see src/config/notification-keys.ts — SSoT for keys (NOTIFICATION_KEYS.dxfImport)
 * @see src/subapps/dxf-viewer/utils/dxf-import-diagnostics.ts — summarizeDiagnostics
 */

import { useMemo } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { translateOnDemand } from '@/i18n/translate-on-demand';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';

export interface DxfImportNotifications {
  /** Warn about a partial import. No-op when there are no warnings. */
  readonly importedWithWarnings: (warnings: string[] | undefined) => void;
}

/**
 * ADR-280 §11.8 Β3 — ο τίτλος μεταφράζεται **τη στιγμή της ειδοποίησης** (`translateOnDemand`), όχι με
 * `useTranslation(['dxf-viewer'])` στο mount: εκείνο φόρτωνε και τα 6 compat splits (594,5 KB) σε **κάθε** οθόνη με
 * καρτέλα αρχείων, για ένα μήνυμα που εμφανίζεται μόνο μετά από ασύγχρονη επεξεργασία κάτοψης.
 */
export function useDxfImportNotifications(): DxfImportNotifications {
  const { warning } = useNotifications();

  return useMemo<DxfImportNotifications>(
    () => ({
      importedWithWarnings: (warnings) => {
        if (!warnings || warnings.length === 0) return;
        const details = warnings.join('\n');
        void translateOnDemand(NOTIFICATION_KEYS.dxfImport.importedWithWarnings, { count: warnings.length })
          .then((title) => warning(`${title}\n${details}`));
      },
    }),
    [warning],
  );
}
