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

import React, { useState, useCallback } from 'react';
import type { Project } from '@/types/project';
import type { ProjectAddress } from '@/types/project/addresses';
import { AddressCard, AddressFormSection } from '@/components/shared/addresses';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Star, Trash2, X, Pencil } from 'lucide-react';
import {
  getPrimaryAddress,
  migrateLegacyAddress,
  extractLegacyFields,
  createProjectAddress,
} from '@/types/project/address-helpers';
import { updateProjectClient } from '@/services/projects-client.service';
import toast from 'react-hot-toast';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface ProjectLocationsTabProps {
  data: Project;
  projectId?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectLocationsTab({ data: project }: ProjectLocationsTabProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: State management
  const [localAddresses, setLocalAddresses] = useState<ProjectAddress[]>(
    project.addresses ||
      (project.address && project.city
        ? migrateLegacyAddress(project.address, project.city)
        : [])
  );

  // 🏢 ENTERPRISE: Inline form state (Procore pattern)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [tempAddress, setTempAddress] = useState<Partial<ProjectAddress> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 🏢 ENTERPRISE: Edit mode state (inline editing)
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedAddress, setEditedAddress] = useState<Partial<ProjectAddress> | null>(null);

  // 🗺️ Reverse geocoding drag update — shared between add + edit mode
  const [dragUpdatedAddress, setDragUpdatedAddress] = useState<Partial<ProjectAddress> | null>(null);
  const [editDragAddress, setEditDragAddress] = useState<Partial<ProjectAddress> | null>(null);

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
        toast.success('Η κύρια διεύθυνση ενημερώθηκε επιτυχώς!');
        // Reload to refresh UI
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(result.error || 'Σφάλμα ενημέρωσης διεύθυνσης');
      }
    } catch (error) {
      toast.error('Σφάλμα ενημέρωσης διεύθυνσης');
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
   * Delete address
   */
  const handleDeleteAddress = async (index: number) => {
    if (localAddresses.length === 1) {
      toast.error('Δεν μπορείτε να διαγράψετε την τελευταία διεύθυνση!');
      return;
    }

    if (!confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη διεύθυνση;')) {
      return;
    }

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
        toast.success('Η διεύθυνση διαγράφηκε επιτυχώς!');
        // Reload to refresh UI
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(result.error || 'Σφάλμα διαγραφής διεύθυνσης');
      }
    } catch (error) {
      toast.error('Σφάλμα διαγραφής διεύθυνσης');
    }
  };

  /**
   * 🏢 ENTERPRISE: Save new address inline (Procore pattern)
   */
  const handleSaveNewAddress = async () => {
    if (!tempAddress || !tempAddress.street || !tempAddress.city) {
      toast.error('Παρακαλώ συμπληρώστε τουλάχιστον Οδό και Πόλη');
      return;
    }

    setIsSaving(true);

    try {
      const newAddress = createProjectAddress({
        ...tempAddress,
        street: tempAddress.street!,
        city: tempAddress.city!,
        isPrimary: localAddresses.length === 0, // First address = primary
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
        setTempAddress(null);
        setIsAddFormOpen(false);
        toast.success('Η διεύθυνση προστέθηκε επιτυχώς!');
        // Reload to refresh UI
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(result.error || 'Σφάλμα αποθήκευσης διεύθυνσης');
      }
    } catch (error) {
      toast.error('Σφάλμα αποθήκευσης διεύθυνσης');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Cancel add form
   */
  const handleCancelAdd = () => {
    setIsAddFormOpen(false);
    setTempAddress(null);
    setDragUpdatedAddress(null);
  };

  /**
   * 🏢 ENTERPRISE: Start editing existing address (inline)
   */
  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditedAddress({ ...localAddresses[index] });
  };

  /**
   * 🏢 ENTERPRISE: Save edited address
   */
  const handleSaveEdit = async () => {
    if (editingIndex === null || !editedAddress || !editedAddress.street || !editedAddress.city) {
      toast.error('Παρακαλώ συμπληρώστε τουλάχιστον Οδό και Πόλη');
      return;
    }

    setIsSaving(true);

    try {
      // Update the address in the array
      const newAddresses = localAddresses.map((addr, i) =>
        i === editingIndex
          ? {
              ...addr,
              ...editedAddress,
              street: editedAddress.street!,
              city: editedAddress.city!,
            }
          : addr
      );

      const legacy = extractLegacyFields(newAddresses);

      const result = await updateProjectClient(project.id!, {
        addresses: newAddresses,
        address: legacy.address,
        city: legacy.city,
      });

      if (result.success) {
        setLocalAddresses(newAddresses);
        setEditingIndex(null);
        setEditedAddress(null);
        toast.success('Η διεύθυνση ενημερώθηκε επιτυχώς!');
        // Reload to refresh UI
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(result.error || 'Σφάλμα ενημέρωσης διεύθυνσης');
      }
    } catch (error) {
      toast.error('Σφάλμα ενημέρωσης διεύθυνσης');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Cancel edit mode
   */
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditedAddress(null);
    setEditDragAddress(null);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const primary = getPrimaryAddress(localAddresses);

  // Show inline form (add/edit) in full-width mode
  const isInlineFormActive = isAddFormOpen || editingIndex !== null;

  return (
    <section className={spacing.spaceBetween.lg}>
      {/* Header Section */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className={cn(typography.heading.lg, "flex items-center", spacing.gap.sm)}>
            <MapPin className={iconSizes.lg} />
            Τοποθεσίες & Διευθύνσεις
          </h2>
          <p className={cn(typography.body.sm, colors.text.muted, spacing.margin.top.xs)}>
            Διαχείριση όλων των διευθύνσεων του έργου
          </p>
        </div>
        {!isAddFormOpen && (
          <Button onClick={() => setIsAddFormOpen(true)} variant="default">
            <Plus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
            Νέα Διεύθυνση
          </Button>
        )}
      </header>

      {/* Inline Add Form (full width — replaces 2-column layout) */}
      {isAddFormOpen && (
        <div className={cn("border-2 border-primary rounded-lg bg-card", spacing.padding.sm, spacing.spaceBetween.md)}>
          <div className="flex items-center justify-between">
            <h3 className={cn(typography.heading.md, "flex items-center", spacing.gap.sm)}>
              <Plus className={iconSizes.md} />
              Προσθήκη Νέας Διεύθυνσης
            </h3>
            <Button variant="ghost" size="sm" onClick={handleCancelAdd}>
              <X className={iconSizes.sm} />
            </Button>
          </div>

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

          <div className={cn("flex gap-3 justify-end border-t", spacing.padding.top.md)}>
            <Button variant="outline" onClick={handleCancelAdd} disabled={isSaving}>
              Ακύρωση
            </Button>
            <Button onClick={handleSaveNewAddress} disabled={isSaving}>
              {isSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </Button>
          </div>
        </div>
      )}

      {/* 2-Column Layout: Addresses LEFT, Map RIGHT */}
      {!isInlineFormActive && (
        <>
          {localAddresses.length === 0 ? (
            <div className={cn("text-center border-2 border-dashed rounded-lg", spacing.padding.y["2xl"])}>
              <MapPin className={cn(iconSizes.xl, "mx-auto", colors.text.muted, spacing.margin.bottom.md)} />
              <h3 className={cn(typography.heading.md, spacing.margin.bottom.sm)}>Δεν υπάρχουν διευθύνσεις</h3>
              <p className={cn(typography.body.sm, colors.text.muted, spacing.margin.bottom.md)}>
                Προσθέστε τουλάχιστον μία διεύθυνση για το έργο
              </p>
              <Button onClick={() => setIsAddFormOpen(true)}>
                <Plus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
                Προσθήκη Πρώτης Διεύθυνσης
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* LEFT COLUMN: Address Cards */}
              <aside className={spacing.spaceBetween.md}>
                <div className="flex items-center justify-between">
                  <h3 className={typography.heading.md}>
                    Διευθύνσεις Έργου ({localAddresses.length})
                  </h3>
                </div>

                {localAddresses.map((address, index) => (
                  <article
                    key={address.id}
                    id={`address-card-${address.id}`}
                    className={cn("relative border rounded-lg hover:shadow-md transition-shadow", spacing.padding.sm)}
                  >
                    {editingIndex === index ? (
                      <div className={spacing.spaceBetween.md}>
                        <div className={cn("flex items-center justify-between", spacing.margin.bottom.md)}>
                          <h4 className={cn(typography.heading.md, "flex items-center", spacing.gap.sm)}>
                            <Pencil className={iconSizes.md} />
                            Επεξεργασία Διεύθυνσης
                          </h4>
                          <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                            <X className={iconSizes.sm} />
                          </Button>
                        </div>

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

                        <div className={cn("flex gap-3 justify-end border-t", spacing.padding.top.md)}>
                          <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                            Ακύρωση
                          </Button>
                          <Button onClick={handleSaveEdit} disabled={isSaving}>
                            {isSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
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

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteAddress(index)}
                            title="Διαγραφή διεύθυνσης"
                          >
                            <Trash2 className={iconSizes.sm} />
                          </Button>
                        </div>

                        <div className={cn("border-t", typography.body.xs, colors.text.muted, spacing.margin.top.md, spacing.padding.top.md)}>
                          <span>ID: {address.id.slice(0, 8)}...</span>
                          {address.sortOrder !== undefined && (
                            <span className={spacing.margin.left.md}>Σειρά: {address.sortOrder}</span>
                          )}
                        </div>
                      </>
                    )}
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
    </section>
  );
}

export default ProjectLocationsTab;
