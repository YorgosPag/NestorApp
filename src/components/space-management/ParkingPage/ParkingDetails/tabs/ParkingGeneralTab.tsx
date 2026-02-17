'use client';

/**
 * 🅿️ ENTERPRISE PARKING GENERAL TAB COMPONENT
 *
 * Γενικές πληροφορίες θέσης στάθμευσης.
 * Supports inline editing mode (toggled by parent header).
 * Follows BuildingDetails GeneralTabContent pattern.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { formatDate, formatCurrency, formatFloorString } from '@/lib/intl-utils';
import type { ParkingSpot, ParkingSpotType, ParkingSpotStatus } from '@/hooks/useFirestoreParkingSpots';
import { Car, MapPin, Calendar, Euro, Layers } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ParkingGeneralTab');

// ============================================================================
// TYPES
// ============================================================================

interface ParkingGeneralTabProps {
  parking: ParkingSpot;
  /** Inline editing active (from parent via globalProps) */
  isEditing?: boolean;
  /** Notify parent when editing state changes */
  onEditingChange?: (editing: boolean) => void;
  /** Ref for save delegation from header button */
  onSaveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}

interface ParkingFormState {
  number: string;
  type: ParkingSpotType;
  status: ParkingSpotStatus;
  floor: string;
  location: string;
  area: string;
  price: string;
  notes: string;
}

interface ParkingPatchResult {
  id: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PARKING_TYPES: { value: ParkingSpotType; labelKey: string }[] = [
  { value: 'standard', labelKey: 'general.types.standard' },
  { value: 'handicapped', labelKey: 'general.types.handicapped' },
  { value: 'motorcycle', labelKey: 'general.types.motorcycle' },
  { value: 'electric', labelKey: 'general.types.electric' },
  { value: 'visitor', labelKey: 'general.types.visitor' },
];

const PARKING_STATUSES: { value: ParkingSpotStatus; labelKey: string }[] = [
  { value: 'available', labelKey: 'general.statuses.available' },
  { value: 'occupied', labelKey: 'general.statuses.occupied' },
  { value: 'reserved', labelKey: 'general.statuses.reserved' },
  { value: 'sold', labelKey: 'general.statuses.sold' },
  { value: 'maintenance', labelKey: 'general.statuses.maintenance' },
];

// ============================================================================
// HELPERS
// ============================================================================

function buildFormState(parking: ParkingSpot): ParkingFormState {
  return {
    number: parking.number || '',
    type: parking.type || 'standard',
    status: parking.status || 'available',
    floor: parking.floor || '',
    location: parking.location || '',
    area: parking.area !== undefined ? String(parking.area) : '',
    price: parking.price !== undefined ? String(parking.price) : '',
    notes: parking.notes || '',
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ParkingGeneralTab({
  parking,
  isEditing = false,
  onEditingChange,
  onSaveRef,
}: ParkingGeneralTabProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('parking');

  // Form state for edit mode
  const [form, setForm] = useState<ParkingFormState>(() => buildFormState(parking));

  // Reset form when parking data changes or edit mode starts
  useEffect(() => {
    setForm(buildFormState(parking));
  }, [parking, isEditing]);

  // Register save handler with parent via ref
  const handleSave = useCallback(async (): Promise<boolean> => {
    try {
      const payload: Record<string, unknown> = {};

      if (form.number.trim() !== (parking.number || '')) payload.number = form.number.trim();
      if (form.type !== (parking.type || 'standard')) payload.type = form.type;
      if (form.status !== (parking.status || 'available')) payload.status = form.status;
      if (form.floor.trim() !== (parking.floor || '')) payload.floor = form.floor.trim();
      if (form.location.trim() !== (parking.location || '')) payload.location = form.location.trim();

      const newArea = form.area ? parseFloat(form.area) : undefined;
      if (newArea !== parking.area) payload.area = newArea ?? null;

      const newPrice = form.price ? parseFloat(form.price) : undefined;
      if (newPrice !== parking.price) payload.price = newPrice ?? null;

      if (form.notes.trim() !== (parking.notes || '')) payload.notes = form.notes.trim();

      // Nothing changed
      if (Object.keys(payload).length === 0) {
        onEditingChange?.(false);
        return true;
      }

      await apiClient.patch<ParkingPatchResult>(`/api/parking/${parking.id}`, payload);

      // Dispatch realtime event for cross-page sync
      RealtimeService.dispatch('PARKING_UPDATED', {
        parkingSpotId: parking.id,
        updates: {
          number: form.number.trim(),
          type: form.type,
          status: form.status,
          floor: form.floor.trim() || undefined,
          area: newArea,
          price: newPrice,
        },
        timestamp: Date.now(),
      });

      logger.info('Parking spot updated', { id: parking.id });
      onEditingChange?.(false);
      return true;
    } catch (err) {
      logger.error('Failed to save parking spot', { error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }, [form, parking, onEditingChange]);

  // Register save ref for header delegation
  useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = handleSave;
    }
    return () => {
      if (onSaveRef) {
        onSaveRef.current = null;
      }
    };
  }, [handleSave, onSaveRef]);

  // Helpers
  const getTypeLabel = (type: string | undefined): string => {
    if (!type) return t('general.unknown');
    return t(`general.types.${type}`, type);
  };

  const getStatusLabel = (status: string | undefined): string => {
    if (!status) return t('general.unknown');
    return t(`general.statuses.${status}`, status);
  };

  const updateField = <K extends keyof ParkingFormState>(key: K, value: ParkingFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Basic Information */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Car className={iconSizes.md} />
          {t('general.basicInfo')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <fieldset>
            <label className="text-sm font-medium text-muted-foreground">
              {t('general.fields.spotCode')}
            </label>
            {isEditing ? (
              <Input
                value={form.number}
                onChange={(e) => updateField('number', e.target.value)}
                className="mt-1"
              />
            ) : (
              <p className="mt-1 text-sm">{parking.number || 'N/A'}</p>
            )}
          </fieldset>
          <fieldset>
            <label className="text-sm font-medium text-muted-foreground">
              {t('general.fields.type')}
            </label>
            {isEditing ? (
              <Select
                value={form.type}
                onValueChange={(v) => updateField('type', v as ParkingSpotType)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARKING_TYPES.map(pt => (
                    <SelectItem key={pt.value} value={pt.value}>
                      {t(pt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-1 text-sm">{getTypeLabel(parking.type)}</p>
            )}
          </fieldset>
          <fieldset>
            <label className="text-sm font-medium text-muted-foreground">
              {t('general.fields.status')}
            </label>
            {isEditing ? (
              <Select
                value={form.status}
                onValueChange={(v) => updateField('status', v as ParkingSpotStatus)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARKING_STATUSES.map(ps => (
                    <SelectItem key={ps.value} value={ps.value}>
                      {t(ps.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-1 text-sm">{getStatusLabel(parking.status)}</p>
            )}
          </fieldset>
          <fieldset>
            <label className="text-sm font-medium text-muted-foreground">
              {t('general.fields.area')}
            </label>
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={form.area}
                onChange={(e) => updateField('area', e.target.value)}
                placeholder="m²"
                className="mt-1"
              />
            ) : (
              <p className="mt-1 text-sm">{parking.area ? `${parking.area} m²` : 'N/A'}</p>
            )}
          </fieldset>
        </div>
      </section>

      {/* Location */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <MapPin className={iconSizes.md} />
          {t('general.location')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <fieldset>
            <label className="text-sm font-medium text-muted-foreground">
              {t('general.fields.floor')}
            </label>
            {isEditing ? (
              <Input
                value={form.floor}
                onChange={(e) => updateField('floor', e.target.value)}
                placeholder="-1"
                className="mt-1"
              />
            ) : (
              <p className="mt-1 text-sm">
                {parking.floor ? formatFloorString(parking.floor) : 'N/A'}
              </p>
            )}
          </fieldset>
          <fieldset>
            <label className="text-sm font-medium text-muted-foreground">
              {t('general.fields.position')}
            </label>
            {isEditing ? (
              <Input
                value={form.location}
                onChange={(e) => updateField('location', e.target.value)}
                className="mt-1"
              />
            ) : (
              <p className="mt-1 text-sm">{parking.location || 'N/A'}</p>
            )}
          </fieldset>
          <fieldset>
            <label className="text-sm font-medium text-muted-foreground">
              {t('general.fields.buildingId')}
            </label>
            <p className="mt-1 text-sm font-mono text-xs">{parking.buildingId || 'N/A'}</p>
          </fieldset>
          <fieldset>
            <label className="text-sm font-medium text-muted-foreground">
              {t('general.fields.projectId')}
            </label>
            <p className="mt-1 text-sm font-mono text-xs">{parking.projectId || 'N/A'}</p>
          </fieldset>
        </div>
      </section>

      {/* Financial Information */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Euro className={iconSizes.md} />
          {t('general.financial')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <fieldset>
            <label className="text-sm font-medium text-muted-foreground">
              {t('general.fields.price')}
            </label>
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => updateField('price', e.target.value)}
                placeholder="€"
                className="mt-1"
              />
            ) : (
              <p className="mt-1 text-sm">
                {parking.price !== undefined && parking.price > 0
                  ? formatCurrency(parking.price)
                  : parking.price === 0
                    ? t('general.priceValues.shared')
                    : t('general.priceValues.notSet')}
              </p>
            )}
          </fieldset>
          <fieldset>
            <label className="text-sm font-medium text-muted-foreground">
              {t('general.fields.pricePerSqm')}
            </label>
            <p className="mt-1 text-sm">
              {parking.price && parking.area && parking.price > 0
                ? formatCurrency(parking.price / parking.area)
                : t('general.notCalculated')}
            </p>
          </fieldset>
        </div>
      </section>

      {/* Notes */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Layers className={iconSizes.md} />
          {t('general.notes')}
        </h3>
        {isEditing ? (
          <Textarea
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            className="h-20 resize-none"
          />
        ) : (
          parking.notes ? (
            <p className="text-sm bg-muted/50 p-4 rounded-lg">{parking.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )
        )}
      </section>

      {/* Update Information (read-only always) */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Calendar className={iconSizes.md} />
          {t('general.updateInfo')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {parking.createdAt && (
            <fieldset>
              <label className="text-sm font-medium text-muted-foreground">
                {t('general.fields.createdAt')}
              </label>
              <p className="mt-1 text-sm">{formatDate(
                parking.createdAt instanceof Date
                  ? parking.createdAt.toISOString()
                  : typeof parking.createdAt === 'object' && 'toDate' in parking.createdAt
                    ? (parking.createdAt as { toDate: () => Date }).toDate().toISOString()
                    : String(parking.createdAt)
              )}</p>
            </fieldset>
          )}
          {parking.updatedAt && (
            <fieldset>
              <label className="text-sm font-medium text-muted-foreground">
                {t('general.fields.lastUpdated')}
              </label>
              <p className="mt-1 text-sm">{formatDate(
                parking.updatedAt instanceof Date
                  ? parking.updatedAt.toISOString()
                  : typeof parking.updatedAt === 'object' && 'toDate' in parking.updatedAt
                    ? (parking.updatedAt as { toDate: () => Date }).toDate().toISOString()
                    : String(parking.updatedAt)
              )}</p>
            </fieldset>
          )}
          {parking.createdBy && (
            <fieldset>
              <label className="text-sm font-medium text-muted-foreground">
                {t('general.fields.createdBy')}
              </label>
              <p className="mt-1 text-sm">{parking.createdBy}</p>
            </fieldset>
          )}
        </div>
      </section>
    </div>
  );
}
