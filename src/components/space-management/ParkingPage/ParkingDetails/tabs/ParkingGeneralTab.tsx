/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * 🅿️ ENTERPRISE PARKING GENERAL TAB COMPONENT
 *
 * Γενικές πληροφορίες θέσης στάθμευσης.
 * Supports inline editing mode (toggled by parent header).
 * Fields always rendered as Input/Select (disabled when not editing) — Units prototype pattern.
 * Each section wrapped in Card for visual separation.
 *
 * Shape and schema are parking-specific; everything entity-agnostic comes from
 * the `space-info` primitives (ADR-588 §General tab).
 *
 * @see ADR-588 — space tab de-duplication
 * @see SPEC-256A — optimistic versioning (`useVersionedSave`)
 */

import { useState, useEffect, useCallback } from 'react';
import type { ParkingSpot, ParkingSpotType } from '@/hooks/useFirestoreParkingSpots';
import { Car } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import {
  createParkingWithPolicy,
  updateParkingWithPolicy,
  type ParkingMutationResult,
} from '@/services/parking-mutation-gateway';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LabeledInputField } from '@/components/shared/space-info/LabeledInputField';
import { SpaceFloorCard } from '@/components/shared/space-info/SpaceFloorCard';
import {
  createSpaceDraft,
  createSpacePatch,
  buildSpaceRealtimeUpdates,
  type SpacePayloadBuilder,
} from '@/components/shared/space-info/space-payload-builder';
import { SpaceCoreFields } from '@/components/shared/space-info/SpaceCoreFields';
import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/telemetry';
import { useParkingNotifications } from '@/hooks/notifications/useParkingNotifications';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import { getBuildingsList } from '@/services/properties.service';
import { useEntityLink } from '@/hooks/useEntityLink';
import { EntityCodeField } from '@/components/shared/EntityCodeField';
import { parseFloorLevel } from '@/hooks/useEntityCodeSuggestion';
import { useVersionedSave } from '@/hooks/useVersionedSave';
import { useSpaceGeneralSave } from '@/hooks/useSpaceGeneralSave';
import {
  useSpaceNameSuggestion,
  type SpaceFormPatchApplier,
} from '@/hooks/useSpaceNameSuggestion';
import { DescriptionNotesCard } from '@/components/shared/space-info/DescriptionNotesCard';
import { buildBuildingLinkLabels } from '@/components/shared/space-info/building-link-labels';
import {
  type ParkingGeneralTabProps,
  type ParkingFormState,
  PARKING_TYPES,
  PARKING_STATUSES,
  DEFAULT_PARKING_TYPE,
  DEFAULT_PARKING_STATUS,
  buildFormState,
} from './parking-general-tab-config';

const logger = createModuleLogger('ParkingGeneralTab');

// ============================================================================
// PAYLOAD BUILDERS (module scope — referentially stable)
// ============================================================================

/** POST body: the shared space fields plus parking's own identity and location. */
function buildParkingDraft(form: ParkingFormState, buildingId: string | null): SpacePayloadBuilder {
  const draft = createSpaceDraft(
    { number: form.name.trim(), type: form.type, status: form.status },
    form,
    buildingId,
  );
  draft.optionalText('location', form.location);
  return draft;
}

/** PATCH body: only the fields that actually changed. */
function buildParkingPatch(
  form: ParkingFormState,
  parking: ParkingSpot,
  linkPayload: Record<string, unknown>,
): SpacePayloadBuilder {
  const patch = createSpacePatch(form, parking, linkPayload);
  patch.textChanged('number', form.name, parking.number);
  patch.valueChanged('type', form.type, parking.type || DEFAULT_PARKING_TYPE);
  patch.valueChanged('status', form.status, parking.status || DEFAULT_PARKING_STATUS);
  patch.textChanged('location', form.location, parking.location);
  return patch;
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
  const typography = useTypography();
  const { t } = useTranslation('parking');
  const parkingNotifications = useParkingNotifications();

  // Form state — always bound to inputs (disabled when not editing)
  const [form, setForm] = useState<ParkingFormState>(() => buildFormState(parking));

  // Reset form when a DIFFERENT parking spot is selected (not on edit mode toggle)
  useEffect(() => {
    setForm(buildFormState(parking));
  }, [parking.id]);

  const updateField = <K extends keyof ParkingFormState>(key: K, value: ParkingFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // ADR-233: createMode name auto-suggestion (SSoT hook)
  const applyNamePatch = useCallback<SpaceFormPatchApplier<ParkingSpotType>>(
    (patch) => setForm(prev => ({ ...prev, ...patch(prev) })),
    [],
  );

  const { handleNameChange, handleTypeChange, handleAreaChange } = useSpaceNameSuggestion<ParkingSpotType>({
    createMode,
    typeOptions: PARKING_TYPES,
    defaultType: DEFAULT_PARKING_TYPE,
    t,
    applyPatch: applyNamePatch,
  });

  // Building link callbacks
  const loadBuildings = useCallback(() => getBuildingsList(), []);

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
    labels: buildBuildingLinkLabels(t),
  }, isEditing);

  // 🏢 SPEC-256A Phase 2: versioning SSoT — injects `_v`, bumps it on success and
  // silently retries without it on 409 (last-write-wins, never a dialog).
  const versionedSaveFn = useCallback(
    async (payload: Record<string, unknown> & { _v?: number }) => {
      const result = await updateParkingWithPolicy<ParkingMutationResult>({
        parkingSpotId: parking.id,
        payload,
      });
      return { success: true, _v: result?._v };
    },
    [parking.id],
  );

  const versioned = useVersionedSave<Record<string, unknown>>({
    initialVersion: parking._v,
    entityId: parking.id,
    saveFn: versionedSaveFn,
  });

  // CREATE MODE: POST new parking spot
  const handleCreate = useCallback(async (): Promise<boolean> => {
    if (!form.name.trim()) return false;

    const draft = buildParkingDraft(form, buildingLink.linkedId);
    const result = await createParkingWithPolicy<{ parkingSpotId: string }>({
      payload: draft.payload,
    });

    if (result?.parkingSpotId) {
      RealtimeService.dispatch('PARKING_CREATED', {
        parkingSpotId: result.parkingSpotId,
        parkingSpot: draft.payload,
        timestamp: Date.now(),
      });
      logger.info('Parking spot created', { id: result.parkingSpotId });
      parkingNotifications.created();
      onCreated?.(result.parkingSpotId);
    }
    return true;
  }, [form, buildingLink, onCreated, parkingNotifications]);

  // EDIT MODE: PATCH existing parking spot
  const handleUpdate = useCallback(async (): Promise<boolean> => {
    const patch = buildParkingPatch(form, parking, buildingLink.getPayload());

    // Nothing changed
    if (patch.isEmpty) {
      onEditingChange?.(false);
      return true;
    }

    await versioned.save(patch.payload);

    // Dispatch realtime event for cross-page sync
    RealtimeService.dispatch('PARKING_UPDATED', {
      parkingSpotId: parking.id,
      updates: {
        number: form.name.trim(),
        ...buildSpaceRealtimeUpdates(form, buildingLink.linkedId),
      },
      timestamp: Date.now(),
    });

    logger.info('Parking spot updated', { id: parking.id });
    onEditingChange?.(false);
    return true;
  }, [form, parking, onEditingChange, buildingLink, versioned.save]);

  useSpaceGeneralSave({ createMode, onCreate: handleCreate, onUpdate: handleUpdate, onSaveRef, logger });

  return (
    <div className="p-4 space-y-4">
      {/* Building Link + Floor — side by side at the top */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EntityLinkCard key={buildingLink.linkCardKey} {...buildingLink.linkCardProps} />
        <SpaceFloorCard
          buildingId={buildingLink.linkedId}
          value={form.floor}
          valueMode="floor"
          fallbackFloor={form.floor}
          onChange={(v: string) => updateField('floor', v)}
          label={t('general.fields.floor')}
          noBuildingHint={t('entityLinks.building.noFloorHint')}
          disabled={!isEditing}
        />
      </div>

      {/* Basic Information Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Car className={cn(iconSizes.md, 'text-primary')} />
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
            <LabeledInputField
              label={t('general.fields.spotName')}
              value={form.name}
              onChange={handleNameChange}
              disabled={!isEditing}
            />
            <SpaceCoreFields
              t={t}
              disabled={!isEditing}
              type={{ value: form.type, options: PARKING_TYPES, onChange: handleTypeChange }}
              status={{
                value: form.status,
                options: PARKING_STATUSES,
                onChange: (v) => updateField('status', v),
              }}
              area={{ value: form.area, onChange: handleAreaChange }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ADR-193: Financial Card (price, price/m²) αφαιρέθηκε — εμπορικά πεδία ανήκουν στις Πωλήσεις */}

      {/* ADR-194: Description & Notes — SSoT shared card (DescriptionNotesCard) */}
      <DescriptionNotesCard form={form} isEditing={isEditing} onChange={updateField} t={t} />
    </div>
  );
}
