/* eslint-disable design-system/prefer-design-system-imports, design-system/enforce-semantic-colors */
'use client';

/**
 * 🅿️ ENTERPRISE PARKING GENERAL TAB COMPONENT
 *
 * Γενικές πληροφορίες θέσης στάθμευσης.
 * Supports inline editing mode (toggled by parent header).
 * Fields always rendered as Input/Select (disabled when not editing) — Units prototype pattern.
 * Each section wrapped in Card for visual separation.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ParkingSpot, ParkingSpotType, ParkingSpotStatus } from '@/hooks/useFirestoreParkingSpots';
import { Car, MapPin } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ApiClientError } from '@/lib/api/enterprise-api-client';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createParkingWithPolicy, updateParkingWithPolicy } from '@/services/parking-mutation-gateway';
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
import { useParkingNotifications } from '@/hooks/notifications/useParkingNotifications';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import { getBuildingsList } from '@/services/properties.service';
import { FloorSelectField } from '@/components/shared/FloorSelectField';
import type { FloorChangePayload } from '@/components/shared/FloorSelectField';
import { useEntityLink } from '@/hooks/useEntityLink';
import { EntityCodeField } from '@/components/shared/EntityCodeField';
import { parseFloorLevel } from '@/hooks/useEntityCodeSuggestion';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useEntityNameSuggestion } from '@/hooks/useEntityNameSuggestion';
import { DescriptionNotesCard } from '@/components/shared/space-info/DescriptionNotesCard';

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
  /** Create mode: POST new entity instead of PATCH existing */
  createMode?: boolean;
  /** Callback when entity is created successfully (create mode only) */
  onCreated?: (id: string) => void;
}

interface ParkingFormState {
  number: string;
  /** ADR-233: Entity coding system */
  code: string;
  type: ParkingSpotType;
  status: ParkingSpotStatus;
  floor: string;
  floorId: string;
  location: string;
  area: string;
  description: string;
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
    code: parking.code || '',
    type: parking.type || 'standard',
    status: parking.status || 'available',
    floor: parking.floor || '',
    floorId: parking.floorId || '',
    location: parking.location || '',
    area: parking.area !== undefined ? String(parking.area) : '',
    description: parking.description || '',
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
  createMode = false,
  onCreated,
}: ParkingGeneralTabProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const { t } = useTranslation('parking');
  const parkingNotifications = useParkingNotifications();

  // 🏢 SPEC-256A Phase 2: track _v for optimistic concurrency, but any 409 is
  // resolved via silent last-write-wins retry below — never a dialog.
  const versionRef = useRef<number | undefined>((parking as unknown as { _v?: number })._v);

  // Form state — always bound to inputs (disabled when not editing)
  const [form, setForm] = useState<ParkingFormState>(() => buildFormState(parking));

  // Reset form when a DIFFERENT parking spot is selected (not on edit mode toggle)
  useEffect(() => {
    setForm(buildFormState(parking));
    versionRef.current = (parking as unknown as { _v?: number })._v;
  }, [parking.id]);

  // ADR-233: Name suggestion for createMode
  const buildName = useEntityNameSuggestion();
  const nameManuallyChanged = useRef(false);

  // Seed initial name when in createMode (translations are loaded at mount time)
  useEffect(() => {
    if (createMode) {
      setForm(prev => ({ ...prev, number: buildName(t('types.standard'), 0) }));
    }
  // Runs once on mount — intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Building link callbacks
  const loadBuildings = useCallback(() => getBuildingsList(), []);

  const updateField = <K extends keyof ParkingFormState>(key: K, value: ParkingFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleNumberChange = useCallback((value: string) => {
    nameManuallyChanged.current = true;
    updateField('number', value);
  }, []);

  const handleTypeChange = useCallback((v: ParkingSpotType) => {
    if (createMode && !nameManuallyChanged.current) {
      setForm(prev => ({ ...prev, type: v, number: buildName(t(`types.${v}`), parseFloat(prev.area) || 0) }));
    } else {
      updateField('type', v);
    }
  }, [buildName, t, createMode]);

  const handleAreaChange = useCallback((value: string) => {
    if (createMode && !nameManuallyChanged.current) {
      setForm(prev => ({ ...prev, area: value, number: buildName(t(`types.${prev.type}`), parseFloat(value) || 0) }));
    } else {
      updateField('area', value);
    }
  }, [buildName, t, createMode]);

  // ADR-200: Centralized entity linking via useEntityLink
  const buildingLink = useEntityLink({
    relation: 'parking-building',
    entityId: parking.id,
    initialParentId: parking.buildingId ?? null,
    loadOptions: loadBuildings,
    saveMode: 'form',
    cascadingResets: [{ resetField: 'floor' }],
    onCascadingReset: (resets) => resets.forEach(r => updateField(r.field as keyof ParkingFormState, r.value)),
    icon: NAVIGATION_ENTITIES.building.icon,
    iconColor: NAVIGATION_ENTITIES.building.color,
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
      if (createMode) {
        // CREATE MODE: POST new parking spot
        if (!form.number.trim()) return false;

        const payload: Record<string, unknown> = {
          number: form.number.trim(),
          type: form.type,
          status: form.status,
        };
        if (form.code.trim()) payload.code = form.code.trim();
        if (buildingLink.linkedId) payload.buildingId = buildingLink.linkedId;
        if (form.floor.trim()) payload.floor = form.floor.trim();
        if (form.floorId) payload.floorId = form.floorId;
        if (form.location.trim()) payload.location = form.location.trim();
        if (form.area) payload.area = parseFloat(form.area);
        if (form.description.trim()) payload.description = form.description.trim();
        if (form.notes.trim()) payload.notes = form.notes.trim();

        const result = await createParkingWithPolicy<{ parkingSpotId: string }>({ payload });

        if (result?.parkingSpotId) {
          RealtimeService.dispatch('PARKING_CREATED', {
            parkingSpotId: result.parkingSpotId,
            parkingSpot: payload,
            timestamp: Date.now(),
          });
          logger.info('Parking spot created', { id: result.parkingSpotId });
          parkingNotifications.created();
          onCreated?.(result.parkingSpotId);
        }
        return true;
      }

      // EDIT MODE: PATCH existing parking spot
      const payload: Record<string, unknown> = {};

      if (form.number.trim() !== (parking.number || '')) payload.number = form.number.trim();
      if (form.code.trim() !== (parking.code || '')) payload.code = form.code.trim() || null;
      if (form.type !== (parking.type || 'standard')) payload.type = form.type;
      if (form.status !== (parking.status || 'available')) payload.status = form.status;
      if (form.floor.trim() !== (parking.floor || '')) payload.floor = form.floor.trim();
      if (form.floorId !== (parking.floorId || '')) payload.floorId = form.floorId || null;
      if (form.location.trim() !== (parking.location || '')) payload.location = form.location.trim();

      const newArea = form.area ? parseFloat(form.area) : undefined;
      if (newArea !== parking.area) payload.area = newArea ?? null;

      if (form.description.trim() !== (parking.description || '')) payload.description = form.description.trim();
      if (form.notes.trim() !== (parking.notes || '')) payload.notes = form.notes.trim();

      // ADR-200: Include building link change from centralized hook
      Object.assign(payload, buildingLink.getPayload());

      // Nothing changed
      if (Object.keys(payload).length === 0) {
        onEditingChange?.(false);
        return true;
      }

      // SPEC-256A Phase 2: Include _v so the server can still audit the
      // version; on 409 we silently retry without _v (last-write-wins).
      if (versionRef.current !== undefined) {
        payload._v = versionRef.current;
      }

      let result: (ParkingPatchResult & { _v?: number }) | undefined;
      try {
        result = await updateParkingWithPolicy<ParkingPatchResult & { _v?: number }>({
          parkingSpotId: parking.id,
          payload,
        });
      } catch (err) {
        if (ApiClientError.isApiClientError(err) && err.statusCode === 409) {
          logger.warn('Parking version conflict — silent retry without _v', { id: parking.id });
          delete payload._v;
          result = await updateParkingWithPolicy<ParkingPatchResult & { _v?: number }>({
            parkingSpotId: parking.id,
            payload,
          });
        } else {
          throw err;
        }
      }

      if (typeof result?._v === 'number') {
        versionRef.current = result._v;
      }

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
  }, [form, parking, onEditingChange, buildingLink, createMode, onCreated]);

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
            {/* ADR-233: Entity Code field with auto-suggest */}
            <EntityCodeField
              value={form.code}
              onChange={(v) => updateField('code', v)}
              entityType="parking"
              buildingId={buildingLink.linkedId || ''}
              floorLevel={parseFloorLevel(form.floor ?? '')}
              locationZone={parking.locationZone || undefined}
              label={t('general.fields.code')}
              placeholderFallback="A-PK-Y1.01"
              infoExample="π.χ. A-PK-Y1.01 (Κτίριο A, Parking, Υπόγ.1, #01)"
              disabled={!isEditing}
              variant="form"
              t={t}
            />
            <fieldset className="space-y-1.5">
              <Label className={cn("text-xs", colors.text.muted)}>{t('general.fields.spotName')}</Label>
              <Input
                value={form.number}
                onChange={(e) => handleNumberChange(e.target.value)}
                className="h-8 text-sm"
                disabled={!isEditing}
              />
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className={cn("text-xs", colors.text.muted)}>{t('general.fields.type')}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => handleTypeChange(v as ParkingSpotType)}
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
              <Label className={cn("text-xs", colors.text.muted)}>{t('general.fields.status')}</Label>
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
              <Label className={cn("text-xs", colors.text.muted)}>{t('general.fields.area')}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.area}
                onChange={(e) => handleAreaChange(e.target.value)}
                placeholder="m²"
                className="h-8 text-sm"
                disabled={!isEditing}
              />
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ADR-193: Financial Card (price, price/m²) αφαιρέθηκε — εμπορικά πεδία ανήκουν στις Πωλήσεις */}

      {/* ADR-194: Description & Notes — SSoT shared card (DescriptionNotesCard) */}
      <DescriptionNotesCard
        description={form.description}
        notes={form.notes}
        isEditing={isEditing}
        onDescriptionChange={(v) => updateField('description', v)}
        onNotesChange={(v) => updateField('notes', v)}
        labels={{
          title: t('general.descriptionNotes'),
          description: t('general.fields.description'),
          notes: t('general.fields.notes'),
        }}
      />
    </div>
  );
}
