/**
 * 🗑️ Trash Actions Bar — Toolbar for trash view mode
 *
 * Shows restore/permanent-delete actions + auto-purge warning banner.
 * Appears above the contacts list when trash mode is active.
 *
 * @module components/contacts/trash/TrashActionsBar
 * @enterprise ADR-191 pattern — Soft-delete lifecycle management
 */

'use client';

import '@/lib/design-system';
import { EntityTrashActionsBar } from '@/components/shared/trash/EntityTrashActionsBar';
import { useTranslation } from '@/i18n';
import { restoreMultipleDeletedContactsWithPolicy } from '@/services/contact-mutation-gateway';

interface TrashActionsBarProps {
  selectedIds: string[];
  onBack: () => void;
  /** Called after restore/error to refresh list AND clear stale selection */
  onRefresh: () => void;
  onPermanentDelete: (ids?: string[]) => void;
  trashCount: number;
  /** ID of the contact currently viewed in the detail panel (fallback when no multi-select) */
  activeContactId?: string | null;
}

/** Οι επαφές επανέρχονται μέσω πολιτικής· σε αποτυχία (π.χ. 409 «ήδη επανήλθε») η λίστα ανανεώνεται ούτως ή άλλως. */
const restoreContacts = (ids: string[]) => restoreMultipleDeletedContactsWithPolicy({ ids });

export function TrashActionsBar({ activeContactId, ...bar }: TrashActionsBarProps) {
  const { t } = useTranslation('contacts-lifecycle');
  return (
    <EntityTrashActionsBar
      {...bar}
      activeId={activeContactId}
      entity="contacts"
      restore={restoreContacts}
      text={{
        back: t('trash.backToContacts'),
        warning: t('trash.autoDeleteWarning'),
        restoreSuccess: (count) => t('trash.restoreSuccess', { count }),
        restoreFailed: t('trash.restoreFailed'),
      }}
    />
  );
}
