'use client';

import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { RefreshCw } from 'lucide-react';

export function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  return (
    <ToolbarButton tooltip="Ανανέωση Δεδομένων (F5)" onClick={onRefresh}>
      <RefreshCw className="w-4 h-4" />
    </ToolbarButton>
  );
}
