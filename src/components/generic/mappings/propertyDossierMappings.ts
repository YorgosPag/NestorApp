/**
 * @fileoverview **Όνομα καρτέλας → συστατικό** για τον φάκελο ακινήτου (`unified-tabs-factory` `'property-dossier'`).
 * @related ADR-866 Φ1.2 · §2.9.3 Κ4 · parkingMappings.ts (πρότυπο) · ADR-744 §8 (per-route slices)
 * @module components/generic/mappings/propertyDossierMappings
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΟΙ ΚΑΡΤΕΛΕΣ ΦΟΡΤΩΝΟΝΤΑΙ ΜΕ ΟΡΙΟ (`React.lazy`) — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΓΟΥΣΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Με στατική εισαγωγή, η κλειστότητα της σελίδας `/dossiers/[dossierId]` έφτανε **ολόκληρο** τον κόσμο του
 * διαχειριστή αρχείων (γκαλερί κάτοψης · BIM 3D · DXF · ISO 19650 · κάδος): `--measure` έδωσε **81.644 bytes σε 16
 * namespaces** για το route slice — **47,7%** του κελύφους, για κείμενο που δεν ζωγραφίζεται στο πρώτο καρέ (οι
 * καρτέλες είναι πίσω από ταυτότητα και `LazyTabContent`). Η θεραπεία της CHECK 3.34 Κ2 για «κλειστότητα που ξέφυγε»
 * είναι **όριο**, όχι σφράγιση μεγαλύτερου αριθμού. Ίδιο ιδίωμα με το `OwnerPropertyHistory` (`React.lazy(ActivityTab)`).
 *
 * ⚠️ **ΔΕΝ εξάγεται από το `mappings/index.ts`**: εκείνο εισάγει **όλες** τις καρτέλες έργου — ένα re-export εδώ θα
 * τις έσερνε μέσα στο bundle του προσωπικού χώρου `(me)`. Εισάγεται **απευθείας** από τη μία σελίδα που το χρειάζεται.
 */

import React, { type ComponentType } from 'react';

import type { TabComponentProps } from '@/components/generic/UniversalTabsRenderer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PropertyDossier } from '@/types/property-dossier';

/** Ό,τι δίνει ο renderer σε κάθε καρτέλα — ο φάκελος ως `data`. */
export interface PropertyDossierTabComponentProps extends TabComponentProps {
  data?: PropertyDossier;
}

type DossierTabName =
  | 'PropertyDossierFloorplanTab'
  | 'PropertyDossierDocumentsTab'
  | 'PropertyDossierPhotosTab'
  | 'PropertyDossierVideosTab'
  | 'PropertyDossierHistoryTab';

type DossierTab = ComponentType<{ readonly dossier: PropertyDossier }>;

/** **Ένα** όριο φόρτωσης ανά καρτέλα — το module φορτώνεται μία φορά, όποια καρτέλα κι αν ανοίξει πρώτη. */
function lazyTab(name: DossierTabName): React.LazyExoticComponent<DossierTab> {
  return React.lazy(() =>
    import('@/components/property-dossier/PropertyDossierTabs').then((tabs) => ({ default: tabs[name] })),
  );
}

/** Η στιγμή φόρτωσης της καρτέλας — ένα μήνυμα, ίδιο για όλες. */
function TabLoading(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return React.createElement('p', { className: 'm-0 p-4 text-sm text-muted-foreground' }, t('property-market:dossier.tabs.loading'));
}

/** Προσαρμογέας: `data` του renderer → `dossier` της καρτέλας. Χωρίς φάκελο ⇒ τίποτα (ποτέ καρτέλα χωρίς οντότητα). */
function adapt(name: DossierTabName): ComponentType<PropertyDossierTabComponentProps> {
  const Tab = lazyTab(name);
  function DossierTabAdapter(props: PropertyDossierTabComponentProps) {
    if (!props.data) return null;
    return React.createElement(
      React.Suspense,
      { fallback: React.createElement(TabLoading) },
      React.createElement(Tab, { dossier: props.data }),
    );
  }
  DossierTabAdapter.displayName = `DossierTab(${name})`;
  return DossierTabAdapter;
}

export const PROPERTY_DOSSIER_COMPONENT_MAPPING: Record<DossierTabName, ComponentType<PropertyDossierTabComponentProps>> = {
  PropertyDossierFloorplanTab: adapt('PropertyDossierFloorplanTab'),
  PropertyDossierDocumentsTab: adapt('PropertyDossierDocumentsTab'),
  PropertyDossierPhotosTab: adapt('PropertyDossierPhotosTab'),
  PropertyDossierVideosTab: adapt('PropertyDossierVideosTab'),
  PropertyDossierHistoryTab: adapt('PropertyDossierHistoryTab'),
};
