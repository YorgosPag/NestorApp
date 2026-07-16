/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * ADR-193: Storage general tab — inline editing, Cards layout, ADR-233 entity code
 *
 * Shape and schema are storage-specific; everything entity-agnostic comes from
 * the `space-info` primitives (ADR-588 §General tab).
 *
 * @see ADR-588 — space tab de-duplication
 * @see SPEC-256A — optimistic versioning (`useVersionedSave`)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Storage, StorageType } from '@/types/storage/contracts';
import {
  type StorageGeneralTabProps,
  type StorageFormState,
  STORAGE_TYPES,
  STORAGE_STATUSES,
  DEFAULT_STORAGE_TYPE,
  DEFAULT_STORAGE_STATUS,
  buildFormState,
} from './storage-general-tab-config';
import { Lock } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import {
  createStorageWithPolicy,
  updateStorageWithPolicy,
  type StorageMutationResult,
} from '@/services/storage-mutation-gateway';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { LabeledInputField } from '@/components/shared/space-info/LabeledInputField';
import { SpaceFloorCard } from '@/components/shared/space-info/SpaceFloorCard';
import { SpaceCoreFields } from '@/components/shared/space-info/SpaceCoreFields';
import {
  createSpaceDraft,
  createSpacePatch,
  buildSpaceRealtimeUpdates,
  type SpacePayloadBuilder,
} from '@/components/shared/space-info/space-payload-builder';
import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import { getBuildingsList } from '@/services/properties.service';
import type { FloorChangePayload } from '@/components/shared/FloorSelectField';
import { useEntityLink } from '@/hooks/useEntityLink';
import { EntityCodeField } from '@/components/shared/EntityCodeField';
import { parseFloorLevel } from '@/hooks/useEntityCodeSuggestion';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useVersionedSave } from '@/hooks/useVersionedSave';
import { useSpaceGeneralSave } from '@/hooks/useSpaceGeneralSave';
import {
  useSpaceNameSuggestion,
  type SpaceFormPatchApplier,
} from '@/hooks/useSpaceNameSuggestion';
import { DescriptionNotesCard } from '@/components/shared/space-info/DescriptionNotesCard';
import { buildBuildingLinkLabels } from '@/components/shared/space-info/building-link-labels';

const logger = createModuleLogger('StorageGeneralTab');

// ============================================================================
// PAYLOAD BUILDERS (module scope — referentially stable)
// ============================================================================

/** POST body: the shared space fields plus storage's own identity, floor doc and price. */
function buildStorageDraft(form: StorageFormState, buildingId: string | null): SpacePayloadBuilder {
  const draft = createSpaceDraft(
    { name: form.name.trim(), type: form.type, status: form.status },
    form,
    buildingId,
  );
  draft.optionalText('floorId', form.floorId);
  draft.optionalNumber('price', form.price);
  return draft;
}

/** PATCH body: only the fields that actually changed. */
function buildStoragePatch(
  form: StorageFormState,
  storage: Storage,
  linkPayload: Record<string, unknown>,
): SpacePayloadBuilder {
  const patch = createSpacePatch(form, storage, linkPayload);
  patch.textChanged('name', form.name, storage.name);
  patch.valueChanged('type', form.type, storage.type || DEFAULT_STORAGE_TYPE);
  patch.valueChanged('status', form.status, storage.status || DEFAULT_STORAGE_STATUS);
  patch.nullableTextChanged('floorId', form.floorId, storage.floorId);
  patch.nullableNumberChanged('price', form.price, storage.price);
  return patch;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StorageGeneralTab({
  storage,
  isEditing = false,
  onEditingChange,
  onSaveRef,
  createMode = false,
  onCreated,
}: StorageGeneralTabProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const { t } = useTranslation('storage');

  /** Guards against a double-submit while the POST is in flight. */
  const submittingRef = useRef(false);

  // Create mode error feedback
  const [createError, setCreateError] = useState<string | null>(null);

  // Form state — always bound to inputs (disabled when not editing)
  const [form, setForm] = useState<StorageFormState>(() => buildFormState(storage));

  // Reset form when a DIFFERENT storage is selected (not on edit mode toggle)
  useEffect(() => {
    setForm(buildFormState(storage));
    if (createMode) setCreateError(null);
  }, [storage.id]);

  const updateField = <K extends keyof StorageFormState>(key: K, value: StorageFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // ADR-233: createMode name auto-suggestion (SSoT hook)
  const applyNamePatch = useCallback<SpaceFormPatchApplier<StorageType>>(
    (patch) => setForm(prev => ({ ...prev, ...patch(prev) })),
    [],
  );

  const { handleNameChange, handleTypeChange, handleAreaChange } = useSpaceNameSuggestion<StorageType>({
    createMode,
    typeOptions: STORAGE_TYPES,
    defaultType: DEFAULT_STORAGE_TYPE,
    t,
    applyPatch: applyNamePatch,
  });

  // Building link callbacks
  const loadBuildings = useCallback(() => getBuildingsList(), []);

  // ADR-200: Centralized entity linking via useEntityLink
  const buildingLink = useEntityLink({
    relation: 'storage-building',
    entityId: storage.id,
    initialParentId: storage.buildingId ?? null,
    loadOptions: loadBuildings,
    saveMode: 'form',
    cascadingResets: [{ resetField: 'floor' }],
    onCascadingReset: (resets) => resets.forEach(r => updateField(r.field as keyof StorageFormState, r.value)),
    icon: NAVIGATION_ENTITIES.building.icon,
    iconColor: NAVIGATION_ENTITIES.building.color,
    cardId: 'storage-building-link',
    labels: buildBuildingLinkLabels(t),
  }, isEditing);

  // 🏢 SPEC-256A Phase 2: versioning SSoT — injects `_v`, bumps it on success and
  // silently retries without it on 409 (last-write-wins, never a dialog).
  const versionedSaveFn = useCallback(
    async (payload: Record<string, unknown> & { _v?: number }) => {
      const result = await updateStorageWithPolicy<StorageMutationResult>({
        storageId: storage.id,
        payload,
      });
      return { success: true, _v: result?._v };
    },
    [storage.id],
  );

  const versioned = useVersionedSave<Record<string, unknown>>({
    initialVersion: storage._v,
    entityId: storage.id,
    saveFn: versionedSaveFn,
  });

  // CREATE MODE: POST new storage
  const handleCreate = useCallback(async (): Promise<boolean> => {
    if (submittingRef.current) return false;
    submittingRef.current = true;
    setCreateError(null);

    if (!form.name.trim()) {
      submittingRef.current = false;
      setCreateError(t('storages.form.nameRequired'));
      return false;
    }

    const draft = buildStorageDraft(form, buildingLink.linkedId);

    try {
      const result = await createStorageWithPolicy<{ storageId: string }>({
        payload: draft.payload,
      });

      if (result?.storageId) {
        RealtimeService.dispatch('STORAGE_CREATED', {
          storageId: result.storageId,
          storage: draft.payload,
          timestamp: Date.now(),
        });
        logger.info('Storage created', { id: result.storageId });
        onCreated?.(result.storageId);
        return true;
      }

      setCreateError(t('storages.form.createError'));
      return false;
    } catch (err) {
      logger.error('Failed to create storage', {
        error: err instanceof Error ? err.message : String(err),
      });
      setCreateError(err instanceof Error ? err.message : t('storages.form.createError'));
      return false;
    } finally {
      submittingRef.current = false;
    }
  }, [form, buildingLink, onCreated, t]);

  // EDIT MODE: PATCH existing storage
  const handleUpdate = useCallback(async (): Promise<boolean> => {
    const patch = buildStoragePatch(form, storage, buildingLink.getPayload());

    // Nothing changed
    if (patch.isEmpty) {
      onEditingChange?.(false);
      return true;
    }

    await versioned.save(patch.payload);

    // Dispatch realtime event for cross-page sync
    RealtimeService.dispatch('STORAGE_UPDATED', {
      storageId: storage.id,
      updates: {
        name: form.name.trim(),
        ...buildSpaceRealtimeUpdates(form, buildingLink.linkedId),
      },
      timestamp: Date.now(),
    });

    logger.info('Storage updated', { id: storage.id });
    onEditingChange?.(false);
    return true;
  }, [form, storage, onEditingChange, buildingLink, versioned.save]);

  useSpaceGeneralSave({ createMode, onCreate: handleCreate, onUpdate: handleUpdate, onSaveRef, logger });

  return (
    <div className="p-2 space-y-2">
      {createMode && createError && (
        <p className="text-sm text-destructive px-1">{createError}</p>
      )}
      {/* Building Link + Floor — side by side at the top */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <EntityLinkCard key={buildingLink.linkCardKey} {...buildingLink.linkCardProps} />
        <SpaceFloorCard
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
      </div>

      {/* Basic Information Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <NAVIGATION_ENTITIES.storage.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.storage.color)} />
            {t('general.identity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* ADR-233: Entity Code field with auto-suggest */}
            <EntityCodeField
              value={form.code}
              onChange={(v) => updateField('code', v)}
              entityType="storage"
              buildingId={buildingLink.linkedId || ''}
              floorLevel={parseFloorLevel(form.floor ?? '')}
              label={t('general.fields.code')}
              placeholderFallback="A-AP-Y1.01"
              infoExample="π.χ. A-AP-Y1.01 (Κτίριο A, Αποθήκη, Υπόγ.1, #01)"
              disabled={!isEditing}
              variant="form"
              t={t}
            />
            <LabeledInputField
              label={t('general.fields.name')}
              value={form.name}
              onChange={handleNameChange}
              disabled={!isEditing}
            />
            <SpaceCoreFields
              t={t}
              disabled={!isEditing}
              type={{ value: form.type, options: STORAGE_TYPES, onChange: handleTypeChange }}
              status={{
                value: form.status,
                options: STORAGE_STATUSES,
                onChange: (v) => updateField('status', v),
              }}
              area={{ value: form.area, onChange: handleAreaChange }}
            />
            {/* Millesimal shares — read-only, from ownership table */}
            {storage.millesimalShares != null && storage.millesimalShares > 0 && (
              <fieldset className="space-y-1.5">
                <Label className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
                  <Lock className="h-3 w-3" />
                  {t('general.fields.millesimalShares')}
                </Label>
                <p className="text-sm font-semibold">{storage.millesimalShares}‰</p>
              </fieldset>
            )}
            <LabeledInputField
              label={t('general.fields.price')}
              value={form.price}
              onChange={(v) => updateField('price', v)}
              type="number"
              step="0.01"
              placeholder="€"
              disabled={!isEditing}
            />
          </div>
        </CardContent>
      </Card>

      {/* ADR-193: Financial Card (price, price/m², project) αφαιρέθηκε — εμπορικά πεδία ανήκουν στις Πωλήσεις */}

      {/* ADR-194: Description & Notes — SSoT shared card */}
      <DescriptionNotesCard form={form} isEditing={isEditing} onChange={updateField} t={t} />

      {/* ADR-195: Update Information Card αφαιρέθηκε — audit trail θα γίνει κεντρικά (EntityAuditService + ActivityTab) */}
    </div>
  );
}
