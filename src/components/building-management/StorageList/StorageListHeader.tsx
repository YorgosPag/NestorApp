'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import {
  Layers,
  Table as TableIcon,
  Trash2
} from 'lucide-react';

interface StorageListHeaderProps {
  totalCount: number;
  selectedCount: number;
  onBulkDelete: () => void;
  viewMode: 'cards' | 'table';
  setViewMode: (mode: 'cards' | 'table') => void;
}

export function StorageListHeader({
  totalCount,
  selectedCount,
  onBulkDelete,
  viewMode,
  setViewMode,
}: StorageListHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {totalCount} αποτελέσματα
        </span>
        {selectedCount > 0 && (
          <>
            <span className="text-sm text-primary">
              • {selectedCount} επιλεγμένα
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={onBulkDelete}
              className={`text-destructive ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Διαγραφή επιλεγμένων
            </Button>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === 'cards' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('cards')}
        >
          <Layers className="w-4 h-4 mr-2" /> Κάρτες
        </Button>
        <Button
          variant={viewMode === 'table' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('table')}
        >
          <TableIcon className="w-4 h-4 mr-2" /> Πίνακας
        </Button>
      </div>
    </div>
  );
}
