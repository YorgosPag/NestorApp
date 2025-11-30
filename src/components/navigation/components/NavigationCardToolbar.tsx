'use client';

/**
 * Navigation Card Toolbar Component
 * Compact toolbar for navigation cards using centralized CompactToolbar
 * Different actions per navigation level (companies, projects, buildings, floors)
 */

import React from 'react';
import { CompactToolbar } from '@/components/core/CompactToolbar/CompactToolbar';
import type { CompactToolbarConfig } from '@/components/core/CompactToolbar/types';

type NavigationLevel = 'companies' | 'projects' | 'buildings' | 'floors' | 'units';

interface NavigationCardToolbarProps {
  level: NavigationLevel;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  selectedItems?: string[];
  hasSelectedItems?: boolean;
  onNewItem?: () => void;
  onEditItem?: () => void;
  onDeleteItem?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onSettings?: () => void;
  onReports?: () => void;
  onShare?: () => void;
  onHelp?: () => void;
}

// Configuration per navigation level
const getToolbarConfig = (level: NavigationLevel): CompactToolbarConfig => {
  const baseConfig = {
    labels: {
      newItem: level === 'companies' ? 'Προσθήκη' : 'Σύνδεση',
      editItem: 'Επεξεργασία',
      deleteItems: level === 'companies' ? 'Αφαίρεση' : 'Αποσύνδεση',
      filters: 'Φίλτρα',
      favorites: 'Αγαπημένα',
      archive: 'Αρχείο',
      export: 'Εξαγωγή',
      import: 'Εισαγωγή',
      refresh: 'Ανανέωση',
      preview: 'Προεπισκόπηση',
      copy: 'Αντιγραφή',
      share: 'Διαμοιρασμός',
      reports: 'Αναφορές',
      settings: 'Ρυθμίσεις',
      favoritesManagement: 'Διαχείριση Αγαπημένων',
      help: 'Βοήθεια',
      sorting: 'Ταξινόμηση'
    },
    tooltips: {
      newItem: '',
      editItem: '',
      deleteItems: '',
      filters: 'Φιλτράρισμα',
      favorites: 'Αγαπημένα',
      archive: 'Αρχειοθέτηση',
      export: 'Εξαγωγή δεδομένων',
      import: 'Εισαγωγή δεδομένων',
      refresh: 'Ανανέωση δεδομένων',
      preview: 'Προεπισκόπηση',
      copy: 'Αντιγραφή',
      share: 'Διαμοιρασμός',
      reports: 'Αναφορές',
      settings: 'Ρυθμίσεις',
      favoritesManagement: 'Διαχείριση Αγαπημένων',
      help: 'Βοήθεια',
      sorting: 'Ταξινόμηση'
    }
  };

  switch (level) {
    case 'companies':
      return {
        searchPlaceholder: 'Αναζήτηση εταιρείας...',
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: 'Προσθήκη νέας εταιρείας',
          editItem: 'Επεξεργασία εταιρείας',
          deleteItems: 'Αφαίρεση εταιρείας'
        },
        filterCategories: [
          {
            id: 'type',
            label: 'Τύπος Εταιρείας',
            options: [
              { value: 'construction', label: 'Κατασκευαστική' },
              { value: 'development', label: 'Αναπτυξιακή' },
              { value: 'investment', label: 'Επενδυτική' },
              { value: 'management', label: 'Διαχειριστική' }
            ]
          },
          {
            id: 'status',
            label: 'Κατάσταση',
            options: [
              { value: 'active', label: 'Ενεργές' },
              { value: 'with_projects', label: 'Με έργα' },
              { value: 'without_projects', label: 'Χωρίς έργα' }
            ]
          }
        ],
        sortOptions: [
          { field: 'name', ascLabel: 'Όνομα (Α-Ω)', descLabel: 'Όνομα (Ω-Α)' },
          { field: 'date', ascLabel: 'Παλαιότερες πρώτα', descLabel: 'Νεότερες πρώτα' }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          import: true,
          sorting: true,
          reports: true,
          settings: true,
          help: true
        }
      };

    case 'projects':
      return {
        searchPlaceholder: 'Αναζήτηση έργου...',
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: 'Σύνδεση έργου με επιλεγμένη εταιρεία',
          editItem: 'Επεξεργασία έργου',
          deleteItems: 'Αποσύνδεση έργου'
        },
        filterCategories: [
          {
            id: 'status',
            label: 'Κατάσταση Έργου',
            options: [
              { value: 'planning', label: 'Σχεδίαση' },
              { value: 'construction', label: 'Κατασκευή' },
              { value: 'completed', label: 'Ολοκληρωμένα' },
              { value: 'on_hold', label: 'Αναστολή' }
            ]
          },
          {
            id: 'type',
            label: 'Τύπος Έργου',
            options: [
              { value: 'residential', label: 'Κατοικίες' },
              { value: 'commercial', label: 'Εμπορικά' },
              { value: 'mixed', label: 'Μεικτά' }
            ]
          }
        ],
        sortOptions: [
          { field: 'name', ascLabel: 'Όνομα (Α-Ω)', descLabel: 'Όνομα (Ω-Α)' },
          { field: 'progress', ascLabel: 'Πρόοδος (Λίγη-Πολλή)', descLabel: 'Πρόοδος (Πολλή-Λίγη)' },
          { field: 'date', ascLabel: 'Παλαιότερα πρώτα', descLabel: 'Νεότερα πρώτα' }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          sorting: true,
          reports: true,
          share: true,
          help: true
        }
      };

    case 'buildings':
      return {
        searchPlaceholder: 'Αναζήτηση κτιρίου...',
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: 'Σύνδεση κτιρίου με επιλεγμένο έργο',
          editItem: 'Επεξεργασία κτιρίου',
          deleteItems: 'Αποσύνδεση κτιρίου'
        },
        filterCategories: [
          {
            id: 'type',
            label: 'Τύπος Κτιρίου',
            options: [
              { value: 'residential', label: 'Κατοικίες' },
              { value: 'commercial', label: 'Εμπορικό' },
              { value: 'office', label: 'Γραφεία' },
              { value: 'mixed', label: 'Μεικτό' }
            ]
          },
          {
            id: 'floors',
            label: 'Αριθμός Ορόφων',
            options: [
              { value: '1-3', label: '1-3 όροφοι' },
              { value: '4-6', label: '4-6 όροφοι' },
              { value: '7+', label: '7+ όροφοι' }
            ]
          }
        ],
        sortOptions: [
          { field: 'name', ascLabel: 'Όνομα (Α-Ω)', descLabel: 'Όνομα (Ω-Α)' },
          { field: 'area', ascLabel: 'Εμβαδόν (Μικρό-Μεγάλο)', descLabel: 'Εμβαδόν (Μεγάλο-Μικρό)' }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          sorting: true,
          reports: true,
          help: true
        }
      };

    case 'floors':
      return {
        searchPlaceholder: 'Αναζήτηση ορόφου...',
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: 'Σύνδεση ορόφου με επιλεγμένο κτίριο',
          editItem: 'Επεξεργασία ορόφου',
          deleteItems: 'Αποσύνδεση ορόφου'
        },
        filterCategories: [
          {
            id: 'type',
            label: 'Τύπος Ορόφου',
            options: [
              { value: 'basement', label: 'Υπόγειο' },
              { value: 'ground', label: 'Ισόγειο' },
              { value: 'floor', label: 'Όροφος' },
              { value: 'penthouse', label: 'Ρετιρέ' }
            ]
          },
          {
            id: 'units',
            label: 'Αριθμός Μονάδων',
            options: [
              { value: '1-2', label: '1-2 μονάδες' },
              { value: '3-5', label: '3-5 μονάδες' },
              { value: '6+', label: '6+ μονάδες' }
            ]
          }
        ],
        sortOptions: [
          { field: 'name', ascLabel: 'Όνομα (Α-Ω)', descLabel: 'Όνομα (Ω-Α)' },
          { field: 'area', ascLabel: 'Εμβαδόν (Μικρό-Μεγάλο)', descLabel: 'Εμβαδόν (Μεγάλο-Μικρό)' }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          sorting: true,
          reports: true,
          help: true
        }
      };

    case 'units':
      return {
        searchPlaceholder: 'Αναζήτηση μονάδας...',
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: 'Σύνδεση μονάδας με επιλεγμένο όροφο',
          editItem: 'Επεξεργασία μονάδας',
          deleteItems: 'Αποσύνδεση μονάδας'
        },
        filterCategories: [
          {
            id: 'type',
            label: 'Τύπος Μονάδας',
            options: [
              { value: 'apartment', label: 'Διαμέρισμα' },
              { value: 'office', label: 'Γραφείο' },
              { value: 'shop', label: 'Κατάστημα' },
              { value: 'storage', label: 'Αποθήκη' },
              { value: 'parking', label: 'Θέση Στάθμευσης' }
            ]
          },
          {
            id: 'status',
            label: 'Κατάσταση',
            options: [
              { value: 'available', label: 'Διαθέσιμη' },
              { value: 'occupied', label: 'Κατειλημμένη' },
              { value: 'reserved', label: 'Κρατημένη' },
              { value: 'maintenance', label: 'Συντήρηση' }
            ]
          },
          {
            id: 'rooms',
            label: 'Αριθμός Δωματίων',
            options: [
              { value: '1', label: '1 δωμάτιο' },
              { value: '2', label: '2 δωμάτια' },
              { value: '3', label: '3 δωμάτια' },
              { value: '4+', label: '4+ δωμάτια' }
            ]
          }
        ],
        sortOptions: [
          { field: 'name', ascLabel: 'Όνομα (Α-Ω)', descLabel: 'Όνομα (Ω-Α)' },
          { field: 'area', ascLabel: 'Εμβαδόν (Μικρό-Μεγάλο)', descLabel: 'Εμβαδόν (Μεγάλο-Μικρό)' },
          { field: 'rooms', ascLabel: 'Δωμάτια (Λίγα-Πολλά)', descLabel: 'Δωμάτια (Πολλά-Λίγα)' }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          sorting: true,
          reports: true,
          help: true
        }
      };

    default:
      throw new Error(`Unknown navigation level: ${level}`);
  }
};

export function NavigationCardToolbar({
  level,
  searchTerm,
  onSearchChange,
  activeFilters,
  onFiltersChange,
  selectedItems = [],
  hasSelectedItems = false,
  onNewItem,
  onEditItem,
  onDeleteItem,
  onRefresh,
  onExport,
  onImport,
  onSettings,
  onReports,
  onShare,
  onHelp
}: NavigationCardToolbarProps) {
  const config = getToolbarConfig(level);

  return (
    <CompactToolbar
      config={config}
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      activeFilters={activeFilters}
      onFiltersChange={onFiltersChange}
      selectedItems={selectedItems}
      hasSelectedContact={hasSelectedItems}
      onNewItem={onNewItem}
      onEditItem={() => onEditItem?.()}
      onDeleteItems={() => onDeleteItem?.()}
      onRefresh={onRefresh}
      onExport={onExport}
      onImport={onImport}
      onSettings={onSettings}
      onReports={onReports}
      onShare={onShare}
      onHelp={onHelp}
    />
  );
}

export default NavigationCardToolbar;