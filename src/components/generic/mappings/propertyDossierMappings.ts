/**
 * @fileoverview **Όνομα καρτέλας → συστατικό** για τον φάκελο ακινήτου (`unified-tabs-factory` `'property-dossier'`).
 * @related ADR-866 Φ1.2 · §2.9.3 Κ4 · parkingMappings.ts (πρότυπο) · ADR-744 §8 (per-route slices)
 * @module components/generic/mappings/propertyDossierMappings
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΟΙ ΚΑΡΤΕΛΕΣ ΦΟΡΤΩΝΟΝΤΑΙ ΜΕ ΟΡΙΟ (επιφάνεια `PropertyDossierTab`, ADR-280 §11.8 Β4.3) — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΓΟΥΣΤΟ
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
import { DossierSurfaces } from '@/components/property-dossier/dossier-surfaces';
import type { PropertyDossierTabName } from '@/components/property-dossier/property-dossier-tab-names';
import type { PropertyDossier } from '@/types/property-dossier';

/** Ό,τι δίνει ο renderer σε κάθε καρτέλα — ο φάκελος ως `data`. */
export interface PropertyDossierTabComponentProps extends TabComponentProps {
  data?: PropertyDossier;
}

/**
 * Προσαρμογέας: `data` του renderer → `dossier` της καρτέλας. Χωρίς φάκελο ⇒ τίποτα (ποτέ καρτέλα χωρίς οντότητα).
 *
 * ADR-280 §11.8 Β4.3 — το όριο είναι η **επιφάνεια** `PropertyDossierTab` (ένα module, μία φόρτωση, όποια καρτέλα κι
 * αν ανοίξει πρώτη): το chunk περιμένει και τα κείμενά του, και το μήνυμα φόρτωσης είναι το `fallback` της.
 */
function adapt(name: PropertyDossierTabName): ComponentType<PropertyDossierTabComponentProps> {
  function DossierTabAdapter(props: PropertyDossierTabComponentProps) {
    if (!props.data) return null;
    return React.createElement(DossierSurfaces.PropertyDossierTab, { name, dossier: props.data });
  }
  DossierTabAdapter.displayName = `DossierTab(${name})`;
  return DossierTabAdapter;
}

export const PROPERTY_DOSSIER_COMPONENT_MAPPING: Record<PropertyDossierTabName, ComponentType<PropertyDossierTabComponentProps>> = {
  PropertyDossierFloorplanTab: adapt('PropertyDossierFloorplanTab'),
  PropertyDossierDocumentsTab: adapt('PropertyDossierDocumentsTab'),
  PropertyDossierPhotosTab: adapt('PropertyDossierPhotosTab'),
  PropertyDossierVideosTab: adapt('PropertyDossierVideosTab'),
  PropertyDossierHistoryTab: adapt('PropertyDossierHistoryTab'),
};
