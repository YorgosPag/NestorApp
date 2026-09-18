'use client';

/**
 * @fileoverview **Οι καρτέλες του φακέλου ακινήτου** — τέσσερις καρτέλες αρχείων + Ιστορικό, **κανένα** νέο συστατικό αρχείων.
 * @related ADR-866 Φ1.2 · §2.9.3 (Κ1 · Κ4) · §2.9.1 Α6 · ADR-588 (κέλυφος) · ADR-195 (ιστορικό)
 * @module components/property-dossier/PropertyDossierTabs
 *
 * 🔑 **Το ίδιο κέλυφος με τις θέσεις στάθμευσης και τις αποθήκες** (`EntityMediaFilesTab` + τα **ίδια** τέσσερα
 * `*_MEDIA_CONFIG`) — η μόνη διαφορά είναι η **σύνδεση** (`propertyDossierMediaBinding`), που δηλώνει κάτοχο-άνθρωπο.
 * Τα αρχεία γράφονται στο `people/{uid}/entities/property_dossier/{pdos}/…` από τη μηχανή της Φ0, χωρίς δεύτερο αγωγό.
 *
 * 🔑 **Ιστορικό = `ActivityTab` στο ΠΡΟΣΩΠΙΚΟ βιβλίο** (`ledger: 'personal'`): ο φάκελος είναι πάντα προσωπικός
 * (Ε-Φ1.1-1), άρα το βιβλίο **δεν** κρίνεται ανά φάκελο — σε αντίθεση με την αγγελία, που μπορεί να είναι εταιρική.
 */

import React from 'react';
import '@/lib/design-system';

import { ActivityTab } from '@/components/shared/audit/ActivityTab';
import { EntityMediaFilesTab } from '@/components/space-management/shared/tabs/EntityMediaFilesTab';
import { propertyDossierMediaBinding } from '@/components/space-management/shared/tabs/entity-media-binding';
import {
  DOCUMENTS_MEDIA_CONFIG,
  FLOORPLAN_MEDIA_CONFIG,
  PHOTOS_MEDIA_CONFIG,
  VIDEOS_MEDIA_CONFIG,
  type MediaTabConfig,
} from '@/components/space-management/shared/tabs/media-tab-configs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PropertyDossier } from '@/types/property-dossier';

const NS = 'property-market';

interface DossierTabProps {
  readonly dossier: PropertyDossier;
}

/** Μία καρτέλα αρχείων = σύνδεση φακέλου + ρύθμιση καρτέλας. Ένα σημείο, τέσσερις χρήσεις. */
function DossierFilesTab({ dossier, media }: DossierTabProps & { readonly media: MediaTabConfig }) {
  return <EntityMediaFilesTab binding={propertyDossierMediaBinding(dossier)} media={media} />;
}

export function PropertyDossierFloorplanTab({ dossier }: DossierTabProps) {
  return <DossierFilesTab dossier={dossier} media={FLOORPLAN_MEDIA_CONFIG} />;
}

export function PropertyDossierDocumentsTab({ dossier }: DossierTabProps) {
  return <DossierFilesTab dossier={dossier} media={DOCUMENTS_MEDIA_CONFIG} />;
}

export function PropertyDossierPhotosTab({ dossier }: DossierTabProps) {
  return <DossierFilesTab dossier={dossier} media={PHOTOS_MEDIA_CONFIG} />;
}

export function PropertyDossierVideosTab({ dossier }: DossierTabProps) {
  return <DossierFilesTab dossier={dossier} media={VIDEOS_MEDIA_CONFIG} />;
}

const HISTORY_HEADING_ID = 'property-dossier-history-lead';

/** Ιστορικό — ποιος άλλαξε τι, πότε· το βλέπει **μόνο** ο κάτοχος (κανόνας `entity_audit_trail_personal`). */
export function PropertyDossierHistoryTab({ dossier }: DossierTabProps) {
  const { t } = useTranslation([NS]);
  return (
    <section aria-describedby={HISTORY_HEADING_ID} className="flex flex-col gap-2 p-2">
      <p id={HISTORY_HEADING_ID} className="m-0 text-sm text-muted-foreground">
        {t(`${NS}:dossier.history.lead`)}
      </p>
      <ActivityTab entityType="property_dossier" entityId={dossier.id} ledger="personal" />
    </section>
  );
}
