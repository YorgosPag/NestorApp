/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/** ADR-193: Storage general tab — inline editing, Cards layout, ADR-233 entity code */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { StorageType, StorageStatus } from '@/types/storage/contracts';
import {
  type StorageGeneralTabProps,
  type StorageFormState,
  type StoragePatchResult,
  STORAGE_TYPES,
  STORAGE_STATUSES,
  buildFormState,
} from './storage-general-tab-config';
import { MapPin, StickyNote, Lock } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ApiClientError } from '@/lib/api/enterprise-api-client';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createStorageWithPolicy, updateStorageWithPolicy } from '@/services/storage-mutation-gateway';
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
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import { getBuildingsList } from '@/services/properties.service';
import { FloorSelectField } from '@/components/shared/FloorSelectField';
import type { FloorChangePayload } from '@/components/shared/FloorSelectField';
import { useEntityLink } from '@/hooks/useEntityLink';
import { EntityCodeField } from '@/components/shared/EntityCodeField';
import { parseFloorLevel } from '@/hooks/useEntityCodeSuggestion';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

const logger = createModuleLogger('StorageGeneralTab');

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

  // 🏢 SPEC-256A Phase 2: track _v for optimistic concurrency, but any 409 is
  // resolved via silent last-write-wins retry below — never a dialog.
  const versionRef = useRef<number | undefined>((storage as unknown as { _v?: number })._v);

  // Create mode error feedback
  const [createError, setCreateError] = useState<string | null>(null);

  // Form state — always bound to inputs (disabled when not editing)
  const [form, setForm] = useState<StorageFormState>(() => buildFormState(storage));

  // Reset form when a DIFFERENT storage is selected (not on edit mode toggle)
  useEffect(() => {
    setForm(buildFormState(storage));
    versionRef.current = (storage as unknown as { _v?: number })._v;
    if (createMode) setCreateError(null);
  }, [storage.id]);

  // Building link callbacks
  const loadBuildings = useCallback(() => getBuildingsList(), []);

  const updateField = <K extends keyof StorageFormState>(key: K, value: StorageFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

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
    if (createMode) {
      setCreateError(null);

      if (!form.name.trim()) {
        setCreateError(t('storages.form.nameRequired'));
        return false;
      }

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        status: form.status,
      };
      if (form.code.trim()) payload.code = form.code.trim();
      if (buildingLink.linkedId) payload.buildingId = buildingLink.linkedId;
      if (form.floor.trim()) payload.floor = form.floor.trim();
      if (form.floorId) payload.floorId = form.floorId;
      if (form.area) payload.area = parseFloat(form.area);
      if (form.price) payload.price = parseFloat(form.price);
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();

      try {
        const result = await createStorageWithPolicy<{ storageId: string }>({ payload });

        if (result?.storageId) {
          RealtimeService.dispatch('STORAGE_CREATED', {
            storageId: result.storageId,
            storage: payload,
            timestamp: Date.now(),
          });
          logger.info('Storage created', { id: result.storageId });
          onCreated?.(result.storageId);
          return true;
        }

        setCreateError(t('storages.form.createError'));
        return false;
      } catch (err) {
        logger.error('Failed to create storage', { error: err instanceof Error ? err.message : String(err) });
        setCreateError(err instanceof Error ? err.message : t('storages.form.createError'));
        return false;
      }
    }

    try {

      // EDIT MODE: PATCH existing storage
      const payload: Record<string, unknown> = {};

      if (form.name.trim() !== (storage.name || '')) payload.name = form.name.trim();
      if (form.code.trim() !== (storage.code || '')) payload.code = form.code.trim() || null;
      if (form.type !== (storage.type || 'storage')) payload.type = form.type;
      if (form.status !== (storage.status || 'available')) payload.status = form.status;
      if (form.floor.trim() !== (storage.floor || '')) payload.floor = form.floor.trim();
      if (form.floorId !== (storage.floorId || '')) payload.floorId = form.floorId || null;

      const newArea = form.area ? parseFloat(form.area) : undefined;
      if (newArea !== storage.area) payload.area = newArea ?? null;

      const newPrice = form.price ? parseFloat(form.price) : undefined;
      if (newPrice !== storage.price) payload.price = newPrice ?? null;

      if (form.description.trim() !== (storage.description || '')) payload.description = form.description.trim();
      if (form.notes.trim() !== (storage.notes || '')) payload.notes = form.notes.trim();

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

      let result: (StoragePatchResult & { _v?: number }) | undefined;
      try {
        result = await updateStorageWithPolicy<StoragePatchResult & { _v?: number }>({
          storageId: storage.id,
          payload,
        });
      } catch (err) {
        if (ApiClientError.isApiClientError(err) && err.statusCode === 409) {
          logger.warn('Storage version conflict — silent retry without _v', { id: storage.id });
          delete payload._v;
          result = await updateStorageWithPolicy<StoragePatchResult & { _v?: number }>({
            storageId: storage.id,
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
      RealtimeService.dispatch('STORAGE_UPDATED', {
        storageId: storage.id,
        updates: {
          name: form.name.trim(),
          type: form.type,
          status: form.status,
          floor: form.floor.trim() || undefined,
          area: newArea,
          buildingId: buildingLink.linkedId,
        },
        timestamp: Date.now(),
      });

      logger.info('Storage updated', { id: storage.id });
      onEditingChange?.(false);
      return true;
    } catch (err) {
      logger.error('Failed to save storage', { error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }, [form, storage, onEditingChange, buildingLink, createMode, onCreated, t]);

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
    <div className="p-2 space-y-2">
      {createMode && createError && (
        <p className="text-sm text-destructive px-1">{createError}</p>
      )}
      {/* Building Link + Floor — side by side at the top */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
            <fieldset className="space-y-1.5">
              <Label className={cn("text-xs", colors.text.muted)}>{t('general.fields.name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="h-8 text-sm"
                disabled={!isEditing}
              />
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className={cn("text-xs", colors.text.muted)}>{t('general.fields.type')}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => updateField('type', v as StorageType)}
                disabled={!isEditing}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_TYPES.map(st => (
                    <SelectItem key={st.value} value={st.value}>
                      {t(st.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className={cn("text-xs", colors.text.muted)}>{t('general.fields.status')}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => updateField('status', v as StorageStatus)}
                disabled={!isEditing}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_STATUSES.map(ss => (
                    <SelectItem key={ss.value} value={ss.value}>
                      {t(ss.labelKey)}
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
                onChange={(e) => updateField('area', e.target.value)}
                placeholder="m²"
                className="h-8 text-sm"
                disabled={!isEditing}
              />
            </fieldset>
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
            <fieldset className="space-y-1.5">
              <Label className={cn("text-xs", colors.text.muted)}>{t('general.fields.price')}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => updateField('price', e.target.value)}
                placeholder="€"
                className="h-8 text-sm"
                disabled={!isEditing}
              />
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ADR-193: Financial Card (price, price/m², project) αφαιρέθηκε — εμπορικά πεδία ανήκουν στις Πωλήσεις */}

      {/* Description & Notes Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <StickyNote className={cn(iconSizes.md, 'text-violet-500')} />
            {t('general.descriptionNotes')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <fieldset className="space-y-1.5">
            <Label className={cn("text-xs", colors.text.muted)}>{t('general.fields.description')}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="h-20 text-sm resize-none"
              disabled={!isEditing}
            />
          </fieldset>
          <fieldset className="space-y-1.5">
            <Label className={cn("text-xs", colors.text.muted)}>{t('general.fields.notes')}</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="h-20 text-sm resize-none"
              disabled={!isEditing}
            />
          </fieldset>
        </CardContent>
      </Card>

      {/* ADR-195: Update Information Card αφαιρέθηκε — audit trail θα γίνει κεντρικά (EntityAuditService + ActivityTab) */}
    </div>
  );
}
