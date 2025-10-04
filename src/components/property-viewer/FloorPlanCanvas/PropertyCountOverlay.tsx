

'use client';

interface PropertyCountOverlayProps {
  count: number;
}

export function PropertyCountOverlay({ count }: PropertyCountOverlayProps) {
  return (
    <div className="bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-1 shadow-sm">
      <span className="text-xs text-muted-foreground">
        {count} ακίνητα στον όροφο
      </span>
    </div>
  );
}
