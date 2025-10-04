'use client';
import { Search } from 'lucide-react';

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void; }) {
  return (
    <div className="flex-1 relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-muted-foreground" />
      <input
        type="text"
        placeholder="Αναζήτηση ακινήτου..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-border dark:bg-muted/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}
