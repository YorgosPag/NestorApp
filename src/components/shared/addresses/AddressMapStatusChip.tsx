/**
 * =============================================================================
 * Address Map — Live Status Chip
 * =============================================================================
 *
 * Google-style live feedback over the AddressMap. Shows the user, in real
 * time, why the map looks the way it does:
 *
 *   • idle    → no address data yet — fill in fields
 *   • loading → Nominatim request in flight (debounced 500ms)
 *   • partial → some pins resolved, some failed
 *   • stale   → user edited an address-relevant field on a record that
 *               already has cached `coordinates` → map shows OLD pin →
 *               offer "force re-geocode" button
 *   • error   → all geocoding requests failed
 *   • success → silently hidden (no chip)
 *
 * Pattern reference: Google Maps Places autocomplete status badge,
 * Google Drive sync indicator (clear cause + actionable button).
 */

'use client';

import { Loader2, AlertTriangle, RefreshCw, MapPin, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { GeocodingStatus } from '@/components/shared/addresses/address-map-config';

interface AddressMapStatusChipProps {
  status: GeocodingStatus;
  geocodedCount: number;
  geocodableTotal: number;
  staleCount: number;
  onForceRegeocode: () => void;
  hasConflicts?: boolean;
  hasSuggestions?: boolean;
}

export function AddressMapStatusChip({
  status,
  geocodedCount,
  geocodableTotal,
  staleCount,
  onForceRegeocode,
  hasConflicts = false,
  hasSuggestions = false,
}: AddressMapStatusChipProps) {
  const { t } = useTranslation('addresses');

  if (status === 'success') return null;

  if (status === 'loading') {
    return (
      <Badge variant="secondary" className="shadow-md flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        {t('mapStatus.loading')}
      </Badge>
    );
  }

  if (status === 'stale') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="shadow-md flex items-center gap-1.5 border-yellow-500/40">
          <AlertTriangle className="w-3 h-3 text-yellow-600" />
          {t('mapStatus.stale', { count: staleCount })}
        </Badge>
        <Button
          size="sm"
          variant="secondary"
          onClick={onForceRegeocode}
          className="h-7 px-2 shadow-md"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          {t('mapStatus.forceRegeocode')}
        </Button>
      </div>
    );
  }

  if (status === 'partial') {
    if (hasConflicts) {
      return (
        <Badge variant="warning" className="shadow-md flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          {t('mapStatus.conflict')}
        </Badge>
      );
    }
    if (hasSuggestions) {
      return (
        <Badge variant="secondary" className="shadow-md flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          {t('mapStatus.suggestions')}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="shadow-md flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3" />
        {t('mapStatus.partial', { count: geocodedCount, total: geocodableTotal })}
      </Badge>
    );
  }

  if (status === 'error') {
    return (
      <Badge variant="destructive" className="shadow-md flex items-center gap-1.5">
        <XCircle className="w-3 h-3" />
        {t('mapStatus.error')}
      </Badge>
    );
  }

  // idle
  return (
    <Badge variant="outline" className="shadow-md flex items-center gap-1.5">
      <MapPin className="w-3 h-3" />
      {t('mapStatus.idle')}
    </Badge>
  );
}
