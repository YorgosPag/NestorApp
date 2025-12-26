'use client';

import React from 'react';
import { SearchInput as UnifiedSearchInput } from '@/components/ui/search';
import { cn } from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface DxfSearchInputProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  className?: string;
}

export const SearchInput = ({ searchTerm, onSearchChange, className }: DxfSearchInputProps) => {
  const { getFocusBorder, quick } = useBorderTokens();
  return (
    <UnifiedSearchInput
      value={searchTerm}
      onChange={onSearchChange}
      placeholder="Αναζήτηση layers και entities..."
      debounceMs={200}
      className={cn(
        `${quick.muted} bg-gray-800 text-gray-100 placeholder-gray-400`,
        `focus:ring-2 focus:ring-blue-500 ${getFocusBorder('input')}`,
        "text-sm",
        className
      )}
    />
  );
};