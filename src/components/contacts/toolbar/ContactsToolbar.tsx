'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToolbarAddButton, ToolbarEditButton, ToolbarDeleteButton, ToolbarArchiveButton, ToolbarCallButton, ToolbarEmailButton, ToolbarSMSButton, ToolbarExportButton, ToolbarImportButton, ToolbarHelpButton, ToolbarFavoritesButton, ToolbarArchivedFilterButton } from '@/components/ui/form/ActionButtons';
import {
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Phone,
  Mail,
  Archive,
  Star,
  HelpCircle,
  Settings,
  MessageSquare,
  FolderOpen
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ContactsToolbarProps {
  selectedItems?: string[];
  onSelectionChange?: (items: string[]) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  onNewContact?: () => void;
  onEditContact?: () => void;
  onDeleteContact?: (ids?: string[]) => void;
  onArchiveContact?: (ids?: string[]) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  hasSelectedContact?: boolean;
  showOnlyFavorites?: boolean;
  onToggleFavoritesFilter?: () => void;
  showArchivedContacts?: boolean;
  onToggleArchivedFilter?: () => void;
}

export function ContactsToolbar({
  selectedItems = [],
  onSelectionChange,
  searchTerm = '',
  onSearchChange,
  activeFilters = [],
  onFiltersChange,
  onNewContact,
  onEditContact,
  onDeleteContact,
  onArchiveContact,
  onExport,
  onRefresh,
  hasSelectedContact = false,
  showOnlyFavorites = false,
  onToggleFavoritesFilter,
  showArchivedContacts = false,
  onToggleArchivedFilter
}: ContactsToolbarProps) {
  const [activeTab, setActiveTab] = useState('actions');

  const renderButton = (
    icon: React.ElementType,
    label: string,
    onClick?: () => void,
    variant: 'default' | 'outline' | 'destructive' | 'ghost' = 'ghost',
    disabled = false,
    tooltip = '',
    badge?: number
  ) => {
    const IconComponent = icon;

    return (
      <TooltipProvider key={label}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size="sm"
              onClick={onClick}
              disabled={disabled}
              className="flex items-center gap-2 min-w-[100px] justify-start"
            >
              <IconComponent className="w-4 h-4" />
              <span className="hidden md:inline">{label}</span>
              {badge && (
                <Badge variant="secondary" className="ml-auto">
                  {badge}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          {tooltip && (
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  const handleDeleteAction = () => {
    if (selectedItems.length > 0) {
      onDeleteContact?.(selectedItems);
    } else if (hasSelectedContact) {
      onDeleteContact?.();
    }
  };

  const handleArchiveAction = () => {
    if (selectedItems.length > 0) {
      onArchiveContact?.(selectedItems);
    } else if (hasSelectedContact) {
      onArchiveContact?.();
    }
  };

  return (
    <div className="border-t bg-card/50 backdrop-blur-sm p-2">
      {selectedItems.length > 0 && (
        <div className="text-sm text-muted-foreground mb-2 px-2">
          {selectedItems.length} επιλεγμένες επαφές
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="actions" className="flex items-center gap-1">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Ενέργειες</span>
          </TabsTrigger>
          <TabsTrigger value="communication" className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Επικοινωνία</span>
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-1">
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Διαχείριση</span>
          </TabsTrigger>
          <TabsTrigger value="filters" className="flex items-center gap-1">
            <Star className="w-4 h-4" />
            <span className="hidden sm:inline">Φίλτρα</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="mt-3">
          <div className="flex flex-wrap gap-2">
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
            {renderButton(
              RefreshCw,
              'Ανανέωση',
              () => onRefresh?.(),
              'ghost',
              false,
              'Ανανέωση λίστας επαφών'
            )}
          </div>
        </TabsContent>

        <TabsContent value="communication" className="mt-3">
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToolbarCallButton
                    onClick={() => console.log('Call selected contacts...')}
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
                    onClick={() => console.log('Email selected contacts...')}
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
                    onClick={() => console.log('Send SMS...')}
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
          </div>
          {selectedItems.length === 0 && (
            <div className="text-center text-sm text-muted-foreground mt-4 p-4 border rounded-lg bg-muted/20">
              Επιλέξτε επαφές για επικοινωνία
            </div>
          )}
        </TabsContent>

        <TabsContent value="management" className="mt-3">
          <div className="flex flex-wrap gap-2">
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
                    onClick={() => console.log('Import contacts...')}
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
                    onClick={() => console.log('Show help...')}
                  >
                    Βοήθεια
                  </ToolbarHelpButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Βοήθεια και οδηγίες</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </TabsContent>

        <TabsContent value="filters" className="mt-3">
          <div className="flex flex-wrap gap-2">
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
          </div>
          <div className="text-center text-sm text-muted-foreground mt-4 p-4 border rounded-lg bg-blue-50/50">
            💡 Χρησιμοποιήστε τα φίλτρα στο header για περισσότερες επιλογές
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
