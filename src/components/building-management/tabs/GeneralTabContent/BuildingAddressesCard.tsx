'use client';

import React from 'react';
import { MapPin, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { BuildingAddressesEditor } from './building-addresses-card/BuildingAddressesEditor';
import { BuildingAddressesMapPane } from './building-addresses-card/BuildingAddressesMapPane';
import { BuildingAddressesManualList } from './building-addresses-card/BuildingAddressesManualList';
import { BuildingAddressesProjectSelection } from './building-addresses-card/BuildingAddressesProjectSelection';
import { useBuildingAddressesCardState } from './building-addresses-card/useBuildingAddressesCardState';
import type { BuildingAddressesCardProps } from './building-addresses-card/building-addresses-card-types';

export function BuildingAddressesCard(props: BuildingAddressesCardProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const { t } = useTranslation('building');
  const colors = useSemanticColors();
  const router = useRouter();
  const {
    hasProject,
    localAddresses,
    projectAddresses,
    loadingProject,
    isSaving,
    selectedCount,
    isInlineFormActive,
    editorMode,
    editorIndex,
    editorDragAddress,
    dialogProps,
    isAddressSelected,
    openCreateEditor,
    openEditEditor,
    cancelEditor,
    setEditorAddress,
    setEditorDragAddress,
    saveEditor,
    toggleProjectAddress,
    setProjectPrimaryAddress,
    setManualPrimaryAddress,
    deleteManualAddress,
    handleMarkerClick,
  } = useBuildingAddressesCardState(props);

  const currentEditAddress = editorMode === 'edit' && editorIndex !== null
    ? localAddresses[editorIndex]
    : undefined;

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className={cn('flex items-center gap-2', typography.heading.lg)}>
            <MapPin className={iconSizes.lg} />
            {t('address.labels.title')}
            {selectedCount > 0 && <Badge variant="secondary">{selectedCount}</Badge>}
          </h2>
          {hasProject && (
            <p className={cn('text-sm mt-1', colors.text.muted)}>
              {t('address.labels.selectFromProject')}
            </p>
          )}
        </div>

        {!hasProject && !isInlineFormActive && (
          <Button onClick={openCreateEditor} variant="default" size="sm">
            <Plus className={`${iconSizes.sm} mr-2`} />
            {t('address.labels.addAddress')}
          </Button>
        )}
      </header>

      {editorMode && (
        <BuildingAddressesEditor
          mode={editorMode}
          initialValues={currentEditAddress}
          externalValues={editorDragAddress}
          onExternalValuesChange={setEditorDragAddress}
          onChange={setEditorAddress}
          onCancel={cancelEditor}
          onSave={() => {
            void saveEditor();
          }}
          isSaving={isSaving}
        />
      )}

      {!isInlineFormActive && (
        <>
          {hasProject && loadingProject && (
            <section className={cn('flex items-center justify-center gap-2 py-2', colors.text.muted)}>
              <Spinner />
              <span>{t('address.labels.loadingProjectAddresses')}</span>
            </section>
          )}

          {hasProject && !loadingProject && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BuildingAddressesProjectSelection
                localAddresses={localAddresses}
                projectAddresses={projectAddresses}
                isSaving={isSaving}
                selectedCount={selectedCount}
                isAddressSelected={isAddressSelected}
                onToggleProjectAddress={toggleProjectAddress}
                onSetPrimary={setProjectPrimaryAddress}
                onOpenProjectLocations={() => router.push(`/projects?projectId=${props.projectId}&tab=locations`)}
              />
              <BuildingAddressesMapPane
                addresses={localAddresses}
                onMarkerClick={handleMarkerClick}
              />
            </div>
          )}

          {!hasProject && localAddresses.length === 0 && (
            <section className="text-center py-2 border-2 border-dashed rounded-lg">
              <MapPin className={`${iconSizes.xl} mx-auto mb-2 ${colors.text.muted}`} />
              <h3 className="text-lg font-semibold mb-2">{t('address.labels.noAddresses')}</h3>
              <p className={cn('text-sm mb-2', colors.text.muted)}>
                {t('address.labels.addFirstAddress')}
              </p>
              <Button onClick={openCreateEditor}>
                <Plus className={`${iconSizes.sm} mr-2`} />
                {t('address.labels.addAddress')}
              </Button>
            </section>
          )}

          {!hasProject && localAddresses.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BuildingAddressesManualList
                localAddresses={localAddresses}
                onSetPrimary={setManualPrimaryAddress}
                onEdit={openEditEditor}
                onDelete={deleteManualAddress}
              />
              <BuildingAddressesMapPane
                addresses={localAddresses}
                onMarkerClick={handleMarkerClick}
              />
            </div>
          )}
        </>
      )}

      <ConfirmDialog {...dialogProps} />
    </section>
  );
}
