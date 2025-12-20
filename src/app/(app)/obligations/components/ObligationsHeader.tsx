
"use client";

import React from 'react';
import { FileText, Filter, PlusCircle } from "lucide-react";
import { PageHeader } from '@/core/headers';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import Link from "next/link";
import type { StatusFilter } from '../hooks/useObligationsList';

interface ObligationsHeaderProps {
  filters: { searchTerm: string; status: StatusFilter };
  onFilterChange: (key: 'status', value: StatusFilter) => void;
  onSearch: (term: string) => void;
}

export function ObligationsHeader({ filters, onFilterChange, onSearch }: ObligationsHeaderProps) {
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
        value: filters.searchTerm,
        onChange: onSearch,
        placeholder: "Αναζήτηση συγγραφών υποχρεώσεων..."
      }}
      filters={{
        dropdownFilters: [
          {
            key: 'status',
            value: filters.status,
            onChange: (value) => onFilterChange('status', value as StatusFilter),
            options: [
              { value: 'all', label: 'Όλες' },
              { value: 'draft', label: 'Προσχέδια' },
              { value: 'completed', label: 'Ολοκληρωμένες' },
              { value: 'approved', label: 'Εγκεκριμένες' }
            ],
            label: 'Κατάσταση',
            icon: Filter
          }
        ]
      }}
      actions={{
        customActions: [
          <Link key="add" href="/obligations/new">
            <button className={`px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 text-sm font-medium ${HOVER_BACKGROUND_EFFECTS.PRIMARY} ${TRANSITION_PRESETS.COLORS}`}>
              <PlusCircle className="h-4 w-4" />
              Νέα Συγγραφή Υποχρεώσεων
            </button>
          </Link>
        ]
      }}
    />
  );
}

    