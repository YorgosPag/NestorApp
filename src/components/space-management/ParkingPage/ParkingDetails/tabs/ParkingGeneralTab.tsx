'use client';

/**
 * 🅿️ ENTERPRISE PARKING GENERAL TAB COMPONENT
 *
 * Γενικές πληροφορίες θέσης στάθμευσης.
 * Supports inline editing mode (toggled by parent header).
 * Fields always rendered as Input/Select (disabled when not editing) — Units prototype pattern.
 * Each section wrapped in Card for visual separation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ParkingSpot, ParkingSpotType, ParkingSpotStatus } from '@/hooks/useFirestoreParkingSpots';
import { Car, MapPin, Building2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import { getBuildingsList } from '@/services/units.service';
import { FloorSelectField } from '@/components/shared/FloorSelectField';
import type { FloorChangePayload } from '@/components/shared/FloorSelectField';
import { useEntityLink } from '@/hooks/useEntityLink';

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
  floorId: string;
  location: string;
  area: string;
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
    floorId: parking.floorId || '',
    location: parking.location || '',
    area: parking.area !== undefined ? String(parking.area) : '',
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
  const typography = useTypography();
  const { t } = useTranslation('parking');

  // Form state — always bound to inputs (disabled when not editing)
  const [form, setForm] = useState<ParkingFormState>(() => buildFormState(parking));

  // Reset form when a DIFFERENT parking spot is selected (not on edit mode toggle)
  useEffect(() => {
    setForm(buildFormState(parking));
  }, [parking.id]);

  // Building link callbacks
  const loadBuildings = useCallback(() => getBuildingsList(), []);

  const updateField = <K extends keyof ParkingFormState>(key: K, value: ParkingFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // ADR-200: Centralized entity linking via useEntityLink
  const buildingLink = useEntityLink({
    relation: 'parking-building',
    entityId: parking.id,
    initialParentId: parking.buildingId ?? null,
    loadOptions: loadBuildings,
    saveMode: 'form',
    cascadingResets: [{ resetField: 'floor' }],
    onCascadingReset: (resets) => resets.forEach(r => updateField(r.field as keyof ParkingFormState, r.value)),
    icon: Building2,
    cardId: 'parking-building-link',
    labels: {
      title: t('entityLinks.building.title'),
      label: t('entityLinks.building.label'),
      placeholder: t('entityLinks.building.placeholder'),
      noSelection: t('entityLinks.building.noSelection'),
      loading: t('entityLinks.building.loading'),
      save: t('entityLinks.building.save'),
      saving: t('entityLinks.building.saving'),
      success: t('entityLinks.building.success'),
      error: t('entityLinks.building.error'),
      currentLabel: t('entityLinks.building.currentLabel'),
    },
  }, isEditing);

  // Register save handler with parent via ref
  const handleSave = useCallback(async (): Promise<boolean> => {
    try {
      const payload: Record<string, unknown> = {};

      if (form.number.trim() !== (parking.number || '')) payload.number = form.number.trim();
      if (form.type !== (parking.type || 'standard')) payload.type = form.type;
      if (form.status !== (parking.status || 'available')) payload.status = form.status;
      if (form.floor.trim() !== (parking.floor || '')) payload.floor = form.floor.trim();
      if (form.floorId !== (parking.floorId || '')) payload.floorId = form.floorId || null;
      if (form.location.trim() !== (parking.location || '')) payload.location = form.location.trim();

      const newArea = form.area ? parseFloat(form.area) : undefined;
      if (newArea !== parking.area) payload.area = newArea ?? null;

      if (form.notes.trim() !== (parking.notes || '')) payload.notes = form.notes.trim();

      // ADR-200: Include building link change from centralized hook
      Object.assign(payload, buildingLink.getPayload());

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
          buildingId: buildingLink.linkedId,
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
  }, [form, parking, onEditingChange, buildingLink]);

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

  return (
    <div className="p-4 space-y-4">
      {/* Building Link + Floor — side by side at the top */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EntityLinkCard key={buildingLink.linkCardKey} {...buildingLink.linkCardProps} />
        <Card>
          <CardHeader className="p-2">
            <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
              <MapPin className={cn(iconSizes.md, 'text-emerald-500')} />
              {t('general.fields.floor')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <FloorSelectField
              buildingId={buildingLink.linkedId}
              value={form.floorId}
              onChange={(v: string, payload?: FloorChangePayload) => {
                updateField('floor', v);
                updateField('floorId', payload ? payload.floorId : '');
              }}
              label={t('general.fields.floor')}
              noBuildingHint={t('entityLinks.building.noFloorHint')}
              disabled={!isEditing}
            />
          </CardContent>
        </Card>
      </div>

      {/* Basic Information Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Car className={cn(iconSizes.md, 'text-blue-500')} />
            {t('general.identity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t('general.fields.spotCode')}</Label>
              <Input
                value={form.number}
                onChange={(e) => updateField('number', e.target.value)}
                className="h-8 text-sm"
                disabled={!isEditing}
              />
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t('general.fields.type')}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => updateField('type', v as ParkingSpotType)}
                disabled={!isEditing}
              >
                <SelectTrigger className="h-8 text-sm">
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
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t('general.fields.status')}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => updateField('status', v as ParkingSpotStatus)}
                disabled={!isEditing}
              >
                <SelectTrigger className="h-8 text-sm">
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
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t('general.fields.area')}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.area}
                onChange={(e) => updateField('area', e.target.value)}
                placeholder="m²"
                className="h-8 text-sm"
                disabled={!isEditing}
              />
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ADR-193: Financial Card (price, price/m²) αφαιρέθηκε — εμπορικά πεδία ανήκουν στις Πωλήσεις */}

      {/* ADR-194: Notes + Update Info cards αφαιρέθηκαν — audit trail θα γίνει κεντρικά (pending decision) */}
    </div>
  );
}
