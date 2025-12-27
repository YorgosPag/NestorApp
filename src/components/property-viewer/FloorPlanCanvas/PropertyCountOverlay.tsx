

'use client';

import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface PropertyCountOverlayProps {
  count: number;
}

export function PropertyCountOverlay({ count }: PropertyCountOverlayProps) {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <div className={`${colors.bg.primary}/80 backdrop-blur-sm ${quick.card} px-3 py-1 shadow-sm`}>
      <span className="text-xs text-muted-foreground">
        {count} ακίνητα στον όροφο
      </span>
    </div>
  );
}
