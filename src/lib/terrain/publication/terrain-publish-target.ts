/**
 * @fileoverview **Πού δημοσιεύεται το τοπογραφικό, ανά κάτοχο** (ADR-920 Β4.7) — οι δύο θύρες της εισαγωγής.
 * @related services/listings/publish-listing-terrain.client (ο ΕΝΑΣ client) · app/api/properties/[id]/terrain ·
 *   app/api/owner-properties/[ownerPropertyId]/terrain · hooks/energy-certificate/useEnergyCertificateImportPorts (το αδελφό ΠΕΑ)
 * @module lib/terrain/publication/terrain-publish-target
 *
 * 🔑 **`null` = δεν υπάρχει πού να δημοσιευτεί** ⇒ η οθόνη δεν δείχνει κουμπί, αντί να δείξει κουμπί που αποτυγχάνει.
 * Οι ίδιες ερωτήσεις με την πόρτα, πριν από το δίκτυο: σωσμένο ακίνητο · **γη** (Δ1 — αλλιώς `TERRAIN_NOT_LAND`) ·
 * για τον ιδιοκτήτη, προσωπική θεματοφυλακή **με φάκελο** (αλλιώς `TERRAIN_NO_DOSSIER`). Η πόρτα κρίνει ξανά —
 * αυτό είναι η διεπαφή, όχι η εξουσία.
 *
 * Καθαρές συναρτήσεις, όχι hooks: σε αντίθεση με το ΠΕΑ ο browser **δεν** ανεβάζει αρχείο (η πόρτα γεννά την εγγραφή),
 * άρα δεν χρειάζεται συνεδρία ή εταιρεία για να απαντηθεί το «πού».
 */

import { isLandProperty } from '@/constants/property-classification';
import { isPersistedPropertyId } from '@/lib/properties/unsaved-property';
import { isPersonalCustody } from '@/lib/owner-property/listing-custody';
import type { OwnerProperty } from '@/types/owner-property';

/** Ο κάτοχος της αγγελίας — ο client τον μεταφράζει στη ΜΙΑ διαδρομή του `API_ROUTES`. */
export type TerrainPublishTarget =
  | { readonly kind: 'property'; readonly propertyId: string }
  | { readonly kind: 'owner-property'; readonly ownerPropertyId: string };

/** Ακίνητο του γραφείου → η πόρτα του (`property`). */
export function companyPropertyTerrainTarget(
  property: { readonly id?: string | null; readonly type?: unknown } | null,
): TerrainPublishTarget | null {
  if (property === null || !isPersistedPropertyId(property.id) || !isLandProperty(property.type)) return null;
  return { kind: 'property', propertyId: property.id };
}

/** Αγγελία ιδιώτη → η πόρτα του φακέλου του (μόνο προσωπική θεματοφυλακή με φάκελο). */
export function ownerPropertyTerrainTarget(
  property: Pick<OwnerProperty, 'id' | 'type' | 'dossierId' | 'authorUserId' | 'authorCompanyId'>,
): TerrainPublishTarget | null {
  if (!isPersonalCustody(property) || !property.dossierId) return null;
  if (!isPersistedPropertyId(property.id) || !isLandProperty(property.type)) return null;
  return { kind: 'owner-property', ownerPropertyId: property.id };
}
