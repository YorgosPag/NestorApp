'use client';

import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { SortAsc, SortDesc } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export function SortToggleButton({
  sortDirection,
  onToggleSort,
}: {
  sortDirection: 'asc' | 'desc';
  onToggleSort: () => void;
}) {
  const iconSizes = useIconSizes();
  return (
    <ToolbarButton
      tooltip={`Ταξινόμηση ${sortDirection === 'asc' ? 'Αύξουσα' : 'Φθίνουσα'}`}
      onClick={onToggleSort}
    >
      {sortDirection === 'asc' ? <SortAsc className={iconSizes.sm} /> : <SortDesc className={iconSizes.sm} />}
    </ToolbarButton>
  );
}
