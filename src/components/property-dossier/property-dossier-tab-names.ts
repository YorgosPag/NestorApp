/**
 * @fileoverview Τα ονόματα των καρτελών του φακέλου ακινήτου — όπως τα γράφει η ρύθμιση καρτελών (`unified-tabs-factory`).
 * @module components/property-dossier/property-dossier-tab-names
 *
 * ⚠️ Χωριστό αρχείο επίτηδες (ADR-280 §11.8 Β4.3): ο γράφος modules καταγράφει και το `import type` ως ακμή, άρα αν ο
 * τύπος ζούσε στο `PropertyDossierTabs.tsx`, η εισαγωγή του από το `propertyDossierMappings.ts` θα έσερνε **στατικά**
 * όλο τον κόσμο των καρτελών πάνω από το όριο της επιφάνειας `PropertyDossierTab`.
 */

export type PropertyDossierTabName =
  | 'PropertyDossierFloorplanTab'
  | 'PropertyDossierDocumentsTab'
  | 'PropertyDossierPhotosTab'
  | 'PropertyDossierVideosTab'
  | 'PropertyDossierHistoryTab';
