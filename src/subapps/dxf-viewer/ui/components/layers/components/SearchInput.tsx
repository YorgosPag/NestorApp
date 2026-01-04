'use client';

import React from 'react';
import { SearchInput as UnifiedSearchInput } from '@/components/ui/search';
import { cn } from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface DxfSearchInputProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  className?: string;
}

export const SearchInput = ({ searchTerm, onSearchChange, className }: DxfSearchInputProps) => {
  const { getFocusBorder, quick } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <UnifiedSearchInput
      value={searchTerm}
      onChange={onSearchChange}
      placeholder="Αναζήτηση layers και entities..."
      debounceMs={200}
      className={cn(
        `${quick.muted} ${colors.bg.primary} ${colors.text.primary} placeholder-gray-400`,
        `${colors.interactive.focus.ring} ${getFocusBorder('input')}`,
        "text-sm",
        className
      )}
    />
  );
};