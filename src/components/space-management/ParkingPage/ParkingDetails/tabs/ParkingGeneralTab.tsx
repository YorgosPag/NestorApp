'use client';

/**
 * 🅿️ ENTERPRISE PARKING GENERAL TAB COMPONENT
 *
 * Γενικές πληροφορίες θέσης στάθμευσης.
 * Supports inline editing mode (toggled by parent header).
 * Each section wrapped in Card for visual separation (Google Material pattern).
 * Follows BuildingDetails GeneralTabContent pattern.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { formatDate, formatCurrency, formatFloorString } from '@/lib/intl-utils';
import type { ParkingSpot, ParkingSpotType, ParkingSpotStatus } from '@/hooks/useFirestoreParkingSpots';
import { Car, MapPin, Calendar, Euro, StickyNote } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
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

function formatTimestamp(value: Date | { toDate: () => Date } | string): string {
  if (value instanceof Date) return formatDate(value.toISOString());
  if (typeof value === 'object' && 'toDate' in value) return formatDate(value.toDate().toISOString());
  return formatDate(String(value));
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
  const typography = useTypography();
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
    <div className="p-4 space-y-4">
      {/* ─── Basic Information Card ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Car className={cn(iconSizes.md, 'text-blue-500')} />
            {t('general.basicInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground">{t('general.fields.spotCode')}</Label>
              {isEditing ? (
                <Input
                  value={form.number}
                  onChange={(e) => updateField('number', e.target.value)}
                />
              ) : (
                <p className="text-sm font-medium">{parking.number || 'N/A'}</p>
              )}
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground">{t('general.fields.type')}</Label>
              {isEditing ? (
                <Select
                  value={form.type}
                  onValueChange={(v) => updateField('type', v as ParkingSpotType)}
                >
                  <SelectTrigger>
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
                <p className="text-sm font-medium">{getTypeLabel(parking.type)}</p>
              )}
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground">{t('general.fields.status')}</Label>
              {isEditing ? (
                <Select
                  value={form.status}
                  onValueChange={(v) => updateField('status', v as ParkingSpotStatus)}
                >
                  <SelectTrigger>
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
                <p className="text-sm font-medium">{getStatusLabel(parking.status)}</p>
              )}
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground">{t('general.fields.area')}</Label>
              {isEditing ? (
                <Input
                  type="number"
                  step="0.01"
                  value={form.area}
                  onChange={(e) => updateField('area', e.target.value)}
                  placeholder="m²"
                />
              ) : (
                <p className="text-sm font-medium">{parking.area ? `${parking.area} m²` : 'N/A'}</p>
              )}
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ─── Location Card ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <MapPin className={cn(iconSizes.md, 'text-emerald-500')} />
            {t('general.location')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground">{t('general.fields.floor')}</Label>
              {isEditing ? (
                <Input
                  value={form.floor}
                  onChange={(e) => updateField('floor', e.target.value)}
                  placeholder="-1"
                />
              ) : (
                <p className="text-sm font-medium">
                  {parking.floor ? formatFloorString(parking.floor) : 'N/A'}
                </p>
              )}
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground">{t('general.fields.position')}</Label>
              {isEditing ? (
                <Input
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                />
              ) : (
                <p className="text-sm font-medium">{parking.location || 'N/A'}</p>
              )}
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground">{t('general.fields.buildingId')}</Label>
              <p className="text-sm font-mono text-xs text-muted-foreground">
                {parking.buildingId || 'N/A'}
              </p>
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground">{t('general.fields.projectId')}</Label>
              <p className="text-sm font-mono text-xs text-muted-foreground">
                {parking.projectId || 'N/A'}
              </p>
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ─── Financial Card ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Euro className={cn(iconSizes.md, 'text-amber-500')} />
            {t('general.financial')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground">{t('general.fields.price')}</Label>
              {isEditing ? (
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  placeholder="€"
                />
              ) : (
                <p className="text-sm font-medium">
                  {parking.price !== undefined && parking.price > 0
                    ? formatCurrency(parking.price)
                    : parking.price === 0
                      ? t('general.priceValues.shared')
                      : t('general.priceValues.notSet')}
                </p>
              )}
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground">{t('general.fields.pricePerSqm')}</Label>
              <p className="text-sm font-medium">
                {parking.price && parking.area && parking.price > 0
                  ? formatCurrency(parking.price / parking.area)
                  : t('general.notCalculated')}
              </p>
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ─── Notes Card ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <StickyNote className={cn(iconSizes.md, 'text-violet-500')} />
            {t('general.notes')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="h-20 resize-none"
            />
          ) : (
            parking.notes ? (
              <p className="text-sm bg-muted/50 p-3 rounded-md">{parking.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )
          )}
        </CardContent>
      </Card>

      {/* ─── Update Information Card (read-only always) ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Calendar className={cn(iconSizes.md, 'text-slate-500')} />
            {t('general.updateInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {parking.createdAt && (
              <fieldset className="space-y-1.5">
                <Label className="text-muted-foreground">{t('general.fields.createdAt')}</Label>
                <p className="text-sm font-medium">{formatTimestamp(parking.createdAt)}</p>
              </fieldset>
            )}
            {parking.updatedAt && (
              <fieldset className="space-y-1.5">
                <Label className="text-muted-foreground">{t('general.fields.lastUpdated')}</Label>
                <p className="text-sm font-medium">{formatTimestamp(parking.updatedAt)}</p>
              </fieldset>
            )}
            {parking.createdBy && (
              <fieldset className="space-y-1.5">
                <Label className="text-muted-foreground">{t('general.fields.createdBy')}</Label>
                <p className="text-sm font-medium">{parking.createdBy}</p>
              </fieldset>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
