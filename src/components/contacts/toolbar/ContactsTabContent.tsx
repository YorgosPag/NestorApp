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
              Νέα Επαφή
            </ToolbarAddButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Προσθήκη νέας επαφής</p>
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
              Επεξεργασία
            </ToolbarEditButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Επεξεργασία επιλεγμένης επαφής</p>
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
              Διαγραφή
            </ToolbarDeleteButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {selectedItems.length > 0
                ? `Διαγραφή ${selectedItems.length} επαφής/ών`
                : hasSelectedContact
                  ? 'Διαγραφή επιλεγμένης επαφής'
                  : 'Επιλέξτε επαφή για διαγραφή'}
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
              Ανανέωση
            </ToolbarRefreshButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Ανανέωση λίστας επαφών</p>
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
              Κλήση
            </ToolbarCallButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Κλήση επιλεγμένων επαφών</p>
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
              Email
            </ToolbarEmailButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Αποστολή email στις επιλεγμένες επαφές</p>
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
              SMS
            </ToolbarSMSButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Αποστολή SMS στις επιλεγμένες επαφές</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {selectedItems.length === 0 && (
        <div className={`text-center text-sm text-muted-foreground mt-4 p-4 ${quick.card} bg-muted/20 w-full`}>
          Επιλέξτε επαφές για επικοινωνία
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
              Εξαγωγή
            </ToolbarExportButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Εξαγωγή λίστας επαφών</p>
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
              Εισαγωγή
            </ToolbarImportButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Εισαγωγή επαφών από αρχείο</p>
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
              Αρχειοθέτηση
            </ToolbarArchiveButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {selectedItems.length > 0
                ? `Αρχειοθέτηση ${selectedItems.length} επαφής/ών`
                : hasSelectedContact
                  ? 'Αρχειοθέτηση επιλεγμένης επαφής'
                  : 'Επιλέξτε επαφή για αρχειοθέτηση'}
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
              Βοήθεια
            </ToolbarHelpButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>Βοήθεια και οδηγίες</p>
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

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarFavoritesButton
              active={showOnlyFavorites}
              onClick={() => onToggleFavoritesFilter?.()}
            >
              Αγαπημένα
            </ToolbarFavoritesButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{showOnlyFavorites ? 'Εμφάνιση όλων των επαφών' : 'Φιλτράρισμα μόνο αγαπημένων'}</p>
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
              Αρχειοθετημένα
            </ToolbarArchivedFilterButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>{showArchivedContacts ? 'Εμφάνιση ενεργών επαφών' : 'Φιλτράρισμα μόνο αρχειοθετημένων'}</p>
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
            <p>{sortDirection === 'asc' ? 'Ταξινόμηση από Α έως Ω' : 'Ταξινόμηση από Ω έως Α'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className={`text-center text-sm text-muted-foreground mt-4 p-4 ${quick.card} bg-blue-50/50 w-full`}>
        💡 Χρησιμοποιήστε τα φίλτρα στο header για περισσότερες επιλογές
      </div>
    </>
  );
}