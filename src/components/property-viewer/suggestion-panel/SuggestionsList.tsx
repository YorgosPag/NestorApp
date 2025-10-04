
'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { SuggestionCard } from "./SuggestionCard";
import type { Suggestion } from '@/types/suggestions';

export function SuggestionsList({
  suggestions,
  selectedId,
  onSelect,
  onAccept
}: {
  suggestions: Suggestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAccept: (suggestion: Suggestion) => void;
}) {
  return (
    <ScrollArea className="h-48">
      <div className="space-y-2 pr-2">
        {suggestions.map((s) => (
          <SuggestionCard
            key={s.propertyId}
            suggestion={s}
            isSelected={selectedId === s.propertyId}
            onSelect={() => onSelect(s.propertyId)}
            onAccept={() => onAccept(s)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
