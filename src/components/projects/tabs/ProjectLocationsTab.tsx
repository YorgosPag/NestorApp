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
import { MapPin, Plus, Star, Trash2, ChevronDown, ChevronUp, Map, X, Pencil } from 'lucide-react';
import {
  getPrimaryAddress,
  migrateLegacyAddress,
  extractLegacyFields,
  createProjectAddress,
} from '@/types/project/address-helpers';
import { updateProjectClient } from '@/services/projects-client.service';
import toast from 'react-hot-toast';
import { useIconSizes } from '@/hooks/useIconSizes';

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
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const primary = getPrimaryAddress(localAddresses);

  return (
    <div className="space-y-6 p-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <MapPin className={iconSizes.lg} />
            Τοποθεσίες & Διευθύνσεις
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Διαχείριση όλων των διευθύνσεων του έργου
          </p>
        </div>
        {!isAddFormOpen && (
          <Button onClick={() => setIsAddFormOpen(true)} variant="default">
            <Plus className={`${iconSizes.sm} mr-2`} />
            Νέα Διεύθυνση
          </Button>
        )}
      </div>

      {/* 🗺️ ENTERPRISE: Address Map Integration (ADR-168) */}
      {localAddresses.length > 0 && !isAddFormOpen && editingIndex === null && (
        <AddressMap
          addresses={localAddresses}
          highlightPrimary={true}
          showGeocodingStatus={true}
          enableClickToFocus={true}
          onMarkerClick={handleMarkerClick}
          height={400}
          className="rounded-lg border shadow-sm"
        />
      )}

      {/* 🏢 ENTERPRISE: Inline Add Form (Procore Pattern) */}
      {isAddFormOpen && (
        <div className="border-2 border-primary rounded-lg p-6 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Plus className={iconSizes.md} />
              Προσθήκη Νέας Διεύθυνσης
            </h3>
            <Button variant="ghost" size="sm" onClick={handleCancelAdd}>
              <X className={iconSizes.sm} />
            </Button>
          </div>

          <AddressFormSection onChange={setTempAddress} />

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={handleCancelAdd} disabled={isSaving}>
              Ακύρωση
            </Button>
            <Button onClick={handleSaveNewAddress} disabled={isSaving}>
              {isSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </Button>
          </div>
        </div>
      )}

      {/* Addresses List */}
      {localAddresses.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <MapPin className={`${iconSizes.xl} mx-auto mb-4 text-muted-foreground`} />
          <h3 className="text-lg font-semibold mb-2">Δεν υπάρχουν διευθύνσεις</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Προσθέστε τουλάχιστον μία διεύθυνση για το έργο
          </p>
          <Button onClick={() => setIsAddFormOpen(true)}>
            <Plus className={`${iconSizes.sm} mr-2`} />
            Προσθήκη Πρώτης Διεύθυνσης
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Διευθύνσεις Έργου ({localAddresses.length})
            </h3>
          </div>

          {localAddresses.map((address, index) => (
            <div
              key={address.id}
              id={`address-card-${address.id}`}
              className="relative border rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              {/* 🏢 ENTERPRISE: Inline Edit Mode or Display Mode */}
              {editingIndex === index ? (
                // EDIT MODE: Inline form
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <Pencil className={iconSizes.md} />
                      Επεξεργασία Διεύθυνσης
                    </h4>
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                      <X className={iconSizes.sm} />
                    </Button>
                  </div>

                  <AddressFormSection
                    onChange={setEditedAddress}
                    initialValues={address}
                  />

                  <div className="flex gap-3 justify-end pt-4 border-t">
                    <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                      Ακύρωση
                    </Button>
                    <Button onClick={handleSaveEdit} disabled={isSaving}>
                      {isSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                    </Button>
                  </div>
                </div>
              ) : (
                // DISPLAY MODE: Address card with action buttons
                <>
                  <AddressCard address={address} />

                  {/* Action Buttons */}
                  <div className="absolute top-4 right-4 flex gap-2">
                    {/* Primary Badge or Set Primary Button */}
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

                    {/* Edit Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartEdit(index)}
                      title="Επεξεργασία διεύθυνσης"
                    >
                      <Pencil className={iconSizes.sm} />
                    </Button>

                    {/* Delete Button */}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteAddress(index)}
                      title="Διαγραφή διεύθυνσης"
                    >
                      <Trash2 className={iconSizes.sm} />
                    </Button>
                  </div>

                  {/* Metadata */}
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    <span>ID: {address.id.slice(0, 8)}...</span>
                    {address.sortOrder !== undefined && (
                      <span className="ml-4">Σειρά: {address.sortOrder}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectLocationsTab;
