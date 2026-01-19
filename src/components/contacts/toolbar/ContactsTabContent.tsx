'use client';

import React from 'react';
import {
  ToolbarAddButton,
  ToolbarEditButton,
  ToolbarDeleteButton,
  ToolbarArchiveButton,
  ToolbarCallButton,
  ToolbarEmailButton,
  ToolbarSMSButton,
  ToolbarExportButton,
  ToolbarImportButton,
  ToolbarHelpButton,
  ToolbarFavoritesButton,
  ToolbarArchivedFilterButton,
  ToolbarRefreshButton,
  ToolbarSortToggleButton
} from '@/components/ui/form/ActionButtons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// Props interface for all tab contents
interface ContactsTabContentProps {
  selectedItems?: string[];
  hasSelectedContact?: boolean;
  showOnlyFavorites?: boolean;
  showArchivedContacts?: boolean;
  sortDirection?: 'asc' | 'desc';
  onNewContact?: () => void;
  onEditContact?: () => void;
  onDeleteContact?: (ids?: string[]) => void;
  onArchiveContact?: (ids?: string[]) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  onToggleFavoritesFilter?: () => void;
  onToggleArchivedFilter?: () => void;
  onToggleSort?: () => void;
}

// Actions Tab Content
export function ActionsTabContent({
  selectedItems = [],
  hasSelectedContact = false,
  onNewContact,
  onEditContact,
  onDeleteContact,
  onArchiveContact,
  onRefresh
}: ContactsTabContentProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');

  const handleDeleteAction = () => {
    if (selectedItems.length > 0) {
      onDeleteContact?.(selectedItems);
    } else if (hasSelectedContact) {
      onDeleteContact?.();
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarAddButton
              variant="default"
              onClick={() => onNewContact?.()}
              disabled={false}
            >
              {t('toolbar.tabs.actions.newContact')}
            </ToolbarAddButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tabs.actions.newContactTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarEditButton
              variant="outline"
              onClick={() => hasSelectedContact && onEditContact?.()}
              disabled={!hasSelectedContact}
            >
              {t('toolbar.tabs.actions.edit')}
            </ToolbarEditButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tabs.actions.editTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarDeleteButton
              variant="destructive"
              onClick={handleDeleteAction}
              disabled={selectedItems.length === 0 && !hasSelectedContact}
              badge={selectedItems.length > 0 ? selectedItems.length : undefined}
            >
              {t('toolbar.tabs.actions.delete')}
            </ToolbarDeleteButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {selectedItems.length > 0
                ? t('toolbar.tabs.actions.deleteCount', { count: selectedItems.length })
                : hasSelectedContact
                  ? t('toolbar.tabs.actions.deleteSelected')
                  : t('toolbar.tabs.actions.deleteSelectFirst')}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarRefreshButton
              onClick={() => onRefresh?.()}
            >
              {t('toolbar.tabs.actions.refresh')}
            </ToolbarRefreshButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tabs.actions.refreshTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}

// Communication Tab Content
export function CommunicationTabContent({
  selectedItems = []
}: ContactsTabContentProps) {
  const { quick } = useBorderTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarCallButton
              onClick={() => {
                // Debug logging removed
              }}
              disabled={selectedItems.length === 0}
            >
              {t('toolbar.tabs.communication.call')}
            </ToolbarCallButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tabs.communication.callTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarEmailButton
              onClick={() => {
                // Debug logging removed
              }}
              disabled={selectedItems.length === 0}
            >
              {t('toolbar.tabs.communication.email')}
            </ToolbarEmailButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tabs.communication.emailTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarSMSButton
              onClick={() => {
                // Debug logging removed
              }}
              disabled={selectedItems.length === 0}
            >
              {t('toolbar.tabs.communication.sms')}
            </ToolbarSMSButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tabs.communication.smsTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {selectedItems.length === 0 && (
        <div className={`text-center text-sm text-muted-foreground mt-4 p-4 ${quick.card} bg-muted/20 w-full`}>
          {t('toolbar.tabs.communication.selectForCommunication')}
        </div>
      )}
    </>
  );
}

// Management Tab Content
export function ManagementTabContent({
  selectedItems = [],
  hasSelectedContact = false,
  onExport,
  onArchiveContact
}: ContactsTabContentProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');

  const handleArchiveAction = () => {
    if (selectedItems.length > 0) {
      onArchiveContact?.(selectedItems);
    } else if (hasSelectedContact) {
      onArchiveContact?.();
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarExportButton
              onClick={() => onExport?.()}
            >
              {t('toolbar.tabs.management.export')}
            </ToolbarExportButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tabs.management.exportTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarImportButton
              onClick={() => {
                // Debug logging removed
              }}
            >
              {t('toolbar.tabs.management.import')}
            </ToolbarImportButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tabs.management.importTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>


      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarArchiveButton
              onClick={handleArchiveAction}
              disabled={selectedItems.length === 0 && !hasSelectedContact}
              badge={selectedItems.length > 0 ? selectedItems.length : undefined}
            >
              {t('toolbar.tabs.management.archive')}
            </ToolbarArchiveButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {selectedItems.length > 0
                ? t('toolbar.tabs.management.archiveCount', { count: selectedItems.length })
                : hasSelectedContact
                  ? t('toolbar.tabs.management.archiveSelected')
                  : t('toolbar.tabs.management.archiveSelectFirst')}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarHelpButton
              onClick={() => {
                // Debug logging removed
              }}
            >
              {t('toolbar.tabs.management.help')}
            </ToolbarHelpButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tabs.management.helpTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}

// Filters Tab Content
export function FiltersTabContent({
  showOnlyFavorites = false,
  showArchivedContacts = false,
  sortDirection = 'asc',
  onToggleFavoritesFilter,
  onToggleArchivedFilter,
  onToggleSort
}: ContactsTabContentProps) {
  const { quick } = useBorderTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarFavoritesButton
              active={showOnlyFavorites}
              onClick={() => onToggleFavoritesFilter?.()}
            >
              {t('toolbar.tabs.filters.favorites')}
            </ToolbarFavoritesButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{showOnlyFavorites ? t('toolbar.tabs.filters.showAllContacts') : t('toolbar.tabs.filters.filterFavoritesOnly')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarArchivedFilterButton
              active={showArchivedContacts}
              onClick={() => onToggleArchivedFilter?.()}
            >
              {t('toolbar.tabs.filters.archived')}
            </ToolbarArchivedFilterButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{showArchivedContacts ? t('toolbar.tabs.filters.showActiveContacts') : t('toolbar.tabs.filters.filterArchivedOnly')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarSortToggleButton
              sortDirection={sortDirection}
              onClick={() => onToggleSort?.()}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{sortDirection === 'asc' ? t('toolbar.tabs.filters.sortAtoZ') : t('toolbar.tabs.filters.sortZtoA')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className={`text-center text-sm text-muted-foreground mt-4 p-4 ${quick.card} bg-blue-50/50 w-full`}>
        💡 {t('toolbar.tabs.filters.filterHint')}
      </div>
    </>
  );
}