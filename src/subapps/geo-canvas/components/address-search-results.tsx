'use client';

/**
 * Address Search Result Items — Extracted from AddressSearchPanel for SRP
 * @see AddressSearchPanel.tsx
 */

import React from 'react';
import { MapPin, Clock } from 'lucide-react';
import { HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { GeocodingResult } from '@/services/real-estate-monitor/AddressResolver';
import type { AdminSearchResult } from '../types/administrative-types';

// ============================================================================
// SEARCH RESULT ITEM
// ============================================================================

interface SearchResultItemProps {
  result: GeocodingResult;
  index: number;
  onSelect: (result: GeocodingResult) => void;
}

export function SearchResultItem({ result, index, onSelect }: SearchResultItemProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('geo-canvas');

  return (
    <div
      key={`search-${index}`}
      onClick={() => onSelect(result)}
      className={`flex items-center gap-3 p-3 ${quick.card} cursor-pointer ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
    >
      <MapPin className={`${iconSizes.md} ${colors.text.info} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${colors.text.foreground} truncate`}>
          {result.address.fullAddress || `${result.address.street} ${result.address.number || ''}`}
        </div>
        {result.address.area && (
          <div className={`text-xs ${colors.text.muted}`}>
            {result.address.area}{result.address.postalCode ? `, ${result.address.postalCode}` : ''}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            result.accuracy === 'exact' ? `${colors.bg.success} ${colors.text.success}` :
            result.accuracy === 'interpolated' ? `${colors.bg.warning} ${colors.text.warning}` :
            `${colors.bg.secondary} ${colors.text.muted}`
          }`}>
            {result.accuracy === 'exact' ? t('addressSearch.exact') :
             result.accuracy === 'interpolated' ? t('addressSearch.approximate') : t('addressSearch.area')}
          </span>
          <span className={`text-xs ${colors.text.muted}`}>
            {Math.round(result.confidence * 100)}% {t('addressSearch.confidence')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RECENT SEARCH ITEM
// ============================================================================

interface RecentSearchItemProps {
  result: GeocodingResult;
  index: number;
  onSelect: (result: GeocodingResult) => void;
}

export function RecentSearchItem({ result, index, onSelect }: RecentSearchItemProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <div
      key={`recent-${index}`}
      onClick={() => onSelect(result)}
      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
    >
      <Clock className={`${iconSizes.sm} ${colors.text.muted} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${colors.text.foreground} truncate`}>
          {result.address.fullAddress || `${result.address.street} ${result.address.number || ''}`}
        </div>
        {result.address.area && (
          <div className={`text-xs ${colors.text.muted} truncate`}>
            {result.address.area}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// BOUNDARY RESULT ITEM
// ============================================================================

interface BoundaryResultItemProps {
  result: AdminSearchResult;
  index: number;
  onSelect: (result: AdminSearchResult) => void;
}

export function BoundaryResultItem({ result, index, onSelect }: BoundaryResultItemProps) {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('geo-canvas');

  return (
    <div
      key={`boundary-${result.id}-${index}`}
      onClick={() => onSelect(result)}
      className={`flex items-center gap-3 p-3 ${quick.card} cursor-pointer ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${HOVER_BORDER_EFFECTS.BLUE} transition-all`}
    >
      <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs font-medium ${
        result.adminLevel === 4 ? `${colors.bg.warning} ${colors.text.warning}` :
        result.adminLevel === 8 ? `${colors.bg.info} ${colors.text.info}` :
        `${colors.bg.secondary} ${colors.text.muted}`
      }`}>
        {result.adminLevel === 4 ? 'Π' : result.adminLevel === 8 ? 'Δ' : result.adminLevel}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${colors.text.foreground} truncate`}>
          {result.name}
        </div>
        {result.nameEn && (
          <div className={`text-xs ${colors.text.muted} truncate`}>
            {result.nameEn}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            result.adminLevel === 4 ? `${colors.bg.warning} ${colors.text.warning}` :
            result.adminLevel === 8 ? `${colors.bg.info} ${colors.text.info}` :
            `${colors.bg.secondary} ${colors.text.muted}`
          }`}>
            {result.adminLevel === 4 ? t('addressSearch.regionLabel') :
             result.adminLevel === 8 ? t('addressSearch.municipalityLabel') :
             `Level ${result.adminLevel}`}
          </span>
          <span className={`text-xs ${colors.text.muted}`}>
            {Math.round(result.confidence * 100)}% {t('addressSearch.confidence')}
          </span>
          {result.hierarchy.region && (
            <span className={`text-xs ${colors.text.muted}`}>
              • {result.hierarchy.region}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
