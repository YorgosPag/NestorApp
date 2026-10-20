/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Documents Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for document upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 * - Entry point selection for document types
 * - EXCLUDES photos, videos, and floorplans (they have dedicated tabs)
 * - ADR-915 §36: πάνω από τα αρχεία, «Μόνιμες υποχρεώσεις του ακινήτου» — η πρόταση ΥΔΕ από τη γέννηση του ακινήτου
 *   και η απόφαση εδώ (ίδια ενότητα · ίδιος γραφέας με το μητρώο). `next/dynamic`: εκτός κλειστότητας του κελύφους (3.34).
 *
 * @module features/properties-sidebar/components/DocumentsTab
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { DOCUMENTS_TAB_PURPOSE } from '@/components/shared/files/hooks/useEntityFiles-purpose-filter';
import type { Property } from '@/types/property-viewer';
import { usePropertyFilesTab } from './property-files-tab';

const PropertyUpkeepSection = dynamic(
  () => import('@/components/document-registry/PropertyUpkeepSection').then((mod) => mod.PropertyUpkeepSection),
  { ssr: false },
);

interface DocumentsTabProps {
  selectedProperty: Property | null;
}

/**
 * - Domain: sales (default for unit documents) · Category: documents
 * - Entry points: ALL except photos, videos, and floorplans
 */
export function DocumentsTab({ selectedProperty }: DocumentsTabProps) {
  const { identity, fallback } = usePropertyFilesTab(selectedProperty, 'documents');

  if (!identity) return fallback;

  return (
    <>
      {selectedProperty === null ? null : <PropertyUpkeepSection propertyId={selectedProperty.id} />}
      <EntityFilesManager
        {...identity}
        domain="sales"
        category="documents"
        purpose={DOCUMENTS_TAB_PURPOSE}
        entryPointExcludeCategories={['photos', 'videos', 'floorplans']}
        fetchAllDomains
      />
    </>
  );
}
