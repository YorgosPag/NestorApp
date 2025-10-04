'use client';
export function PropertyHoverDescription({ text }:{ text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Σύντομη περιγραφή:</p>
      <p className="text-xs leading-relaxed">{text}</p>
    </div>
  );
}
