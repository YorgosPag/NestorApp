'use client';

import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { SortAsc, SortDesc } from 'lucide-react';

export function SortToggleButton({ sortDirection, onToggleSort }: {
  sortDirection: 'asc' | 'desc';
  onToggleSort: () => void;
}) {
  return (
    <ToolbarButton 
      tooltip={`Ταξινόμηση ${sortDirection === 'asc' ? 'Αύξουσα' : 'Φθίνουσα'}`}
      onClick={onToggleSort}
    >
      {sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
    </ToolbarButton>
  );
}
