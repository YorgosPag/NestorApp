/**
 * DesktopNavDialogs — All confirmation dialogs and connection modals
 * for the DesktopMultiColumn navigation component.
 *
 * Renders 4 AlertDialogs (company delete, project/building/unit unlink)
 * and 3 SelectItemModal instances (connect project/building/unit).
 */

import '@/lib/design-system';
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SelectItemModal } from '@/components/navigation/dialogs/SelectItemModal';
import { NAVIGATION_ACTIONS } from '@/components/navigation/config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { PendingCompany, PendingEntity } from './desktop-nav-handlers';

// ── Props ──

interface ModalItem {
  id: string;
  name: string;
  subtitle: string;
  [key: string]: unknown;
}

interface DesktopNavDialogsProps {
  // Company deletion dialog
  confirmDialogOpen: boolean;
  onConfirmDialogChange: (open: boolean) => void;
  pendingDeletionCompany: PendingCompany | null;
  onClearPendingCompany: () => void;
  onConfirmCompanyDeletion: () => void;

  // Project unlink dialog
  projectDialogOpen: boolean;
  onProjectDialogChange: (open: boolean) => void;
  pendingUnlinkProject: PendingEntity | null;
  onClearPendingProject: () => void;
  onConfirmProjectUnlink: () => void;

  // Building unlink dialog
  buildingDialogOpen: boolean;
  onBuildingDialogChange: (open: boolean) => void;
  pendingUnlinkBuilding: PendingEntity | null;
  onClearPendingBuilding: () => void;
  onConfirmBuildingUnlink: () => void;

  // Unit unlink dialog
  propertyDialogOpen: boolean;
  onPropertyDialogChange: (open: boolean) => void;
  pendingUnlinkProperty: PendingEntity | null;
  onClearPendingProperty: () => void;
  onConfirmPropertyUnlink: () => void;

  // Connection modals
  isProjectModalOpen: boolean;
  onProjectModalChange: (open: boolean) => void;
  onProjectSelected: (item: { id: string; name: string }) => void;
  availableProjects: ModalItem[];
  selectedCompanyName: string | undefined;

  isBuildingModalOpen: boolean;
  onBuildingModalChange: (open: boolean) => void;
  onBuildingSelected: (item: { id: string; name: string }) => void;
  availableBuildings: ModalItem[];
  selectedProjectName: string | undefined;

  isPropertyModalOpen: boolean;
  onPropertyModalChange: (open: boolean) => void;
  onPropertySelected: (item: { id: string; name: string }) => void;
  availableUnits: ModalItem[];
  selectedBuildingName: string | undefined;
}

// ── Reusable unlink dialog ──

interface UnlinkDialogConfig {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pending: PendingEntity | null;
  onClear: () => void;
  onConfirm: () => void;
  /** e.g. 'dialogs.project' */
  i18nPrefix: string;
  /** e.g. 'projectName' */
  nameParam: string;
}

function UnlinkDialog({ open, onOpenChange, pending, onClear, onConfirm, i18nPrefix, nameParam }: UnlinkDialogConfig) {
  const { t } = useTranslation('navigation');
  const colors = useSemanticColors();
  const UnlinkIcon = NAVIGATION_ACTIONS.unlink.icon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UnlinkIcon className={`h-5 w-5 ${NAVIGATION_ACTIONS.unlink.color}`} />
            {t(`${i18nPrefix}.title`)}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>{t(`${i18nPrefix}.confirmation`, { [nameParam]: pending?.name })}</p>
            <div className="bg-muted p-3 rounded-md text-sm space-y-2 border border-border">
              <p className="font-medium text-foreground">{t(`${i18nPrefix}.infoTitle`)}</p>
              <ul className={cn(colors.text.muted, 'space-y-1')}>
                <li>{'\u2022'} {t(`${i18nPrefix}.willUnlink`)}</li>
                <li>
                  {'\u2022'} <strong className="text-foreground">{t(`${i18nPrefix}.willNotDelete`)}</strong>
                </li>
                <li>{'\u2022'} {t(`${i18nPrefix}.canLinkLater`)}</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              onOpenChange(false);
              onClear();
            }}
          >
            {t(`${i18nPrefix}.cancel`)}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t(`${i18nPrefix}.confirm`)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Main component ──

export function DesktopNavDialogs(props: DesktopNavDialogsProps) {
  const { t } = useTranslation('navigation');
  const colors = useSemanticColors();
  const DeleteIcon = NAVIGATION_ACTIONS.delete.icon;

  return (
    <>
      {/* Connection Modals */}
      <SelectItemModal
        open={props.isProjectModalOpen}
        onOpenChange={props.onProjectModalChange}
        onItemSelected={props.onProjectSelected}
        items={props.availableProjects}
        title={t('modals.linkProject.title')}
        description={t('modals.linkProject.description', { companyName: props.selectedCompanyName })}
        searchPlaceholder={t('modals.linkProject.searchPlaceholder')}
        itemType="project"
      />

      <SelectItemModal
        open={props.isBuildingModalOpen}
        onOpenChange={props.onBuildingModalChange}
        onItemSelected={props.onBuildingSelected}
        items={props.availableBuildings}
        title={t('modals.linkBuilding.title')}
        description={t('modals.linkBuilding.description', { projectName: props.selectedProjectName })}
        searchPlaceholder={t('modals.linkBuilding.searchPlaceholder')}
        itemType="building"
      />

      <SelectItemModal
        open={props.isPropertyModalOpen}
        onOpenChange={props.onPropertyModalChange}
        onItemSelected={props.onPropertySelected}
        items={props.availableUnits}
        title={t('modals.linkUnit.title')}
        description={t('modals.linkUnit.description', { buildingName: props.selectedBuildingName })}
        searchPlaceholder={t('modals.linkUnit.searchPlaceholder')}
        itemType="unit"
      />

      {/* Company Delete Dialog */}
      <AlertDialog open={props.confirmDialogOpen} onOpenChange={props.onConfirmDialogChange}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DeleteIcon className={`h-5 w-5 ${NAVIGATION_ACTIONS.delete.color}`} />
              {t('dialogs.company.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t('dialogs.company.confirmation', {
                  companyName: props.pendingDeletionCompany?.companyName,
                })}
              </p>
              <div className="bg-muted p-3 rounded-md text-sm space-y-2 border border-border">
                <p className="font-medium text-foreground">{t('dialogs.company.infoTitle')}</p>
                <ul className={cn(colors.text.muted, 'space-y-1')}>
                  <li>{'\u2022'} {t('dialogs.company.willRemove')}</li>
                  <li>
                    {'\u2022'}{' '}
                    <strong className="text-foreground">{t('dialogs.company.willNotDelete')}</strong>
                  </li>
                  <li>{'\u2022'} {t('dialogs.company.canAddLater')}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                props.onConfirmDialogChange(false);
                props.onClearPendingCompany();
              }}
            >
              {t('dialogs.company.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={props.onConfirmCompanyDeletion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('dialogs.company.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Unlink Dialog */}
      <UnlinkDialog
        open={props.projectDialogOpen}
        onOpenChange={props.onProjectDialogChange}
        pending={props.pendingUnlinkProject}
        onClear={props.onClearPendingProject}
        onConfirm={props.onConfirmProjectUnlink}
        i18nPrefix="dialogs.project"
        nameParam="projectName"
      />

      {/* Building Unlink Dialog */}
      <UnlinkDialog
        open={props.buildingDialogOpen}
        onOpenChange={props.onBuildingDialogChange}
        pending={props.pendingUnlinkBuilding}
        onClear={props.onClearPendingBuilding}
        onConfirm={props.onConfirmBuildingUnlink}
        i18nPrefix="dialogs.building"
        nameParam="buildingName"
      />

      {/* Unit Unlink Dialog */}
      <UnlinkDialog
        open={props.propertyDialogOpen}
        onOpenChange={props.onPropertyDialogChange}
        pending={props.pendingUnlinkProperty}
        onClear={props.onClearPendingProperty}
        onConfirm={props.onConfirmPropertyUnlink}
        i18nPrefix="dialogs.unit"
        nameParam="propertyName"
      />
    </>
  );
}
