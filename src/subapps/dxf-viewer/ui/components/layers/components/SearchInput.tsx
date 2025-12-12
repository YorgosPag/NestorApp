'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

interface SearchInputProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export const SearchInput = ({ searchTerm, onSearchChange }: SearchInputProps) => {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-gray-400" />
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        placeholder="Αναζήτηση layers και entities..."
      />
      {searchTerm && (
        <button
          onClick={() => onSearchChange('')}
          className={`absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 ${HOVER_TEXT_EFFECTS.BLUE_LIGHT}`}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};