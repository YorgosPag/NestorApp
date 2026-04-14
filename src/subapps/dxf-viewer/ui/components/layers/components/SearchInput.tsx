// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { SearchInput as UnifiedSearchInput } from '@/components/ui/search';
import { cn } from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized typography tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';

interface DxfSearchInputProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  className?: string;
}

export const SearchInput = ({ searchTerm, onSearchChange, className }: DxfSearchInputProps) => {
  const { getFocusBorder, quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🌐 i18n
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);

  return (
    <UnifiedSearchInput
      value={searchTerm}
      onChange={onSearchChange}
      placeholder={t('search.layersAndEntities')}
      debounceMs={200}
      className={cn(
        `${quick.muted} ${colors.bg.primary} ${colors.text.primary} placeholder-gray-400`,
        `${colors.interactive.focus.ring} ${getFocusBorder('input')}`,
        PANEL_LAYOUT.TYPOGRAPHY.SM,
        className
      )}
    />
  );
};
