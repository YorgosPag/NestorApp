'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { useTranslation } from 'react-i18next';
import { Filter, X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { ToolbarButton } from '@/components/ui/ToolbarButton';

interface Props {
  activeFilters: string[];
  onActiveFiltersChange: (filters: string[]) => void;
}

export function BuildingFiltersMenu({ activeFilters, onActiveFiltersChange }: Props) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('building');
  
  const handleFilterChange = (filter: string, checked: boolean) => {
    onActiveFiltersChange(
      checked 
        ? [...activeFilters, filter]
        : activeFilters.filter(f => f !== filter)
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div>
          <ToolbarButton 
            tooltip={t('filters.tooltip')}
            badge={activeFilters.length > 0 ? activeFilters.length : undefined}
          >
            <Filter className={iconSizes.sm} />
          </ToolbarButton>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('filters.title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {[
          { value: 'active', label: t('filters.states.active') },
          { value: 'construction', label: t('filters.states.construction') },
          { value: 'planned', label: t('filters.states.planned') },
          { value: 'completed', label: t('filters.states.completed') },
        ].map(({ value, label }) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={activeFilters.includes(value)}
            onCheckedChange={(checked) => handleFilterChange(value, !!checked)}
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        {[
          { value: 'residential', label: t('filters.types.residential') },
          { value: 'commercial', label: t('filters.types.commercial') },
          { value: 'mixed', label: t('filters.types.mixed') },
        ].map(({ value, label }) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={activeFilters.includes(value)}
            onCheckedChange={(checked) => handleFilterChange(value, !!checked)}
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onActiveFiltersChange([])}>
          <X className={`${iconSizes.sm} mr-2`} />
          {t('filters.clearAll')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
