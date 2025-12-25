'use client';
import { SearchInput } from '@/components/ui/search';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void; }) {
  const { quick } = useBorderTokens();

  return (
    <div className="flex-1">
      <SearchInput
        value={value}
        onChange={onChange}
        placeholder="Αναζήτηση ακινήτου..."
        debounceMs={300}
        className={cn(
          `${quick.input} dark:bg-muted/30`,
          "py-2.5", // Slightly larger για property grid
          "focus:ring-blue-500 focus:border-transparent"
        )}
      />
    </div>
  );
}
