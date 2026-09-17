/**
 * Unit Floorplan Tab — ADR-031, ADR-033, ADR-236 Phase 3
 *
 * Multi-level properties (maisonettes, shops) show level sub-tabs
 * so the admin can upload/view one floorplan per level.
 * Single-level properties: no sub-tabs, unchanged behavior.
 *
 * @module features/properties-sidebar/components/FloorPlanTab
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { ListingFloorplansPanel } from '@/components/listings/ListingFloorplansPanel';
import { LevelTabStrip } from '@/features/property-details/components/PropertyFieldsReadOnly';
import { PublishedModelFreshness } from '@/components/listings/PublishedModelFreshness';
import { useCompanyId } from '@/hooks/useCompanyId';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { FLOORPLAN_ACCEPT } from '@/config/file-upload-config';
import type { Property } from '@/types/property-viewer';
import { usePropertyFilesTab } from './property-files-tab';

interface FloorPlanTabProps {
  selectedProperty: Property | null;
}

export function FloorPlanTab({ selectedProperty }: FloorPlanTabProps) {
  const fallbackCompanyId = useCompanyId()?.companyId;
  const unitCompanyId = (selectedProperty as Record<string, unknown> | null)?.companyId as string | undefined;

  // 🧹 Συνεδρία, όνομα εταιρείας (ΕΝΑ hook, με φρουρό ακύρωσης) και placeholders ζουν στο
  // `property-files-tab` — ήταν δίδυμα με Photos/Videos/Documents (CHECK 3.28).
  const { t, identity, companyId, fallback } = usePropertyFilesTab(selectedProperty, 'floorplan', {
    companyId: unitCompanyId || fallbackCompanyId,
  });

  // Multi-level: active level selection
  const levels = selectedProperty?.levels ?? [];
  const isMultiLevel = !!selectedProperty?.isMultiLevel && levels.length >= 2;
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);

  // Reset level selection when property changes
  useEffect(() => {
    if (isMultiLevel && levels.length > 0) {
      const sorted = [...levels].sort((a, b) => a.floorNumber - b.floorNumber);
      setActiveLevelId(sorted[0].floorId);
    } else {
      setActiveLevelId(null);
    }
  }, [selectedProperty?.id, isMultiLevel, levels.length]);


  if (!identity || !selectedProperty || !companyId) return fallback;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 🏆 ADR-845 Ο-25 — «ισχύει ακόμα το δημοσιευμένο 3Δ;». ΕΝΑ σώμα, δύο οθόνες: το ίδιο
          component κάθεται και στον διάλογο «Δημοσίευση 3D» του viewer. Εδώ σε τόνο `badge`,
          γιατί η **διόρθωση** ζει στον viewer — αυτή η οθόνη πληροφορεί, δεν δημοσιεύει. */}
      <div className="px-2 pt-2">
        <PublishedModelFreshness propertyId={selectedProperty?.id} companyId={companyId} />
      </div>

      {/* Level sub-tabs for multi-level properties (ADR-236 Phase 3) */}
      {isMultiLevel && (
        <div className="px-2 pt-2 pb-1">
          <LevelTabStrip
            levels={levels}
            activeLevelId={activeLevelId}
            onSelectLevel={setActiveLevelId}
            t={t}
          />
        </div>
      )}

      <EntityFilesManager
        {...identity}
        domain="construction"
        category="floorplans"
        purpose={FLOORPLAN_PURPOSES.PROPERTY}
        entryPointCategoryFilter="floorplans"
        displayStyle="floorplan-gallery"
        acceptedTypes={FLOORPLAN_ACCEPT}
        levelFloorId={activeLevelId ?? undefined}
      />

      {/*
        🔴 **Η ΠΡΑΞΗ ΤΗΣ ΚΑΤΟΨΗΣ** (ADR-841 §7 Α17.7 — κλείνει το Ο-21).

        Μπαίνει **εδώ** επειδή εδώ ζουν οι κατόψεις του ακινήτου, και **από κάτω** επειδή
        η ερώτηση *«ποια φεύγει στην αγγελία;»* προϋποθέτει την απάντηση *«ποιες
        υπάρχουν;»* που δίνει ο διαχειριστής από πάνω.

        ⛔ **Δεν αγγίζει τον `EntityFilesManager`**: εκείνος είναι γενικός *(έργα · κτίρια ·
        όροφοι)* και δεν του ανήκει λεξιλόγιο αγγελίας. Είναι **αδελφός**, όχι τροποποίηση.
      */}
      <ListingFloorplansPanel
        propertyId={String(selectedProperty.id)}
        companyId={companyId}
        storedFloorplans={selectedProperty.publishedFloorplans}
      />
    </div>
  );
}
