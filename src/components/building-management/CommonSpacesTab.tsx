/**
 * CommonSpacesTab — Κοινόχρηστοι χώροι κτιρίου (ADR-931)
 *
 * Λίστα (ζωντανή), δημιουργία/επεξεργασία σε διάλογο, μεταφορά στον κάδο. Τα δομικά κομμάτια
 * (πίνακας, κεφαλίδα, banner, επιβεβαίωση, στήλες ορόφου/εμβαδού) είναι τα **κοινά** των χώρων
 * κτιρίου (ADR-184)· εδώ μόνο συντίθενται.
 *
 * @module components/building-management/CommonSpacesTab
 */

'use client';

import { Plus, Users } from 'lucide-react';
import type { Building } from '@/types/building/contracts';
import type { CommonSpace } from '@/types/common-space';
import { Button } from '@/components/ui/button';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { BuildingSpaceConfirmDialog, BuildingSpaceTable, BuildingSpaceWarningBanner } from './shared';
import { BuildingSpaceTabHeader } from './shared/BuildingSpaceTabHeader';
import { CommonSpaceFormDialog } from './CommonSpacesTab/CommonSpaceFormDialog';
import { useCommonSpaceColumns } from './CommonSpacesTab/useCommonSpaceColumns';
import { useCommonSpacesTabState } from './CommonSpacesTab/useCommonSpacesTabState';

const KEY = 'tab';

type TabState = ReturnType<typeof useCommonSpacesTabState>;

/** Ο διάλογος φόρμας + η επιβεβαίωση κάδου — χωριστά, ώστε η καρτέλα να μένει σύνθεση. */
function CommonSpacesTabDialogs({ s, buildingId }: { readonly s: TabState; readonly buildingId: string }) {
  return (
    <>
      {s.form && (
        <CommonSpaceFormDialog
          open
          mode={s.form.editing ? 'edit' : 'create'}
          buildingId={buildingId}
          draft={s.form.draft}
          error={s.form.error}
          saving={s.saving}
          propertyOptions={s.propertyOptions}
          onChange={s.changeDraft}
          onSubmit={s.submit}
          onClose={s.closeForm}
        />
      )}

      <BuildingSpaceConfirmDialog
        open={!!s.confirmDelete}
        onOpenChange={(open) => { if (!open) s.setConfirmDelete(null); }}
        title={s.t(`${KEY}.delete.title`)}
        description={<>{s.t(`${KEY}.delete.description`)} <strong>{s.confirmDelete?.name}</strong></>}
        confirmLabel={s.t(`${KEY}.delete.confirm`)}
        onConfirm={s.confirmDeletion}
        loading={s.deleting}
        variant="destructive"
      />
    </>
  );
}

interface CommonSpacesTabProps {
  readonly building: Building;
}

export function CommonSpacesTab({ building }: CommonSpacesTabProps) {
  const s = useCommonSpacesTabState(building.id);
  const columns = useCommonSpaceColumns(s.t);
  const colors = useSemanticColors();
  const items = [...s.commonSpaces];

  if (s.loading) {
    return (
      <section className="flex justify-center py-6" role="status" aria-live="polite">
        <Spinner size="large" />
        <span className="sr-only">{s.t(`${KEY}.loading`)}</span>
      </section>
    );
  }
  if (s.error) return <p role="alert" className={cn('p-4 text-sm', colors.text.error)}>{s.t(`${KEY}.loadError`)}</p>;

  return (
    <section className="flex flex-col gap-2 p-2">
      <BuildingSpaceTabHeader icon={<Users className={cn('h-5 w-5 shrink-0', colors.text.info)} />} title={s.t('headerTitle')} count={items.length}>
        <Button size="sm" onClick={s.openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          {s.t(`${KEY}.add`)}
        </Button>
      </BuildingSpaceTabHeader>

      {items.length === 0 ? (
        <BuildingSpaceWarningBanner title={s.t(`${KEY}.empty`)} hint={s.t(`${KEY}.emptyHint`)} addLabel={s.t(`${KEY}.add`)} onAdd={s.openCreate} />
      ) : (
        <BuildingSpaceTable<CommonSpace>
          items={items}
          columns={columns}
          getKey={(space) => space.id}
          actions={{ onEdit: s.openEdit, onDelete: s.setConfirmDelete }}
          actionState={{ deletingId: s.deleting ? s.confirmDelete?.id ?? null : null }}
        />
      )}

      <CommonSpacesTabDialogs s={s} buildingId={building.id} />
    </section>
  );
}
