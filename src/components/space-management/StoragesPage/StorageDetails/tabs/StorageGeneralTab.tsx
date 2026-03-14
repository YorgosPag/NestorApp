'use client';

/**
 * 📦 ENTERPRISE STORAGE GENERAL TAB COMPONENT
 *
 * Γενικές πληροφορίες αποθήκης.
 * ADR-193: Supports inline editing mode (toggled by parent header).
 * Fields always rendered as Input/Select (disabled when not editing) — Units prototype pattern.
 * Each section wrapped in Card for visual separation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Storage, StorageType, StorageStatus } from '@/types/storage/contracts';
import { Warehouse, MapPin, StickyNote, Building2 } from 'lucide-react';
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
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import { getBuildingsList } from '@/services/units.service';
import { FloorSelectField } from '@/components/shared/FloorSelectField';
import type { FloorChangePayload } from '@/components/shared/FloorSelectField';
import { useEntityLink } from '@/hooks/useEntityLink';

const logger = createModuleLogger('StorageGeneralTab');

// ============================================================================
// TYPES
// ============================================================================

interface StorageGeneralTabProps {
  storage: Storage;
  /** Inline editing active (from parent via globalProps) */
  isEditing?: boolean;
  /** Notify parent when editing state changes */
  onEditingChange?: (editing: boolean) => void;
  /** Ref for save delegation from header button */
  onSaveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}

interface StorageFormState {
  name: string;
  type: StorageType;
  status: StorageStatus;
  floor: string;
  floorId: string;
  area: string;
  description: string;
  notes: string;
}

interface StoragePatchResult {
  id: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_TYPES: { value: StorageType; labelKey: string }[] = [
  { value: 'large', labelKey: 'general.types.large' },
  { value: 'small', labelKey: 'general.types.small' },
  { value: 'basement', labelKey: 'general.types.basement' },
  { value: 'ground', labelKey: 'general.types.ground' },
  { value: 'special', labelKey: 'general.types.special' },
  { value: 'storage', labelKey: 'general.types.storage' },
  { value: 'garage', labelKey: 'general.types.garage' },
  { value: 'warehouse', labelKey: 'general.types.warehouse' },
];

const STORAGE_STATUSES: { value: StorageStatus; labelKey: string }[] = [
  { value: 'available', labelKey: 'general.statuses.available' },
  { value: 'occupied', labelKey: 'general.statuses.occupied' },
  { value: 'maintenance', labelKey: 'general.statuses.maintenance' },
  { value: 'reserved', labelKey: 'general.statuses.reserved' },
  { value: 'sold', labelKey: 'general.statuses.sold' },
  { value: 'unavailable', labelKey: 'general.statuses.unavailable' },
];

// ============================================================================
// HELPERS
// ============================================================================

function buildFormState(storage: Storage): StorageFormState {
  return {
    name: storage.name || '',
    type: storage.type || 'storage',
    status: storage.status || 'available',
    floor: storage.floor || '',
    floorId: storage.floorId || '',
    area: storage.area !== undefined ? String(storage.area) : '',
    description: storage.description || '',
    notes: storage.notes || '',
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StorageGeneralTab({
  storage,
  isEditing = false,
  onEditingChange,
  onSaveRef,
}: StorageGeneralTabProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const { t } = useTranslation('storage');

  // Form state — always bound to inputs (disabled when not editing)
  const [form, setForm] = useState<StorageFormState>(() => buildFormState(storage));

  // Reset form when a DIFFERENT storage is selected (not on edit mode toggle)
  useEffect(() => {
    setForm(buildFormState(storage));
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
    icon: Building2,
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
    try {
      const payload: Record<string, unknown> = {};

      if (form.name.trim() !== (storage.name || '')) payload.name = form.name.trim();
      if (form.type !== (storage.type || 'storage')) payload.type = form.type;
      if (form.status !== (storage.status || 'available')) payload.status = form.status;
      if (form.floor.trim() !== (storage.floor || '')) payload.floor = form.floor.trim();
      if (form.floorId !== (storage.floorId || '')) payload.floorId = form.floorId || null;

      const newArea = form.area ? parseFloat(form.area) : undefined;
      if (newArea !== storage.area) payload.area = newArea ?? null;

      if (form.description.trim() !== (storage.description || '')) payload.description = form.description.trim();
      if (form.notes.trim() !== (storage.notes || '')) payload.notes = form.notes.trim();

      // ADR-200: Include building link change from centralized hook
      Object.assign(payload, buildingLink.getPayload());

      // Nothing changed
      if (Object.keys(payload).length === 0) {
        onEditingChange?.(false);
        return true;
      }

      await apiClient.patch<StoragePatchResult>(`/api/storages/${storage.id}`, payload);

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
  }, [form, storage, onEditingChange, buildingLink]);

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
                if (payload) {
                  updateField('floorId', payload.floorId);
                }
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
            <Warehouse className={cn(iconSizes.md, 'text-blue-500')} />
            {t('general.identity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t('general.fields.name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="h-8 text-sm"
                disabled={!isEditing}
              />
            </fieldset>
            <fieldset className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t('general.fields.type')}</Label>
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
              <Label className="text-muted-foreground text-xs">{t('general.fields.status')}</Label>
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

      {/* ADR-193: Financial Card (price, price/m², project) αφαιρέθηκε — εμπορικά πεδία ανήκουν στις Πωλήσεις */}

      {/* Description & Notes Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <StickyNote className={cn(iconSizes.md, 'text-violet-500')} />
            {t('general.descriptionNotes')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">{t('general.fields.description')}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="h-20 text-sm resize-none"
              disabled={!isEditing}
            />
          </fieldset>
          <fieldset className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">{t('general.fields.notes')}</Label>
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
