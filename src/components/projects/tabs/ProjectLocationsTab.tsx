'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: ProjectLocationsTab Component (ADR-167)
 * =============================================================================
 *
 * Dedicated tab for managing project locations and addresses
 * Pattern: Procore, Salesforce, SAP Real Estate (INLINE EDITING)
 *
 * Features:
 * - List all project addresses with full details
 * - INLINE add/edit functionality (NO MODAL)
 * - Inline delete functionality
 * - Set as primary address
 * - Google Maps integration (optional)
 *
 * UX Pattern: Procore Construction Management
 * - Click "+ Νέα Διεύθυνση" → Inline form appears
 * - Fill fields → Click "Αποθήκευση" → Form collapses
 * - NO context switch, NO modal dialogs
 *
 * @enterprise Fortune 500-grade locations management
 * @created 2026-02-02
 * @updated 2026-02-02 - Refactored to inline editing (Procore pattern)
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { Project } from '@/types/project';
import type { ProjectAddress, ProjectAddressType, BlockSideDirection } from '@/types/project/addresses';
import { AddressCard } from '@/components/shared/addresses';
import { AddressWithHierarchy, type AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { ContactAddressMapPreview, type DragResolvedAddress } from '@/components/contacts/details/ContactAddressMapPreview';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { MapPin, Plus, Star, Trash2, X, Pencil, Eraser } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  getPrimaryAddress,
  migrateLegacyAddress,
  extractLegacyFields,
  createProjectAddress,
} from '@/types/project/address-helpers';
import { updateProjectClient } from '@/services/projects-client.service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// =============================================================================
// ADDRESS TYPE / BLOCK SIDE OPTIONS
// =============================================================================

const ADDRESS_TYPE_KEYS: readonly ProjectAddressType[] = [
  'site', 'entrance', 'delivery', 'legal', 'postal', 'billing', 'correspondence', 'other',
] as const;

const BLOCK_SIDE_KEYS: readonly BlockSideDirection[] = [
  'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'corner', 'internal',
] as const;

/** Convert ProjectAddress → AddressWithHierarchyValue for the centralized component */
function toHierarchyValue(addr: Partial<ProjectAddress>): Partial<AddressWithHierarchyValue> {
  return {
    street: addr.street ?? '',
    number: addr.number ?? '',
    postalCode: addr.postalCode ?? '',
    settlementName: addr.city ?? '',
    settlementId: null,
    communityName: addr.neighborhood ?? '',
    municipalUnitName: '',
    municipalityName: addr.municipality ?? '',
    municipalityId: null,
    regionalUnitName: addr.regionalUnit ?? '',
    regionName: addr.region ?? '',
    decentAdminName: '',
    majorGeoName: '',
  };
}

/** Convert AddressWithHierarchyValue → partial ProjectAddress fields
 *  🏢 ENTERPRISE: Uses conditional spread to avoid undefined values (Firestore rejects undefined) */
function fromHierarchyValue(val: AddressWithHierarchyValue): Partial<ProjectAddress> {
  return {
    street: val.street || '',
    city: val.settlementName || val.municipalityName || '',
    postalCode: val.postalCode || '',
    // Optional fields: only include if non-empty
    ...(val.number ? { number: val.number } : {}),
    ...(val.communityName ? { neighborhood: val.communityName } : {}),
    ...(val.municipalityName ? { municipality: val.municipalityName } : {}),
    ...(val.regionalUnitName ? { regionalUnit: val.regionalUnitName } : {}),
    ...(val.regionName ? { region: val.regionName } : {}),
  };
}

// =============================================================================
// TYPES
// =============================================================================

interface ProjectLocationsTabProps {
  data: Project;
  projectId?: string;
}

interface ProjectAddressFieldsProps {
  type: ProjectAddressType;
  blockSide: BlockSideDirection | typeof SELECT_CLEAR_VALUE;
  label: string;
  isPrimary: boolean;
  onTypeChange: (val: ProjectAddressType) => void;
  onBlockSideChange: (val: BlockSideDirection | typeof SELECT_CLEAR_VALUE) => void;
  onLabelChange: (val: string) => void;
  onIsPrimaryChange: (val: boolean) => void;
  t: (key: string) => string;
}

// =============================================================================
// PROJECT ADDRESS FIELDS — Type, Block Side, Label, Primary
// =============================================================================

function ProjectAddressFields({
  type, blockSide, label, isPrimary,
  onTypeChange, onBlockSideChange, onLabelChange, onIsPrimaryChange,
  t,
}: ProjectAddressFieldsProps) {
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <div className="space-y-1.5">
        <Label>{t('form.type')}</Label>
        <Select value={type} onValueChange={(v) => onTypeChange(v as ProjectAddressType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADDRESS_TYPE_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {t(`types.${key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{t('form.blockSide')}</Label>
        <Select
          value={blockSide}
          onValueChange={(v) =>
            onBlockSideChange(v === SELECT_CLEAR_VALUE ? SELECT_CLEAR_VALUE : v as BlockSideDirection)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('form.blockSidePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_CLEAR_VALUE}>{t('form.blockSideNone')}</SelectItem>
            {BLOCK_SIDE_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {t(`blockSides.${key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{t('form.label')}</Label>
        <Input
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={t('form.labelPlaceholder')}
        />
      </div>

      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={isPrimary}
            onCheckedChange={(checked) => onIsPrimaryChange(checked === true)}
          />
          <span className="text-sm">{t('form.isPrimary')}</span>
        </label>
      </div>
    </fieldset>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectLocationsTab({ data: project }: ProjectLocationsTabProps) {
  const { t } = useTranslation('addresses');
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();
  const { success, error } = useNotifications();

  // State management — derive addresses from project prop
  const [localAddresses, setLocalAddresses] = useState<ProjectAddress[]>(() =>
    project.addresses ||
      (project.address && project.city
        ? migrateLegacyAddress(project.address, project.city)
        : [])
  );

  // 🏢 ENTERPRISE: Sync localAddresses when project changes (forceMount keeps component alive)
  // Without this, switching projects shows stale addresses from the previous project
  useEffect(() => {
    const addresses = project.addresses ||
      (project.address && project.city
        ? migrateLegacyAddress(project.address, project.city)
        : []);
    setLocalAddresses(addresses);
  }, [project.id]);

  // Inline form state
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Add mode: hierarchy + project-specific fields
  const [addHierarchy, setAddHierarchy] = useState<Partial<AddressWithHierarchyValue>>({});
  const [addType, setAddType] = useState<ProjectAddressType>('site');
  const [addBlockSide, setAddBlockSide] = useState<BlockSideDirection | typeof SELECT_CLEAR_VALUE>(SELECT_CLEAR_VALUE);
  const [addLabel, setAddLabel] = useState('');
  const [addIsPrimary, setAddIsPrimary] = useState(false);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);

  // Edit mode state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editHierarchy, setEditHierarchy] = useState<Partial<AddressWithHierarchyValue>>({});
  const [editType, setEditType] = useState<ProjectAddressType>('site');
  const [editBlockSide, setEditBlockSide] = useState<BlockSideDirection | typeof SELECT_CLEAR_VALUE>(SELECT_CLEAR_VALUE);
  const [editLabel, setEditLabel] = useState('');
  const [editIsPrimary, setEditIsPrimary] = useState(false);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  /**
   * Set address as primary
   */
  const handleSetPrimary = async (index: number) => {
    const newAddresses = localAddresses.map((addr, i) => ({
      ...addr,
      isPrimary: i === index,
    }));

    const legacy = extractLegacyFields(newAddresses);

    try {
      const result = await updateProjectClient(project.id!, {
        addresses: newAddresses,
        address: legacy.address,
        city: legacy.city,
      });

      if (result.success) {
        setLocalAddresses(newAddresses);
        success('Η κύρια διεύθυνση ενημερώθηκε επιτυχώς!');
        // Reload to refresh UI
        // Local state is already updated — no need to reload
      } else {
        error(result.error || 'Σφάλμα ενημέρωσης διεύθυνσης');
      }
    } catch (_err) {
      error('Σφάλμα ενημέρωσης διεύθυνσης');
    }
  };

  /**
   * 🗺️ Handle marker click - scroll to address card
   */
  const handleMarkerClick = useCallback((address: ProjectAddress, index: number) => {
    // Scroll to address card
    const cardElement = document.getElementById(`address-card-${address.id}`);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Highlight card temporarily
      cardElement.classList.add('ring-2', 'ring-primary');
      setTimeout(() => {
        cardElement.classList.remove('ring-2', 'ring-primary');
      }, 2000);
    }
  }, []);

  /**
   * Request address deletion — opens confirmation dialog
   */
  const handleRequestDelete = (index: number) => {
    setDeleteTargetIndex(index);
    setDeleteDialogOpen(true);
  };

  /**
   * Confirm address deletion (called from DeleteConfirmDialog)
   */
  const handleConfirmDelete = async () => {
    if (deleteTargetIndex === null) return;
    const index = deleteTargetIndex;

    const newAddresses = localAddresses.filter((_, i) => i !== index);

    // If deleted address was primary, make the first one primary
    if (localAddresses[index]?.isPrimary && newAddresses.length > 0) {
      newAddresses[0].isPrimary = true;
    }

    const legacy = extractLegacyFields(newAddresses);

    try {
      const result = await updateProjectClient(project.id!, {
        addresses: newAddresses,
        address: legacy.address,
        city: legacy.city,
      });

      if (result.success) {
        setLocalAddresses(newAddresses);
        success('Η διεύθυνση διαγράφηκε επιτυχώς!');
      } else {
        error(result.error || 'Σφάλμα διαγραφής διεύθυνσης');
      }
    } catch {
      error('Σφάλμα διαγραφής διεύθυνσης');
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTargetIndex(null);
    }
  };

  /**
   * Clear primary address — empties all fields but keeps the address entry
   */
  const handleClearPrimaryAddress = async () => {
    const clearedAddress = createProjectAddress({
      city: '',
      street: '',
      type: localAddresses[0]?.type || 'site',
      isPrimary: true,
    });
    // Preserve the original ID
    clearedAddress.id = localAddresses[0].id;

    const newAddresses = [clearedAddress, ...localAddresses.slice(1)];
    const legacy = extractLegacyFields(newAddresses);

    try {
      const result = await updateProjectClient(project.id!, {
        addresses: newAddresses,
        address: legacy.address,
        city: legacy.city,
      });

      if (result.success) {
        setLocalAddresses(newAddresses);
        success('Η διεύθυνση καθαρίστηκε επιτυχώς!');
      } else {
        error(result.error || 'Σφάλμα καθαρισμού διεύθυνσης');
      }
    } catch {
      error('Σφάλμα καθαρισμού διεύθυνσης');
    }
  };

  /**
   * 🏢 ENTERPRISE: Save new address inline (Procore pattern)
   */
  const handleSaveNewAddress = async () => {
    const addressFields = fromHierarchyValue({ ...({ street: '', number: '', postalCode: '', settlementName: '', settlementId: null, communityName: '', communityId: null, municipalUnitName: '', municipalUnitId: null, municipalityName: '', municipalityId: null, regionalUnitName: '', regionalUnitId: null, regionName: '', regionId: null, decentAdminName: '', decentAdminId: null, majorGeoName: '', majorGeoId: null }), ...addHierarchy } as AddressWithHierarchyValue);
    if (!addressFields.city) {
      error('Παρακαλώ συμπληρώστε τουλάχιστον τον Οικισμό/Πόλη');
      return;
    }

    setIsSaving(true);
    try {
      // 🏢 ENTERPRISE: Avoid undefined values — Firestore rejects them
      const newAddress = createProjectAddress({
        ...addressFields,
        city: addressFields.city,
        type: addType,
        isPrimary: localAddresses.length === 0 || addIsPrimary,
        ...(addBlockSide !== SELECT_CLEAR_VALUE ? { blockSide: addBlockSide as BlockSideDirection } : {}),
        ...(addLabel ? { label: addLabel } : {}),
      });

      const newAddresses = [...localAddresses, newAddress];
      const legacy = extractLegacyFields(newAddresses);

      const result = await updateProjectClient(project.id!, {
        addresses: newAddresses,
        address: legacy.address,
        city: legacy.city,
      });

      if (result.success) {
        setLocalAddresses(newAddresses);
        handleCancelAdd();
        success('Η διεύθυνση προστέθηκε επιτυχώς!');
        // Local state is already updated — no need to reload
      } else {
        error(result.error || 'Σφάλμα αποθήκευσης διεύθυνσης');
      }
    } catch {
      error('Σφάλμα αποθήκευσης διεύθυνσης');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelAdd = () => {
    setIsAddFormOpen(false);
    setAddHierarchy({});
    setAddType('site');
    setAddBlockSide(SELECT_CLEAR_VALUE);
    setAddLabel('');
    setAddIsPrimary(false);
  };

  const handleStartEdit = (index: number) => {
    const addr = localAddresses[index];
    setEditingIndex(index);
    setEditHierarchy(toHierarchyValue(addr));
    setEditType(addr.type || 'site');
    setEditBlockSide(addr.blockSide || SELECT_CLEAR_VALUE);
    setEditLabel(addr.label || '');
    setEditIsPrimary(addr.isPrimary ?? false);
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null) return;
    const addressFields = fromHierarchyValue({ ...({ street: '', number: '', postalCode: '', settlementName: '', settlementId: null, communityName: '', communityId: null, municipalUnitName: '', municipalUnitId: null, municipalityName: '', municipalityId: null, regionalUnitName: '', regionalUnitId: null, regionName: '', regionId: null, decentAdminName: '', decentAdminId: null, majorGeoName: '', majorGeoId: null }), ...editHierarchy } as AddressWithHierarchyValue);
    if (!addressFields.city) {
      error('Παρακαλώ συμπληρώστε τουλάχιστον τον Οικισμό/Πόλη');
      return;
    }

    setIsSaving(true);
    try {
      // 🏢 ENTERPRISE: Avoid undefined values — Firestore rejects them
      const newAddresses = localAddresses.map((addr, i) => {
        if (i !== editingIndex) return addr;
        // Remove old optional fields, then spread new values
        const { blockSide: _bs, label: _lb, ...rest } = addr;
        return {
          ...rest,
          ...addressFields,
          city: addressFields.city!,
          type: editType,
          isPrimary: editIsPrimary,
          ...(editBlockSide !== SELECT_CLEAR_VALUE ? { blockSide: editBlockSide as BlockSideDirection } : {}),
          ...(editLabel ? { label: editLabel } : {}),
        };
      });

      const legacy = extractLegacyFields(newAddresses);
      const result = await updateProjectClient(project.id!, {
        addresses: newAddresses,
        address: legacy.address,
        city: legacy.city,
      });

      if (result.success) {
        setLocalAddresses(newAddresses);
        handleCancelEdit();
        success('Η διεύθυνση ενημερώθηκε επιτυχώς!');
        // Local state is already updated — no need to reload
      } else {
        error(result.error || 'Σφάλμα ενημέρωσης διεύθυνσης');
      }
    } catch {
      error('Σφάλμα ενημέρωσης διεύθυνσης');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditHierarchy({});
    setEditType('site');
    setEditBlockSide(SELECT_CLEAR_VALUE);
    setEditLabel('');
    setEditIsPrimary(false);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const primary = getPrimaryAddress(localAddresses);

  // Show inline form in full-width mode (replaces 2-column layout)
  const isInlineFormActive = isAddFormOpen || editingIndex !== null;

  return (
    <section className={spacing.spaceBetween.lg}>
      {/* Header Section */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className={cn(typography.heading.lg, "flex items-center", spacing.gap.sm)}>
            <MapPin className={iconSizes.lg} />
            {t('locations.title')}
          </h2>
          <p className={cn(typography.body.sm, colors.text.muted, spacing.margin.top.xs)}>
            {t('locations.subtitle')}
          </p>
        </div>
        {!isAddFormOpen && (
          <Button onClick={() => setIsAddFormOpen(true)} variant="default">
            <Plus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
            {t('locations.newAddress')}
          </Button>
        )}
      </header>

      {/* Inline Add Form — AddressWithHierarchy + project fields + map */}
      {isAddFormOpen && (
        <div className={cn("border-2 border-primary rounded-lg bg-card", spacing.padding.sm, spacing.spaceBetween.md)}>
          <div className="flex items-center justify-between">
            <h3 className={cn(typography.heading.md, "flex items-center", spacing.gap.sm)}>
              <Plus className={iconSizes.md} />
              {t('locations.addNewAddress')}
            </h3>
            <Button variant="ghost" size="sm" onClick={handleCancelAdd}>
              <X className={iconSizes.sm} />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="space-y-2">
              <AddressWithHierarchy
                value={addHierarchy}
                onChange={(val) => setAddHierarchy(val)}
              />
              <ProjectAddressFields
                type={addType}
                blockSide={addBlockSide}
                label={addLabel}
                isPrimary={addIsPrimary}
                onTypeChange={setAddType}
                onBlockSideChange={setAddBlockSide}
                onLabelChange={setAddLabel}
                onIsPrimaryChange={setAddIsPrimary}
                t={t}
              />
              <div className={cn("flex gap-2 justify-end border-t", spacing.padding.top.md)}>
                <Button variant="outline" onClick={handleCancelAdd} disabled={isSaving}>Ακύρωση</Button>
                <Button onClick={handleSaveNewAddress} disabled={isSaving}>
                  {isSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                </Button>
              </div>
            </div>

            <aside className="lg:sticky lg:top-0 lg:self-start lg:h-[calc(100vh-12rem)]">
              <ContactAddressMapPreview
                className="!min-h-0 h-full rounded-lg border shadow-sm"
                street={addHierarchy.street}
                streetNumber={addHierarchy.number}
                city={addHierarchy.settlementName}
                postalCode={addHierarchy.postalCode}
                municipality={addHierarchy.municipalityName}
                regionalUnit={addHierarchy.regionalUnitName}
                region={addHierarchy.regionName}
                draggable
                onDragResolve={(resolved: DragResolvedAddress) => {
                  setAddHierarchy(prev => ({
                    ...prev,
                    street: resolved.street,
                    number: resolved.number,
                    postalCode: resolved.postalCode,
                    settlementName: resolved.city,
                    settlementId: null,
                    communityName: '',
                    municipalUnitName: '',
                    municipalityName: '',
                    municipalityId: null,
                    regionalUnitName: '',
                    regionName: '',
                    decentAdminName: '',
                    majorGeoName: '',
                  }));
                }}
              />
            </aside>
          </div>
        </div>
      )}

      {/* Inline Edit Form — AddressWithHierarchy + project fields + map */}
      {editingIndex !== null && !isAddFormOpen && (
        <div className={cn("border-2 border-primary rounded-lg bg-card", spacing.padding.sm, spacing.spaceBetween.md)}>
          <div className="flex items-center justify-between">
            <h3 className={cn(typography.heading.md, "flex items-center", spacing.gap.sm)}>
              <Pencil className={iconSizes.md} />
              Επεξεργασία Διεύθυνσης
            </h3>
            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
              <X className={iconSizes.sm} />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="space-y-2">
              <AddressWithHierarchy
                value={editHierarchy}
                onChange={(val) => setEditHierarchy(val)}
              />
              <ProjectAddressFields
                type={editType}
                blockSide={editBlockSide}
                label={editLabel}
                isPrimary={editIsPrimary}
                onTypeChange={setEditType}
                onBlockSideChange={setEditBlockSide}
                onLabelChange={setEditLabel}
                onIsPrimaryChange={setEditIsPrimary}
                t={t}
              />
              <div className={cn("flex gap-2 justify-end border-t", spacing.padding.top.md)}>
                <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>Ακύρωση</Button>
                <Button onClick={handleSaveEdit} disabled={isSaving}>
                  {isSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                </Button>
              </div>
            </div>

            <aside className="lg:sticky lg:top-0 lg:self-start lg:h-[calc(100vh-12rem)]">
              <ContactAddressMapPreview
                className="!min-h-0 h-full rounded-lg border shadow-sm"
                contactId={localAddresses[editingIndex]?.id}
                street={editHierarchy.street}
                streetNumber={editHierarchy.number}
                city={editHierarchy.settlementName}
                postalCode={editHierarchy.postalCode}
                municipality={editHierarchy.municipalityName}
                regionalUnit={editHierarchy.regionalUnitName}
                region={editHierarchy.regionName}
                draggable
                onDragResolve={(resolved: DragResolvedAddress) => {
                  setEditHierarchy(prev => ({
                    ...prev,
                    street: resolved.street,
                    number: resolved.number,
                    postalCode: resolved.postalCode,
                    settlementName: resolved.city,
                    settlementId: null,
                    communityName: '',
                    municipalUnitName: '',
                    municipalityName: '',
                    municipalityId: null,
                    regionalUnitName: '',
                    regionName: '',
                    decentAdminName: '',
                    majorGeoName: '',
                  }));
                }}
              />
            </aside>
          </div>
        </div>
      )}

      {/* 2-Column Layout: Addresses LEFT, Map RIGHT (view mode) */}
      {!isInlineFormActive && (
        <>
          {localAddresses.length === 0 ? (
            <div className={cn("text-center border-2 border-dashed rounded-lg", spacing.padding.y["2xl"])}>
              <MapPin className={cn(iconSizes.xl, "mx-auto", colors.text.muted, spacing.margin.bottom.md)} />
              <h3 className={cn(typography.heading.md, spacing.margin.bottom.sm)}>{t('locations.noAddresses')}</h3>
              <p className={cn(typography.body.sm, colors.text.muted)}>
                {t('locations.noAddressesHint')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {/* LEFT COLUMN: Address Cards */}
              <aside className={spacing.spaceBetween.md}>
                <div className="flex items-center justify-between">
                  <h3 className={typography.heading.md}>
                    {t('locations.projectAddresses')} ({localAddresses.length})
                  </h3>
                </div>

                {localAddresses.map((address, index) => (
                  <article
                    key={address.id}
                    id={`address-card-${address.id}`}
                    className={cn("relative border rounded-lg hover:shadow-md transition-shadow", spacing.padding.sm)}
                  >
                    <AddressCard address={address} />

                    <div className={cn("absolute top-4 right-4 flex", spacing.gap.sm)}>
                      {address.isPrimary ? (
                        <Badge variant="default" className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          Κύρια
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetPrimary(index)}
                          title="Ορισμός ως κύρια διεύθυνση"
                        >
                          <Star className={iconSizes.sm} />
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEdit(index)}
                        title="Επεξεργασία διεύθυνσης"
                      >
                        <Pencil className={iconSizes.sm} />
                      </Button>

                      {index === 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearPrimaryAddress}
                          title="Καθαρισμός διεύθυνσης"
                        >
                          <Eraser className={iconSizes.sm} />
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRequestDelete(index)}
                          title="Διαγραφή διεύθυνσης"
                        >
                          <Trash2 className={iconSizes.sm} />
                        </Button>
                      )}
                    </div>

                    <div className={cn("border-t", typography.body.xs, colors.text.muted, spacing.margin.top.md, spacing.padding.top.md)}>
                      {address.type && (
                        <span>{t(`types.${address.type}`)}</span>
                      )}
                    </div>
                  </article>
                ))}
              </aside>

              {/* RIGHT COLUMN: Map — sticky, fills to bottom of viewport */}
              <aside className="hidden lg:block">
                <div className="sticky top-0 h-[calc(100vh-12rem)]">
                  <AddressMap
                    addresses={localAddresses}
                    highlightPrimary
                    showGeocodingStatus
                    enableClickToFocus
                    onMarkerClick={handleMarkerClick}
                    heightPreset="viewerFullscreen"
                    className="rounded-lg border shadow-sm !h-full"
                  />
                </div>
              </aside>

              {/* Mobile: Map below addresses */}
              <div className="lg:hidden">
                <AddressMap
                  addresses={localAddresses}
                  highlightPrimary
                  showGeocodingStatus
                  enableClickToFocus
                  onMarkerClick={handleMarkerClick}
                  heightPreset="viewerStandard"
                  className="rounded-lg border shadow-sm"
                />
              </div>
            </div>
          )}
        </>
      )}
      {/* Delete Confirmation Dialog — centralized component (ADR-003) */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Διαγραφή Διεύθυνσης"
        description="Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη διεύθυνση;"
        onConfirm={handleConfirmDelete}
        confirmText="Διαγραφή"
        cancelText="Ακύρωση"
      />
    </section>
  );
}

export default ProjectLocationsTab;
