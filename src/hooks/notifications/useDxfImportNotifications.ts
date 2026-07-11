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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';

export interface DxfImportNotifications {
  /** Warn about a partial import. No-op when there are no warnings. */
  readonly importedWithWarnings: (warnings: string[] | undefined) => void;
}

export function useDxfImportNotifications(): DxfImportNotifications {
  const { warning } = useNotifications();
  const { t } = useTranslation(['dxf-viewer']);

  return useMemo<DxfImportNotifications>(
    () => ({
      importedWithWarnings: (warnings) => {
        if (!warnings || warnings.length === 0) return;
        const title = t(NOTIFICATION_KEYS.dxfImport.importedWithWarnings, { count: warnings.length });
        warning(`${title}\n${warnings.join('\n')}`);
      },
    }),
    [warning, t],
  );
}
