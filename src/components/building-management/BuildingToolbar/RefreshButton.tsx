'use client';

import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { RefreshCw } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  const iconSizes = useIconSizes();
  return (
    <ToolbarButton tooltip="Ανανέωση Δεδομένων (F5)" onClick={onRefresh}>
      <RefreshCw className={iconSizes.sm} />
    </ToolbarButton>
  );
}
