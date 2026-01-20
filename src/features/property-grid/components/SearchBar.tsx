// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import { SearchInput } from '@/components/ui/search';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void; }) {
  const { t } = useTranslation('properties');
  return (
    <div className="flex-1">
      <SearchInput
        value={value}
        onChange={onChange}
        placeholder={t('grid.searchPlaceholder')}
        debounceMs={300}
        className={cn(
          "border-gray-200 dark:border-border dark:bg-muted/30",
          "py-2.5", // Slightly larger για property grid
          "focus:ring-blue-500 focus:border-transparent"
        )}
      />
    </div>
  );
}
