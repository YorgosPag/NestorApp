

'use client';

import { useBorderTokens } from '@/hooks/useBorderTokens';

interface PropertyCountOverlayProps {
  count: number;
}

export function PropertyCountOverlay({ count }: PropertyCountOverlayProps) {
  const { quick } = useBorderTokens();
  return (
    <div className={`bg-background/80 backdrop-blur-sm ${quick.card} px-3 py-1 shadow-sm`}>
      <span className="text-xs text-muted-foreground">
        {count} ακίνητα στον όροφο
      </span>
    </div>
  );
}
