/**
 * 🏢 UNIFIED HEADER SYSTEM - EXAMPLES
 *
 * Παραδείγματα χρήσης του κεντρικοποιημένου header συστήματος
 * για διαφορετικούς τύπους σελίδων
 */

'use client';

import { Users, Building2, Home, FileText } from 'lucide-react';
import { PageHeader } from './enterprise-system/components/PageHeader';
import type { ViewMode } from './enterprise-system/types';
import { CommonBadge } from '@/core/badges';
import { COMMON_FILTER_LABELS } from '@/constants/property-statuses-enterprise';

// ===== EXAMPLE 1: CONTACTS HEADER (Full Featured) =====

export const ContactsHeaderExample = () => {
  const handleSearch = (value: string) => console.log('Search:', value);
  const handleViewModeChange = (mode: ViewMode) => console.log('View mode:', mode);

  return (
    <PageHeader
      variant="sticky"
      layout="multi-row"
      title={{
        icon: Users,
        title: "Διαχείριση Επαφών",
        subtitle: "Κεντρικό ευρετήριο όλων των επαφών σας"
      }}
      search={{
        value: "",
        onChange: handleSearch,
        placeholder: "Αναζήτηση επαφών..."
      }}
      filters={{
        filters: [
          {
            key: 'type',
            value: 'all',
            onChange: (value) => console.log('Type filter:', value),
            options: [
              { value: 'all', label: COMMON_FILTER_LABELS.ALL_TYPES },
              { value: 'individual', label: 'Φυσικά Πρόσωπα' },
              { value: 'company', label: 'Νομικά Πρόσωπα' },
              { value: 'service', label: 'Υπηρεσίες' }
            ],
            placeholder: 'Τύπος επαφής'
          }
        ],
        checkboxFilters: [
          {
            key: 'owners',
            checked: false,
            onChange: (checked) => console.log('Owners only:', checked),
            label: 'Μόνο με ιδιοκτησίες'
          },
          {
            key: 'favorites',
            checked: false,
            onChange: (checked) => console.log('Favorites only:', checked),
            label: 'Αγαπημένα'
          }
        ],
        hasActiveFilters: false,
        onClearFilters: () => console.log('Clear filters')
      }}
      actions={{
        showDashboard: true,
        onDashboardToggle: () => console.log('Toggle dashboard'),
        viewMode: 'list',
        onViewModeChange: handleViewModeChange,
        addButton: {
          label: 'Νέα Επαφή',
          onClick: () => console.log('Add contact')
        }
      }}
    />
  );
};

// ===== EXAMPLE 2: PROJECTS HEADER (Modular) =====

export const ProjectsHeaderExample = () => {
  return (
    <PageHeader
      variant="sticky"
      layout="single-row"
      title={{
        icon: Building2,
        title: "Διαχείριση Έργων",
        subtitle: "Παρακολούθηση και διαχείριση έργων"
      }}
      actions={{
        showDashboard: false,
        onDashboardToggle: () => console.log('Toggle dashboard'),
        viewMode: 'grid',
        onViewModeChange: (mode) => console.log('View mode:', mode),
        viewModes: ['list', 'grid', 'byType', 'byStatus'],
        addButton: {
          label: 'Νέο Έργο',
          onClick: () => console.log('Add project')
        }
      }}
    />
  );
};

// ===== EXAMPLE 3: PROPERTY HEADER (Simple) =====

export const PropertyHeaderExample = () => {
  return (
    <PageHeader
      variant="static"
      layout="single-row"
      title={{
        icon: Home,
        title: "Διαχείριση Ακινήτων",
        badge: (
          <CommonBadge
            status="property"
            customLabel="Διαχείριση και παρακολούθηση ακινήτων έργων"
            variant="secondary"
            className="text-xs"
          />
        )
      }}
      actions={{
        showDashboard: true,
        onDashboardToggle: () => console.log('Toggle dashboard'),
        viewMode: 'list',
        onViewModeChange: (mode) => console.log('View mode:', mode),
        addButton: {
          label: 'Νέο Ακίνητο',
          onClick: () => console.log('Add property')
        }
      }}
    />
  );
};

// ===== EXAMPLE 4: OBLIGATIONS HEADER (Search Focused) =====

export const ObligationsHeaderExample = () => {
  return (
    <PageHeader
      variant="static"
      layout="stacked"
      title={{
        icon: FileText,
        title: "Συγγραφές Υποχρεώσεων",
        subtitle: "Διαχείριση εγγράφων και υποχρεώσεων"
      }}
      search={{
        value: "",
        onChange: (value) => console.log('Search obligations:', value),
        placeholder: "Αναζήτηση συγγραφών υποχρεώσεων..."
      }}
      filters={{
        dropdownFilters: [
          {
            key: 'status',
            value: 'all',
            onChange: (value) => console.log('Status filter:', value),
            options: [
              { value: 'all', label: COMMON_FILTER_LABELS.ALL_STATUSES },
              { value: 'draft', label: 'Προσχέδια' },
              { value: 'completed', label: 'Ολοκληρωμένες' },
              { value: 'approved', label: 'Εγκεκριμένες' }
            ],
            label: 'Κατάσταση'
          }
        ]
      }}
      actions={{
        addButton: {
          label: 'Νέα Συγγραφή Υποχρεώσεων',
          onClick: () => console.log('Add obligation')
        }
      }}
    />
  );
};

// ===== EXAMPLE 5: FLOATING HEADER (Card Style) =====

export const FloatingHeaderExample = () => {
  return (
    <PageHeader
      variant="floating"
      layout="multi-row"
      spacing="loose"
      className="mx-4 mt-4"
      title={{
        title: "Αναφορές Dashboard",
        subtitle: "Επισκόπηση και ανάλυση δεδομένων"
      }}
      search={{
        value: "",
        onChange: (value) => console.log('Search reports:', value),
        placeholder: "Αναζήτηση αναφορών..."
      }}
      actions={{
        customActions: [
          <button key="export" className="px-3 py-1 text-sm border rounded">
            Εξαγωγή
          </button>,
          <button key="settings" className="px-3 py-1 text-sm border rounded">
            Ρυθμίσεις
          </button>
        ],
        addButton: {
          label: 'Νέα Αναφορά',
          onClick: () => console.log('Add report')
        }
      }}
    />
  );
};