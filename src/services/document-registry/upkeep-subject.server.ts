/**
 * @fileoverview ADR-915 §36 — **ο ΕΝΑΣ κριτής υποκειμένου** της μόνιμης υποχρέωσης: «είναι αυτό το ακίνητο του γραφείου,
 *   και ζωντανό;» — και η όψη **ενός** ακινήτου για την καρτέλα του.
 * @related registry-properties.server.ts (`readCompanyProperties`) · registry-owner-properties.server.ts (`custodyOf`) ·
 *   upkeep-declaration.service.ts (η πράξη) · document-registry.service.ts (το μητρώο — ίδια γεγονότα, ίδιο φίλτρο)
 * @module services/document-registry/upkeep-subject.server
 *
 * 🔑 **Ίδια κατηγορήματα με το μητρώο, όχι ολόκληρο το μητρώο.** Μέχρι το §36 ο κριτής του PUT ήταν το
 *    `readDocumentRegistry`: βαρύ (επτά πηγές για ένα ακίνητο), **και** με όριο ανάγνωσης ⇒ ακίνητο πέρα από το όριο
 *    γινόταν «μη αποφασίσιμο». Εδώ: ακίνητο εταιρείας = `readCompanyProperties` (ο ΙΔΙΟΣ έλεγχος `companyId`)· ακίνητο
 *    ιδιώτη = `readAdministeredOwnerProperty` (ο ΕΝΑΣ κριτής `mayAdminister(custodyOf(…))`). Ξένο ≡ ανύπαρκτο.
 * 🔑 §37 — **αποφασίζει όποιος διαχειρίζεται τον χώρο του ακινήτου** (Zanzibar/Figma/MLS, `listing-custody.ts`): γραφείο
 *    για τα δικά του και για ακίνητα ιδιωτών υπό θεματοφυλακή του· ο ιδιώτης χωρίς μεσίτη για το δικό του. Ο κριτής
 *    επιστρέφει και το **βιβλίο** (`CustodyScope`) — εκεί διαβάζονται και γράφονται οι αποφάσεις.
 * 🔑 **Αποσυρμένο** (κάδος · αρχείο, `isRetired` — ADR-281) ⇒ καμία πρόταση, καμία απόφαση. Το ίδιο φίλτρο εφαρμόζει
 *    το μητρώο (`isRetiredRegistryProperty`), ώστε οθόνη και πράξη να μη διαφωνούν ποτέ.
 * 🔑 **Τα γεγονότα** (κλάση + ωμή φάση) τα βγάζει ΕΝΑ σημείο (`upkeepSubjectOf`) για μητρώο, καρτέλα **και** πράξη.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { resolvedPropertyClassOf } from '@/constants/property-classification';
import { upkeepItemsOf, type UpkeepItem, type UpkeepSubject } from '@/lib/document-validity/property-upkeep';
import { isRetired } from '@/lib/firestore/trashed-status';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
import { readAdministeredOwnerProperty } from './registry-owner-properties.server';
import { readCompanyProperties, type RegistryProperty } from './registry-properties.server';
import { readPropertyUpkeepDeclarations } from './upkeep-declarations.server';

/** Κλάση + ωμή φάση του ακινήτου — ό,τι χρειάζεται η πρόταση. Η φάση κανονικοποιείται στον πυρήνα, όχι εδώ. */
export function upkeepSubjectOf(property: RegistryProperty): UpkeepSubject {
  return {
    propertyId: property.id,
    propertyClass: resolvedPropertyClassOf(property.data.type),
    phase: property.data.operationalStatus,
  };
}

/** «Στον κάδο ή στο αρχείο;» — η ΜΙΑ απάντηση (`isRetired`), πάνω στο ωμό έγγραφο. */
export function isRetiredRegistryProperty(property: RegistryProperty): boolean {
  const { status } = property.data;
  return isRetired({ status: typeof status === 'string' ? status : null });
}

export type UpkeepSubjectReading =
  | { readonly kind: 'subject'; readonly property: RegistryProperty; readonly owner: CustodyScope }
  | { readonly kind: 'absent' }
  | { readonly kind: 'retired' };

/** Ακίνητο εταιρείας — μόνο για δρώντα **με** εταιρεία (ο ιδιώτης δεν έχει χαρτοφυλάκιο εταιρείας). */
async function readCompanySubject(
  db: Firestore,
  actor: ListingActor,
  propertyId: string,
): Promise<{ readonly property: RegistryProperty; readonly owner: CustodyScope } | null> {
  if (actor.companyId === null || actor.companyId === '') return null;
  const property = (await readCompanyProperties(db, actor.companyId, [propertyId])).get(propertyId);
  return property === undefined ? null : { property, owner: { companyId: actor.companyId } };
}

/** Ακίνητο εταιρείας πρώτα (το συνηθέστερο), μετά ακίνητο ιδιώτη που ο δρων διαχειρίζεται — αλλιώς `absent`. */
export async function readUpkeepSubject(db: Firestore, actor: ListingActor, propertyId: string): Promise<UpkeepSubjectReading> {
  const found = await readCompanySubject(db, actor, propertyId) ?? await readAdministeredOwnerProperty(db, actor, propertyId);
  if (found === null) return { kind: 'absent' };
  return isRetiredRegistryProperty(found.property) ? { kind: 'retired' } : { kind: 'subject', ...found };
}

export type PropertyUpkeepReading =
  | { readonly kind: 'ready'; readonly items: readonly UpkeepItem[] }
  | { readonly kind: 'absent' }
  | { readonly kind: 'retired' };

/**
 * Η ενότητα «Μόνιμες υποχρεώσεις» **ενός** ακινήτου — ο ΙΔΙΟΣ `upkeepItemsOf` με το μητρώο, πάνω στο ίδιο υποκείμενο
 * και τις αποφάσεις του (ένα `getAll`). Κενή λίστα = τίποτα να προταθεί ή να αποφασιστεί (π.χ. οικόπεδο).
 */
export async function readPropertyUpkeep(db: Firestore, actor: ListingActor, propertyId: string): Promise<PropertyUpkeepReading> {
  const subject = await readUpkeepSubject(db, actor, propertyId);
  if (subject.kind !== 'subject') return subject;
  const declarations = await readPropertyUpkeepDeclarations(db, subject.owner, propertyId);
  return { kind: 'ready', items: upkeepItemsOf([upkeepSubjectOf(subject.property)], declarations) };
}
