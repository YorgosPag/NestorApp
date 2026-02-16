'use client';

/**
 * =============================================================================
 * ENTERPRISE: BuildingAddressesCard Component (ADR-167)
 * =============================================================================
 *
 * DUAL MODE address management for buildings:
 *
 * MODE 1 - Building WITH project (parent-child inheritance):
 *   Fetches parent project's addresses and shows them as selectable cards.
 *   User SELECTS which project addresses apply to this building.
 *   NO manual typing — prevents address mismatches.
 *
 * MODE 2 - Building WITHOUT project:
 *   Manual address entry with inline add/edit/delete (Procore pattern).
 *
 * Pattern: SAP Real Estate, Procore, Salesforce CPQ
 * Reuses ALL shared components (ZERO duplicates)
 *
 * @enterprise Fortune 500-grade address management
 * @created 2026-02-06
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectAddress } from '@/types/project/addresses';
import { AddressCard, AddressFormSection } from '@/components/shared/addresses';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Plus, Star, Trash2, X, Pencil, Check, AlertTriangle, Loader2, ExternalLink,
} from 'lucide-react';
import {
  migrateLegacyAddress,
  extractLegacyFields,
  createProjectAddress,
  formatAddressLine,
} from '@/types/project/address-helpers';
import { updateBuilding, getProjectAddresses } from '../../building-services';
import toast from 'react-hot-toast';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingAddressesCard');

// =============================================================================
// TYPES
// =============================================================================

interface BuildingAddressesCardProps {
  buildingId: string;
  projectId?: string;
  addresses?: ProjectAddress[];
  legacyAddress?: string;
  legacyCity?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BuildingAddressesCard({
  buildingId,
  projectId,
  addresses,
  legacyAddress,
  legacyCity,
}: BuildingAddressesCardProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const { t } = useTranslation('building');
  const router = useRouter();

  // ============================================================
  // STATE: Building's own addresses (selected or manual)
  // ============================================================
  const [localAddresses, setLocalAddresses] = useState<ProjectAddress[]>(
    addresses ||
      (legacyAddress && legacyCity
        ? migrateLegacyAddress(legacyAddress, legacyCity)
        : [])
  );

  // ============================================================
  // STATE: Parent project addresses (for Mode 1)
  // ============================================================
  const [projectAddresses, setProjectAddresses] = useState<ProjectAddress[]>([]);
  const [loadingProject, setLoadingProject] = useState(false);

  // ============================================================
  // STATE: Inline form (for Mode 2 - no project)
  // ============================================================
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [tempAddress, setTempAddress] = useState<Partial<ProjectAddress> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedAddress, setEditedAddress] = useState<Partial<ProjectAddress> | null>(null);

  // 🗺️ Reverse geocoding drag update — shared between add + edit mode
  const [dragUpdatedAddress, setDragUpdatedAddress] = useState<Partial<ProjectAddress> | null>(null);
  const [editDragAddress, setEditDragAddress] = useState<Partial<ProjectAddress> | null>(null);

  // ============================================================
  // Determine mode
  // ============================================================
  const hasProject = !!projectId;

  // ============================================================
  // EFFECT: Fetch project addresses when projectId exists
  // ============================================================
  useEffect(() => {
    if (!projectId) {
      setProjectAddresses([]);
      return;
    }

    const fetchAddresses = async () => {
      setLoadingProject(true);
      try {
        const result = await getProjectAddresses(projectId);
        setProjectAddresses(result.addresses);
      } catch (error) {
        logger.error('Failed to fetch project addresses', { error });
      } finally {
        setLoadingProject(false);
      }
    };

    fetchAddresses();
  }, [projectId]);

  // ============================================================
  // HELPER: Persist addresses to Firestore
  // ============================================================
  const persistAddresses = useCallback(async (
    newAddresses: ProjectAddress[]
  ): Promise<boolean> => {
    const legacy = extractLegacyFields(newAddresses);

    const result = await updateBuilding(buildingId, {
      addresses: newAddresses,
      address: legacy.address,
      city: legacy.city,
    });

    if (result.success) {
      setLocalAddresses(newAddresses);
      return true;
    }

    toast.error(result.error || t('address.labels.saveError'));
    return false;
  }, [buildingId, t]);

  // ============================================================
  // HELPER: Check if a project address is selected for this building
  // ============================================================
  const isAddressSelected = useCallback((projectAddr: ProjectAddress): boolean => {
    return localAddresses.some(la => la.id === projectAddr.id);
  }, [localAddresses]);

  // ============================================================
  // MODE 1 HANDLERS: Project address selection
  // ============================================================

  /** Toggle selection of a project address for this building */
  const handleToggleProjectAddress = async (projectAddr: ProjectAddress) => {
    setIsSaving(true);
    try {
      const isCurrentlySelected = isAddressSelected(projectAddr);

      let newAddresses: ProjectAddress[];

      if (isCurrentlySelected) {
        // Deselect: remove from building
        newAddresses = localAddresses.filter(la => la.id !== projectAddr.id);
        // If removed was primary and others remain, make first one primary
        if (projectAddr.isPrimary && newAddresses.length > 0) {
          newAddresses[0] = { ...newAddresses[0], isPrimary: true };
        }
      } else {
        // Select: add to building
        const addressToAdd: ProjectAddress = {
          ...projectAddr,
          // First address becomes primary if none exist
          isPrimary: localAddresses.length === 0 ? true : projectAddr.isPrimary,
        };
        newAddresses = [...localAddresses, addressToAdd];
      }

      const saved = await persistAddresses(newAddresses);
      if (saved) {
        toast.success(
          isCurrentlySelected
            ? t('address.labels.addressRemoved')
            : t('address.labels.addressLinked')
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  /** Set a selected address as primary for this building */
  const handleSetPrimaryFromProject = async (addr: ProjectAddress) => {
    const newAddresses = localAddresses.map(la => ({
      ...la,
      isPrimary: la.id === addr.id,
    }));

    const saved = await persistAddresses(newAddresses);
    if (saved) {
      toast.success(t('address.labels.primaryUpdated'));
    }
  };

  // ============================================================
  // MODE 2 HANDLERS: Manual address management (no project)
  // ============================================================

  const handleSetPrimary = async (index: number) => {
    const newAddresses = localAddresses.map((addr, i) => ({
      ...addr,
      isPrimary: i === index,
    }));
    const saved = await persistAddresses(newAddresses);
    if (saved) toast.success(t('address.labels.primaryUpdated'));
  };

  const handleDeleteAddress = async (index: number) => {
    if (localAddresses.length === 1) {
      toast.error(t('address.labels.cannotDeleteLast'));
      return;
    }
    if (!confirm(t('address.labels.confirmDelete'))) return;

    const newAddresses = localAddresses.filter((_, i) => i !== index);
    if (localAddresses[index]?.isPrimary && newAddresses.length > 0) {
      newAddresses[0] = { ...newAddresses[0], isPrimary: true };
    }

    const saved = await persistAddresses(newAddresses);
    if (saved) toast.success(t('address.labels.addressDeleted'));
  };

  const handleSaveNewAddress = async () => {
    if (!tempAddress || !tempAddress.street || !tempAddress.city) {
      toast.error(t('address.validation.streetRequired'));
      return;
    }
    setIsSaving(true);
    try {
      const newAddress = createProjectAddress({
        ...tempAddress,
        street: tempAddress.street,
        city: tempAddress.city,
        isPrimary: localAddresses.length === 0,
      });
      const saved = await persistAddresses([...localAddresses, newAddress]);
      if (saved) {
        setTempAddress(null);
        setIsAddFormOpen(false);
        toast.success(t('address.labels.addressAdded'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditedAddress({ ...localAddresses[index] });
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null || !editedAddress?.street || !editedAddress?.city) {
      toast.error(t('address.validation.streetRequired'));
      return;
    }
    setIsSaving(true);
    try {
      const newAddresses = localAddresses.map((addr, i) =>
        i === editingIndex
          ? { ...addr, ...editedAddress, street: editedAddress.street!, city: editedAddress.city! }
          : addr
      );
      const saved = await persistAddresses(newAddresses);
      if (saved) {
        setEditingIndex(null);
        setEditedAddress(null);
        toast.success(t('address.labels.addressUpdated'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkerClick = useCallback((addr: ProjectAddress) => {
    const el = document.getElementById(`building-address-card-${addr.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000);
    }
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  const selectedCount = localAddresses.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <MapPin className={iconSizes.md} />
            {t('address.labels.title')}
            {selectedCount > 0 && (
              <Badge variant="secondary">{selectedCount}</Badge>
            )}
          </CardTitle>

          {/* Add button only in Mode 2 (no project) */}
          {!hasProject && !isAddFormOpen && editingIndex === null && (
            <Button onClick={() => setIsAddFormOpen(true)} variant="default" size="sm">
              <Plus className={`${iconSizes.sm} mr-2`} />
              {t('address.labels.addAddress')}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ============================================================ */}
        {/* MODE 1: Building WITH project — Select from project addresses */}
        {/* ============================================================ */}
        {hasProject && (
          <>
            {loadingProject ? (
              <section className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className={cn(iconSizes.md, 'animate-spin')} />
                <span>{t('address.labels.loadingProjectAddresses')}</span>
              </section>
            ) : projectAddresses.length === 0 ? (
              /* Project has no addresses registered */
              <section className="text-center py-8 border-2 border-dashed rounded-lg">
                <AlertTriangle className={`${iconSizes.xl} mx-auto mb-4 text-amber-500`} />
                <h3 className="text-lg font-semibold mb-2">
                  {t('address.labels.projectNoAddresses')}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('address.labels.projectNoAddressesHint')}
                </p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => router.push(`/audit?projectId=${projectId}&tab=locations`)}
                >
                  <ExternalLink className={`${iconSizes.sm} mr-2`} />
                  {t('address.labels.goToProjectAddresses')}
                </Button>
              </section>
            ) : (
              /* Show project addresses as selectable cards */
              <>
                <p className="text-sm text-muted-foreground">
                  {t('address.labels.selectFromProject')}
                </p>

                <div className="space-y-3">
                  {projectAddresses.map((projAddr) => {
                    const selected = isAddressSelected(projAddr);
                    const isPrimaryInBuilding = localAddresses.find(
                      la => la.id === projAddr.id
                    )?.isPrimary;

                    return (
                      <div
                        key={projAddr.id}
                        id={`building-address-card-${projAddr.id}`}
                        className={cn(
                          'relative border-2 rounded-lg p-4 transition-all cursor-pointer',
                          selected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-muted hover:border-muted-foreground/30'
                        )}
                        onClick={() => !isSaving && handleToggleProjectAddress(projAddr)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (!isSaving) handleToggleProjectAddress(projAddr);
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Selection indicator */}
                          <div className={cn(
                            'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30'
                          )}>
                            {selected && <Check className="h-3 w-3" />}
                          </div>

                          {/* Address content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {formatAddressLine(projAddr)}
                              </span>
                              {projAddr.isPrimary && (
                                <Badge variant="outline" className="text-xs">
                                  {t('address.labels.projectPrimary')}
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {projAddr.type && (
                                <span>{t(`address.types.${projAddr.type}`)}</span>
                              )}
                              {projAddr.blockSide && (
                                <span>{t(`address.blockSides.${projAddr.blockSide}`)}</span>
                              )}
                              {projAddr.label && (
                                <span>{projAddr.label}</span>
                              )}
                            </div>
                          </div>

                          {/* Action buttons (only when selected) */}
                          {selected && (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              {isPrimaryInBuilding ? (
                                <Badge variant="default" className="flex items-center gap-1 text-xs">
                                  <Star className="h-3 w-3 fill-current" />
                                  {t('address.labels.primary')}
                                </Badge>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSetPrimaryFromProject(projAddr)}
                                  title={t('address.labels.setPrimary')}
                                  className="h-7 text-xs"
                                >
                                  <Star className="h-3 w-3 mr-1" />
                                  {t('address.labels.setPrimary')}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Warning: no address selected */}
                {selectedCount === 0 && (
                  <section className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className={cn(iconSizes.sm, 'text-amber-600 dark:text-amber-400 shrink-0')} />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {t('address.labels.noAddressSelected')}
                    </p>
                  </section>
                )}

                {/* Map for selected addresses */}
                {selectedCount > 0 && (
                  <AddressMap
                    addresses={localAddresses}
                    highlightPrimary
                    showGeocodingStatus
                    enableClickToFocus
                    onMarkerClick={handleMarkerClick}
                    heightPreset="viewerCompact"
                    className="rounded-lg border shadow-sm"
                  />
                )}
              </>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* MODE 2: Building WITHOUT project — Manual entry              */}
        {/* ============================================================ */}
        {!hasProject && (
          <>
            {/* Map */}
            {localAddresses.length > 0 && !isAddFormOpen && editingIndex === null && (
              <AddressMap
                addresses={localAddresses}
                highlightPrimary
                showGeocodingStatus
                enableClickToFocus
                onMarkerClick={handleMarkerClick}
                heightPreset="viewerCompact"
                className="rounded-lg border shadow-sm"
              />
            )}

            {/* Inline Add Form */}
            {isAddFormOpen && (
              <div className="border-2 border-primary rounded-lg p-6 bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Plus className={iconSizes.md} />
                    {t('address.labels.addAddress')}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => { setIsAddFormOpen(false); setTempAddress(null); }}>
                    <X className={iconSizes.sm} />
                  </Button>
                </div>
                {/* 🗺️ Draggable map for new address */}
                <AddressMap
                  addresses={[]}
                  draggableMarkers
                  onAddressDragUpdate={setDragUpdatedAddress}
                  heightPreset="viewerCompact"
                  className="rounded-lg border shadow-sm"
                />

                <AddressFormSection
                  onChange={setTempAddress}
                  externalValues={dragUpdatedAddress}
                />
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button variant="outline" onClick={() => { setIsAddFormOpen(false); setTempAddress(null); setDragUpdatedAddress(null); }} disabled={isSaving}>
                    {t('tabs.general.header.cancel')}
                  </Button>
                  <Button onClick={handleSaveNewAddress} disabled={isSaving}>
                    {isSaving ? t('tabs.general.header.saving') : t('tabs.general.header.save')}
                  </Button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {localAddresses.length === 0 && !isAddFormOpen && (
              <section className="text-center py-8 border-2 border-dashed rounded-lg">
                <MapPin className={`${iconSizes.xl} mx-auto mb-4 text-muted-foreground`} />
                <h3 className="text-lg font-semibold mb-2">{t('address.labels.noAddresses')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('address.labels.addFirstAddress')}
                </p>
                <Button onClick={() => setIsAddFormOpen(true)}>
                  <Plus className={`${iconSizes.sm} mr-2`} />
                  {t('address.labels.addAddress')}
                </Button>
              </section>
            )}

            {/* Address list (manual mode) */}
            {localAddresses.length > 0 && !isAddFormOpen && (
              <div className="space-y-3">
                {localAddresses.map((address, index) => (
                  <div
                    key={address.id}
                    id={`building-address-card-${address.id}`}
                    className="relative border rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    {editingIndex === index ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold flex items-center gap-2">
                            <Pencil className={iconSizes.md} />
                            {t('address.labels.editAddress')}
                          </h4>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingIndex(null); setEditedAddress(null); }}>
                            <X className={iconSizes.sm} />
                          </Button>
                        </div>
                        {/* 🗺️ Draggable map for edit mode */}
                        <AddressMap
                          addresses={[address]}
                          draggableMarkers
                          onAddressDragUpdate={setEditDragAddress}
                          heightPreset="viewerCompact"
                          className="rounded-lg border shadow-sm"
                        />

                        <AddressFormSection
                          onChange={setEditedAddress}
                          initialValues={address}
                          externalValues={editDragAddress}
                        />
                        <div className="flex gap-3 justify-end pt-4 border-t">
                          <Button variant="outline" onClick={() => { setEditingIndex(null); setEditedAddress(null); setEditDragAddress(null); }} disabled={isSaving}>
                            {t('tabs.general.header.cancel')}
                          </Button>
                          <Button onClick={handleSaveEdit} disabled={isSaving}>
                            {isSaving ? t('tabs.general.header.saving') : t('tabs.general.header.save')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <AddressCard address={address} />
                        <div className="absolute top-4 right-4 flex gap-2">
                          {address.isPrimary ? (
                            <Badge variant="default" className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              {t('address.labels.primary')}
                            </Badge>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => handleSetPrimary(index)} title={t('address.labels.setPrimary')}>
                              <Star className={iconSizes.sm} />
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => handleStartEdit(index)} title={t('address.labels.editAddress')}>
                            <Pencil className={iconSizes.sm} />
                          </Button>
                          {localAddresses.length > 1 && (
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteAddress(index)} title={t('address.labels.removeAddress')}>
                              <Trash2 className={iconSizes.sm} />
                            </Button>
                          )}
                        </div>
                        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                          <span>ID: {address.id.slice(0, 8)}...</span>
                          {address.blockSide && <span className="ml-4">{t(`address.blockSides.${address.blockSide}`)}</span>}
                          {address.type && <span className="ml-4">{t(`address.types.${address.type}`)}</span>}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
