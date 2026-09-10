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
 *   • error   → all geocoding requests failed
 *
 * ⚠️ ADR-332 D27 Β10: η κατάσταση `stale` («Παλιές συντεταγμένες» + «Ανανέωση χάρτη») αφαιρέθηκε —
 * ήταν δεύτερος κριτής θέσης. Την απόκλιση τη λέει ο διακομιστής (`AddressPositionDriftNotice`).
 *   • success → silently hidden (no chip)
 *
 * Pattern reference: Google Maps Places autocomplete status badge,
 * Google Drive sync indicator (clear cause + actionable button).
 */

'use client';

import { Loader2, AlertTriangle, MapPin, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { GeocodingStatus } from '@/components/shared/addresses/address-map-config';

interface AddressMapStatusChipProps {
  status: GeocodingStatus;
  geocodedCount: number;
  geocodableTotal: number;
  hasConflicts?: boolean;
  hasSuggestions?: boolean;
}

export function AddressMapStatusChip({
  status,
  geocodedCount,
  geocodableTotal,
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
