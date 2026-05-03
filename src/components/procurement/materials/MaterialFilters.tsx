'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';

const ALL_CATEGORIES_VALUE = '__ALL__';

interface MaterialFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  atoeCategoryCode: string | null;
  onCategoryChange: (code: string | null) => void;
}

export function MaterialFilters({
  search,
  onSearchChange,
  atoeCategoryCode,
  onCategoryChange,
}: MaterialFiltersProps) {
  const { t } = useTranslation('procurement');

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1 max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          className="pl-9"
          placeholder={t('hub.materialCatalog.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t('hub.materialCatalog.searchPlaceholder')}
        />
      </div>

      <Select
        value={atoeCategoryCode ?? ALL_CATEGORIES_VALUE}
        onValueChange={(v) =>
          onCategoryChange(v === ALL_CATEGORIES_VALUE ? null : v)
        }
      >
        <SelectTrigger
          className="w-full sm:w-64"
          aria-label={t('hub.materialCatalog.filterByCategory')}
        >
          <SelectValue placeholder={t('hub.materialCatalog.allCategories')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CATEGORIES_VALUE}>
            {t('hub.materialCatalog.allCategories')}
          </SelectItem>
          {ATOE_MASTER_CATEGORIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {t(`categories.${c.code}`, { defaultValue: '' }) || c.nameEL}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
