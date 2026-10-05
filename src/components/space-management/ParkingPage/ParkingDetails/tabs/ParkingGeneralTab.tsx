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

import { useCallback } from 'react';
import type { ParkingSpot, ParkingSpotType } from '@/hooks/useFirestoreParkingSpots';
import { Car } from 'lucide-react';
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
import {
  createSpaceDraft,
  createSpacePatch,
  buildSpaceRealtimeUpdates,
  type SpacePayloadBuilder,
} from '@/components/shared/space-info/space-payload-builder';
import { SpaceCoreFields } from '@/components/shared/space-info/SpaceCoreFields';
import { useSpaceFormState } from '@/components/shared/space-info/useSpaceFormState';
import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/telemetry';
import { useParkingNotifications } from '@/hooks/notifications/useParkingNotifications';
import { useSpaceBuildingLink } from '@/components/shared/space-info/useSpaceBuildingLink';
import { EntityCodeField } from '@/components/shared/EntityCodeField';
import { useSpaceLocation } from '@/components/shared/space-info/useSpaceLocation';
import { useVersionedSave } from '@/hooks/useVersionedSave';
import { useSpaceGeneralSave } from '@/hooks/useSpaceGeneralSave';
import { SpaceCommercialCard, useSpaceCommercial } from '@/components/shared/commercial';
import {
  useSpaceNameSuggestion,
  type SpaceFormPatchApplier,
} from '@/hooks/useSpaceNameSuggestion';
import { DescriptionNotesCard } from '@/components/shared/space-info/DescriptionNotesCard';
import {
  type ParkingGeneralTabProps,
  type ParkingFormState,
  PARKING_TYPES,
  DEFAULT_PARKING_TYPE,
  buildFormState,
} from './parking-general-tab-config';

const logger = createModuleLogger('ParkingGeneralTab');

// ============================================================================
// PAYLOAD BUILDERS (module scope — referentially stable)
// ============================================================================

/** POST body: the shared space fields plus parking's own identity and location. */
function buildParkingDraft(form: ParkingFormState, buildingId: string | null): SpacePayloadBuilder {
  const draft = createSpaceDraft(
    { number: form.name.trim(), type: form.type },
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
  const { t } = useTranslation(['parking', 'properties-enums']);
  const parkingNotifications = useParkingNotifications();

  // Form state — always bound to inputs (disabled when not editing)
  // ADR-777 §8.60.20 — νέα επιλογή ⇒ reset· προβολή ⇒ ακολουθεί τον server· επεξεργασία ⇒ πρόχειρο.
  const [form, setForm] = useSpaceFormState(parking, isEditing, buildFormState);
  // ADR-777 §8.60.18 — διάθεση + τιμή ανά ρόλο: το ΙΔΙΟ πρόχειρο με τη γρήγορη επεξεργασία.
  const commercial = useSpaceCommercial(parking);

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

  // ADR-200 + ADR-898 §21.6 Ε6: σύνδεσμος κτιρίου — οι επιλογές περιορίζονται στο έργο της θέσης (SSoT hook)
  const buildingLink = useSpaceBuildingLink({
    relation: 'parking-building',
    space: parking,
    t,
    isEditing,
    onFloorReset: () => updateField('floorId', ''),
    cardId: 'parking-building-link',
  });

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
    patch.merge(commercial.patchAgainst(parking));

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
  }, [form, parking, onEditingChange, buildingLink, versioned.save, commercial]);

  // ADR-903 §6 — κτίριο + όροφος (ο όροφος του κωδικού παράγεται από το `floorId`).
  const location = useSpaceLocation({
    buildingLink, entity: parking, floorId: form.floorId, onFloorIdChange: (id) => updateField('floorId', id),
    t, disabled: !isEditing, gridClassName: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  });

  useSpaceGeneralSave({
    createMode, onCreate: handleCreate, onUpdate: handleUpdate, onSaveRef,
    scope: 'ParkingGeneralTab', failureMessage: t('entityLinks.building.error'),
  });

  return (
    <div className="p-4 space-y-4">
      {/* Building Link + Floor — side by side at the top */}
      {location.section}

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
              floorLevel={location.hostFloor?.number ?? ''}
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
              operationalStatus={{
                value: form.operationalStatus,
                onChange: (v) => updateField('operationalStatus', v),
              }}
              area={{ value: form.area, onChange: handleAreaChange }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ADR-193 → ADR-777 §8.60.18: η διάθεση επιστρέφει ως ΧΩΡΙΣΤΗ ομάδα (όχι ανάμειξη με τα
          φυσικά), με το ίδιο πρωτότυπο με το ακίνητο. Νέα θέση ⇒ εκτός αγοράς μέχρι να δηλωθεί. */}
      {!createMode && (
        <SpaceCommercialCard
          commercial={commercial}
          area={parking.area ?? undefined}
          pricingType="parking"
          isEditing={isEditing}
          idPrefix={`parking-${parking.id}`}
        />
      )}

      {/* ADR-194: Description & Notes — SSoT shared card (DescriptionNotesCard) */}
      <DescriptionNotesCard form={form} isEditing={isEditing} onChange={updateField} t={t} />
    </div>
  );
}
