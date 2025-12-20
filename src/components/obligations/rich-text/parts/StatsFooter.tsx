"use client";

interface StatsFooterProps {
  words: number;
  chars: number;
}

export function StatsFooter({ words, chars }: StatsFooterProps) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
      <div className="space-x-4">
        <span aria-live="polite">Λέξεις: {words}</span>
        <span aria-live="polite">Χαρακτήρες: {chars}</span>
      </div>
      
      <div className="text-right">
        <div className="mb-1">
          <strong>Συντομεύσεις:</strong> Ctrl+B (έντονα), Ctrl+I (πλάγια), Ctrl+U (υπογράμμιση)
        </div>
        <div>
          <strong>Μορφοποίηση:</strong> **έντονα**, *πλάγια*, - λίστες, 1. αριθμημένες
        </div>
      </div>
    </div>
  );
}
