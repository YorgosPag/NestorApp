'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
            {renderButton(
              Plus,
              'Νέα Επαφή',
              () => onNewContact?.(),
              'default',
              false,
              'Προσθήκη νέας επαφής'
            )}
            {renderButton(
              Edit,
              'Επεξεργασία',
              () => hasSelectedContact && onEditContact?.(),
              'outline',
              !hasSelectedContact,
              'Επεξεργασία επιλεγμένης επαφής'
            )}
            {renderButton(
              Trash2,
              'Διαγραφή',
              handleDeleteAction,
              'destructive',
              selectedItems.length === 0 && !hasSelectedContact,
              selectedItems.length > 0
                ? `Διαγραφή ${selectedItems.length} επαφής/ών`
                : hasSelectedContact
                  ? 'Διαγραφή επιλεγμένης επαφής'
                  : 'Επιλέξτε επαφή για διαγραφή',
              selectedItems.length > 0 ? selectedItems.length : undefined
            )}
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
            {renderButton(
              Phone,
              'Κλήση',
              () => console.log('Call selected contacts...'),
              'ghost',
              selectedItems.length === 0,
              'Κλήση επιλεγμένων επαφών'
            )}
            {renderButton(
              Mail,
              'Email',
              () => console.log('Email selected contacts...'),
              'ghost',
              selectedItems.length === 0,
              'Αποστολή email στις επιλεγμένες επαφές'
            )}
            {renderButton(
              MessageSquare,
              'SMS',
              () => console.log('Send SMS...'),
              'ghost',
              selectedItems.length === 0,
              'Αποστολή SMS στις επιλεγμένες επαφές'
            )}
          </div>
          {selectedItems.length === 0 && (
            <div className="text-center text-sm text-muted-foreground mt-4 p-4 border rounded-lg bg-muted/20">
              Επιλέξτε επαφές για επικοινωνία
            </div>
          )}
        </TabsContent>

        <TabsContent value="management" className="mt-3">
          <div className="flex flex-wrap gap-2">
            {renderButton(
              Download,
              'Εξαγωγή',
              () => onExport?.(),
              'ghost',
              false,
              'Εξαγωγή λίστας επαφών'
            )}
            {renderButton(
              Upload,
              'Εισαγωγή',
              () => console.log('Import contacts...'),
              'ghost',
              false,
              'Εισαγωγή επαφών από αρχείο'
            )}
            {renderButton(
              Archive,
              'Αρχειοθέτηση',
              handleArchiveAction,
              'ghost',
              selectedItems.length === 0 && !hasSelectedContact,
              selectedItems.length > 0
                ? `Αρχειοθέτηση ${selectedItems.length} επαφής/ών`
                : hasSelectedContact
                  ? 'Αρχειοθέτηση επιλεγμένης επαφής'
                  : 'Επιλέξτε επαφή για αρχειοθέτηση',
              selectedItems.length > 0 ? selectedItems.length : undefined
            )}
            {renderButton(
              HelpCircle,
              'Βοήθεια',
              () => console.log('Show help...'),
              'ghost',
              false,
              'Βοήθεια και οδηγίες'
            )}
          </div>
        </TabsContent>

        <TabsContent value="filters" className="mt-3">
          <div className="flex flex-wrap gap-2">
            {renderButton(
              Star,
              'Αγαπημένα',
              () => onToggleFavoritesFilter?.(),
              showOnlyFavorites ? 'default' : 'ghost',
              false,
              showOnlyFavorites ? 'Εμφάνιση όλων των επαφών' : 'Φιλτράρισμα μόνο αγαπημένων'
            )}
            {renderButton(
              Archive,
              'Αρχειοθετημένα',
              () => onToggleArchivedFilter?.(),
              showArchivedContacts ? 'default' : 'ghost',
              false,
              showArchivedContacts ? 'Εμφάνιση ενεργών επαφών' : 'Φιλτράρισμα μόνο αρχειοθετημένων'
            )}
          </div>
          <div className="text-center text-sm text-muted-foreground mt-4 p-4 border rounded-lg bg-blue-50/50">
            💡 Χρησιμοποιήστε τα φίλτρα στο header για περισσότερες επιλογές
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
