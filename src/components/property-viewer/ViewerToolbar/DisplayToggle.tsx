
'use client';

import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface DisplayToggleProps {
  showLabels: boolean;
  onToggleLabels: () => void;
}

export function DisplayToggle({ showLabels, onToggleLabels }: DisplayToggleProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  return (
    <div className={`flex items-center gap-1 ${quick.card} p-1`}>
      <Button
        variant={showLabels ? "default" : "ghost"}
        size="sm"
        onClick={onToggleLabels}
        className={`${iconSizes.xl} p-0`}
      >
        {showLabels ? <Eye className={iconSizes.sm} /> : <EyeOff className={iconSizes.sm} />}
      </Button>
    </div>
  );
}
