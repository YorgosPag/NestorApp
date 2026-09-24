/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Photos Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for photo upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Smart compression for images
 * - Multi-tenant Storage Rules
 * - Entry point selection for photo types
 * - Media gallery display style
 *
 * @module features/properties-sidebar/components/PhotosTab
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Path:
 * companies/{companyId}/entities/unit/{propertyId}/domains/sales/categories/photos/files/
 */

'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { ListingMediaOrderPanel } from '@/components/listings/ListingMediaOrderPanel';
import { DEFAULT_PHOTO_ACCEPT } from '@/config/file-upload-config';
import type { Property } from '@/types/property-viewer';
import { usePropertyFilesTab } from './property-files-tab';

interface PhotosTabProps {
  selectedProperty: Property | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * 🏢 ENTERPRISE: Unit Photos Tab
 *
 * Displays unit photos using centralized EntityFilesManager with:
 * - Domain: sales
 * - Category: photos
 * - DisplayStyle: media-gallery
 * - Entry points: interior photos, exterior photos, etc.
 *
 * 🔴 **Η ΠΡΑΞΗ ΣΕΙΡΑΣ ΤΟΥ ΓΡΑΦΕΙΟΥ** (ADR-841 §7 Α14.7 — κλείνει το Ο-16).
 *
 * Μπαίνει **εδώ** και όχι μέσα στον `EntityFilesManager` επειδή εκείνος είναι
 * **γενικός** *(επαφές · έργα · κτίρια · όροφοι)*, ενώ *«ποια φωτογραφία είναι πρώτη
 * **στην αγγελία**;»* έχει νόημα μόνο για ακίνητο. Είναι **αδελφός**, όχι
 * τροποποίηση κεντρικού εξαρτήματος.
 *
 * 🔑 Και μπαίνει **από κάτω**, όχι από πάνω: η ερώτηση της σειράς προϋποθέτει την
 * απάντηση της εξουσιοδότησης *(«ποιες είναι δημόσιες;»)*, που δίνεται στη λίστα
 * αρχείων ακριβώς από πάνω. Η οθόνη διαβάζεται με τη σειρά που ρωτιέται.
 */
export function PhotosTab({
  selectedProperty,
}: PhotosTabProps) {
  const { identity, companyId, fallback } = usePropertyFilesTab(selectedProperty, 'photos');

  if (!identity || !selectedProperty || !companyId) return fallback;

  return (
    <>
      <EntityFilesManager
        {...identity}
        domain="sales"
        category="photos"
        purpose="photo"
        entryPointCategoryFilter="photos"
        displayStyle="media-gallery"
        acceptedTypes={DEFAULT_PHOTO_ACCEPT}
      />

      <ListingMediaOrderPanel
        propertyId={String(selectedProperty.id)}
        companyId={companyId}
        storedOrder={selectedProperty.publishedMediaOrder}
        storedFloorplans={selectedProperty.publishedFloorplans}
        storedFocalPoints={selectedProperty.publishedMediaFocalPoints}
      />
    </>
  );
}
