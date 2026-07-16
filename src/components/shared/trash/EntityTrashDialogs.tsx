'use client';

/**
 * EntityTrashDialogs — the two confirmations of the trash lifecycle, once.
 *
 * Deleting an entity here is two decisions, never one: **bin it** (reversible, ADR-281 soft delete)
 * and later **destroy it** (irreversible). Every page with a trash view — Buildings, Projects,
 * Parking, Storages — therefore ends with exactly this pair, and all four had grown their own copy.
 * They render together because they ARE one flow; splitting them into two props bundles at the call
 * site is what let them drift apart in the first place.
 *
 * Two rules are encoded here so no page can forget them:
 * - While the ADR-226 deletion guard is still checking whether the delete is allowed, soft-delete
 *   confirm stays disabled. Otherwise the user can confirm before the answer arrives — the very
 *   race the guard exists to prevent.
 * - Permanent-delete confirm stays disabled on an empty selection.
 *
 * Wording stays with the caller: «Delete building "Α3"» is the entity's own voice. The permanent
 * dialog's copy does NOT — «this cannot be undone» is the same sentence for every entity, so it
 * lives here, in the `trash` namespace.
 *
 * Pairs 1:1 with `useEntityTrashState` — its `showPermanentDeleteDialog` /
 * `pendingPermanentDeleteIds` / `handleConfirmPermanentDelete` / `handleCancelPermanentDelete` map
 * straight onto `permanentDelete` — but takes plain values, not the hook's shape.
 *
 * @component
 * @enterprise ADR-226 — Deletion Guard · ADR-281 — SSOT Soft-Delete System · ADR-584 — Anti-Duplication
 */

import { DeleteConfirmDialog, SoftDeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** «Move it to the trash» — reversible. Wording is the entity's own. */
interface SoftDeleteSpec {
  /** Whether the confirmation is showing — typically `!!entityToDelete`. */
  open: boolean;
  /** Heading, already translated and entity-specific. */
  title: string;
  /** Body copy, already translated and entity-specific. */
  description: string;
  onConfirm: () => void | Promise<void>;
  /** Dismissed by any means (Escape, overlay, Cancel). */
  onCancel: () => void;
  /** The delete request is in flight. */
  deleting?: boolean;
  /** ADR-226 — the guard has not yet answered whether this delete is allowed. */
  checking?: boolean;
}

/** «Destroy it for good» — irreversible. Wording is shared across every entity. */
interface PermanentDeleteSpec {
  open: boolean;
  /** The staged ids. An empty selection leaves confirm disabled. */
  pendingIds: readonly string[];
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

interface EntityTrashDialogsProps {
  softDelete: SoftDeleteSpec;
  permanentDelete: PermanentDeleteSpec;
}

export function EntityTrashDialogs({ softDelete, permanentDelete }: EntityTrashDialogsProps) {
  const { t } = useTranslation('trash');

  return (
    <>
      <SoftDeleteConfirmDialog
        open={softDelete.open}
        onOpenChange={(next) => { if (!next) softDelete.onCancel(); }}
        title={softDelete.title}
        description={softDelete.description}
        onConfirm={softDelete.onConfirm}
        loading={softDelete.deleting ?? false}
        disabled={softDelete.checking ?? false}
      />

      <DeleteConfirmDialog
        open={permanentDelete.open}
        onOpenChange={(next) => { if (!next) permanentDelete.onCancel(); }}
        title={t('permanentDeleteDialog.title')}
        description={t('permanentDeleteDialog.body')}
        onConfirm={permanentDelete.onConfirm}
        loading={false}
        disabled={permanentDelete.pendingIds.length === 0}
      />
    </>
  );
}
