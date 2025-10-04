'use client';
import { Grid, List } from 'lucide-react';

export function ViewModeToggle({ value, onChange }: { value: 'grid'|'list'; onChange: (v:'grid'|'list')=>void; }) {
  return (
    <div className="flex bg-gray-100 dark:bg-muted/50 rounded-lg p-1">
      <button
        onClick={() => onChange('grid')}
        className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
          value === 'grid' ? 'bg-white dark:bg-card shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'
        }`}
      >
        <Grid className="h-4 w-4" />
        <span className="text-sm font-medium">Πλέγμα</span>
      </button>
      <button
        onClick={() => onChange('list')}
        className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
          value === 'list' ? 'bg-white dark:bg-card shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'
        }`}
      >
        <List className="h-4 w-4" />
        <span className="text-sm font-medium">Λίστα</span>
      </button>
    </div>
  );
}
