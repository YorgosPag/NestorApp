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
 *    ιδιώτη = `readOfficeOwnerProperty` (ο ΙΔΙΟΣ `custodyOf`). Ξένο ≡ ανύπαρκτο.
 * 🔑 **Αποσυρμένο** (κάδος · αρχείο, `isRetired` — ADR-281) ⇒ καμία πρόταση, καμία απόφαση. Το ίδιο φίλτρο εφαρμόζει
 *    το μητρώο (`isRetiredRegistryProperty`), ώστε οθόνη και πράξη να μη διαφωνούν ποτέ.
 * 🔑 **Τα γεγονότα** (κλάση + ωμή φάση) τα βγάζει ΕΝΑ σημείο (`upkeepSubjectOf`) για μητρώο, καρτέλα **και** πράξη.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { resolvedPropertyClassOf } from '@/constants/property-classification';
import { upkeepItemsOf, type UpkeepItem, type UpkeepSubject } from '@/lib/document-validity/property-upkeep';
import { isRetired } from '@/lib/firestore/trashed-status';
import { readOfficeOwnerProperty } from './registry-owner-properties.server';
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
  | { readonly kind: 'subject'; readonly property: RegistryProperty }
  | { readonly kind: 'absent' }
  | { readonly kind: 'retired' };

/** Ακίνητο εταιρείας πρώτα (το συνηθέστερο), μετά ακίνητο ιδιώτη υπό θεματοφυλακή — αλλιώς `absent`. */
export async function readUpkeepSubject(db: Firestore, companyId: string, propertyId: string): Promise<UpkeepSubjectReading> {
  const property = (await readCompanyProperties(db, companyId, [propertyId])).get(propertyId)
    ?? await readOfficeOwnerProperty(db, companyId, propertyId);
  if (property === null) return { kind: 'absent' };
  return isRetiredRegistryProperty(property) ? { kind: 'retired' } : { kind: 'subject', property };
}

export type PropertyUpkeepReading =
  | { readonly kind: 'ready'; readonly items: readonly UpkeepItem[] }
  | { readonly kind: 'absent' }
  | { readonly kind: 'retired' };

/**
 * Η ενότητα «Μόνιμες υποχρεώσεις» **ενός** ακινήτου — ο ΙΔΙΟΣ `upkeepItemsOf` με το μητρώο, πάνω στο ίδιο υποκείμενο
 * και τις αποφάσεις του (ένα `getAll`). Κενή λίστα = τίποτα να προταθεί ή να αποφασιστεί (π.χ. οικόπεδο).
 */
export async function readPropertyUpkeep(db: Firestore, companyId: string, propertyId: string): Promise<PropertyUpkeepReading> {
  const subject = await readUpkeepSubject(db, companyId, propertyId);
  if (subject.kind !== 'subject') return subject;
  const declarations = await readPropertyUpkeepDeclarations(db, companyId, propertyId);
  return { kind: 'ready', items: upkeepItemsOf([upkeepSubjectOf(subject.property)], declarations) };
}
