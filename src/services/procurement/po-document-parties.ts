/**
 * @fileoverview **Τα δύο μέρη του εγγράφου παραγγελίας** — αποστολέας (ο φορέας) και παραλήπτης (ο προμηθευτής),
 *   αναλυμένα **μία** φορά για PDF **και** email (ADR-923 §5.11 «3γ» Α11).
 * @related po-pdf-generator.ts (καταναλωτής) · po-email-service.ts (καταναλωτής)
 * @module services/procurement/po-document-parties
 *
 * 🔴 **Γιατί υπάρχει**: οι διαδρομές `[poId]/pdf` και `[poId]/email` έγραφαν **η καθεμία** το ίδιο
 * `{ name: 'Pagonis Construction' }` με `TODO` — επωνυμία **καρφωμένη**, ΑΦΜ/διεύθυνση **κενά**, και παραλήπτη
 * το **ωμό id** της επαφής (PDF) ή το όνομα που πληκτρολόγησε ο χρήστης (email). Δύο αντίγραφα του ίδιου ψέματος.
 *
 * 🔑 **Καμία δική του ανάγνωση ή αντιστοίχιση — μόνο σύνθεση υπαρχόντων SSoT:**
 * - αποστολέας: `getCompanySetup` → `buildIssuer` (η **ίδια** ταυτότητα που τυπώνει το τιμολόγιο)·
 * - παραλήπτης: `readOwnedContactDocs` (φύλακας μισθωτή, ADR-742) → `extractContactParty` (η **ίδια** αντιστοίχιση
 *   επαφής → συναλλασσόμενου με τις φόρμες του λογιστικού) · όνομα από `extractContactDisplayName` (ξέρει τα
 *   legacy πεδία του ωμού εγγράφου)·
 * - διεύθυνση: `formatContactAddressLine` (ΕΛΤΑ Τ.Κ., ADR-332 D16).
 *
 * ⚖️ **Αποτυχία κλειστή, όχι επινόηση**: χωρίς προφίλ φορέα ή χωρίς επαφή προμηθευτή (ανύπαρκτη **ή ξένη** —
 * ADR-742: δεν ξεχωρίζουν) **δεν** παράγεται έγγραφο. Το EN 16931 κάνει υποχρεωτικά το όνομα πωλητή (BT-27) και
 * αγοραστή (BT-44)· έγγραφο με επινοημένο μέρος είναι χειρότερο από κανένα έγγραφο.
 */

import 'server-only';

import type { DocumentData } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { buildIssuer } from '@/services/sales-accounting/sales-accounting-helpers';
import { getCompanySetup } from '@/subapps/accounting/services/repository/accounting-repo-company-setup';
import type { CompanyProfile } from '@/subapps/accounting/types/company';
import { extractContactParty } from '@/subapps/accounting/utils/contact-party';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { formatContactAddressLine } from '@/utils/address/address-line';
import type { Contact } from '@/types/contacts';
import type { PurchaseOrder } from '@/types/procurement';
import type { POPdfCompanyInfo, POPdfSupplierInfo } from './po-pdf-generator';

/** Ποιος ζητά — ο φορέας του οποίου είναι η παραγγελία. */
export interface PODocumentCaller {
  readonly companyId: string;
  readonly uid: string;
}

export type PODocumentPartiesFailure = 'company_profile_missing' | 'supplier_missing';

export type PODocumentPartiesResult =
  | { readonly ok: true; readonly companyInfo: POPdfCompanyInfo; readonly supplierInfo: POPdfSupplierInfo }
  | { readonly ok: false; readonly reason: PODocumentPartiesFailure };

/** Ο φορέας όπως τον τυπώνει το τιμολόγιο (`buildIssuer`), στο σχήμα του PDF παραγγελίας. */
export function companyInfoFromProfile(profile: CompanyProfile): POPdfCompanyInfo {
  const issuer = buildIssuer(profile);
  return {
    name: issuer.name,
    vatNumber: issuer.vatNumber,
    address: formatContactAddressLine({ street: issuer.address, city: issuer.city, postalCode: issuer.postalCode }),
    phone: issuer.phone ?? issuer.mobile ?? '',
    email: issuer.email ?? '',
  };
}

/**
 * Η επαφή του προμηθευτή, από το **ωμό** έγγραφό της.
 *
 * ⚠️ Το όνομα **δεν** παίρνεται από το `extractContactParty`, **ούτε ως εφεδρεία**: εκείνο δέχεται τυποποιημένο
 * `Contact` και σε ωμό έγγραφο δίνει κενό για παλιά εταιρεία με μόνο `tradeName`, και **«undefined undefined»** για
 * φυσικό πρόσωπο χωρίς όνομα (μετρημένο στο test). Το `extractContactDisplayName` είναι ο αναγνώστης του ωμού εγγράφου.
 * Τα υπόλοιπα πεδία (ΑΦΜ, κύρια διεύθυνση/email/τηλέφωνο) τα αποφασίζουν τα `getPrimary*` μέσα στο `extractContactParty`.
 * @returns `null` όταν η επαφή δεν έχει αναγνώσιμο όνομα — δεν υπάρχει παραλήπτης να τυπωθεί.
 */
export function supplierInfoFromContactDoc(doc: DocumentData): POPdfSupplierInfo | null {
  const party = extractContactParty(doc as Contact);
  const name = extractContactDisplayName(doc);
  if (!name) return null;
  const address = formatContactAddressLine({
    street: party.street,
    city: party.city ?? undefined,
    postalCode: party.postalCode ?? undefined,
    country: party.country ?? undefined,
  });
  return {
    name,
    ...(party.vatNumber ? { vatNumber: party.vatNumber } : {}),
    ...(address ? { address } : {}),
    ...(party.phone ? { phone: party.phone } : {}),
    ...(party.email ? { email: party.email } : {}),
  };
}

async function readSupplierInfo(companyId: string, supplierId: string | null): Promise<POPdfSupplierInfo | null> {
  if (!supplierId) return null;
  const contacts = await readOwnedContactDocs(getAdminFirestore(), companyId, [supplierId]);
  const doc = contacts.get(supplierId);
  return doc ? supplierInfoFromContactDoc(doc) : null;
}

/** **Τα μέρη του εγγράφου** μιας παραγγελίας — οι δύο αναγνώσεις τρέχουν παράλληλα. */
export async function resolvePODocumentParties(
  caller: PODocumentCaller,
  po: Pick<PurchaseOrder, 'supplierId'>,
): Promise<PODocumentPartiesResult> {
  const [profile, supplierInfo] = await Promise.all([
    getCompanySetup({ companyId: caller.companyId, userId: caller.uid }),
    readSupplierInfo(caller.companyId, po.supplierId ?? null),
  ]);
  if (!profile) return { ok: false, reason: 'company_profile_missing' };
  if (!supplierInfo) return { ok: false, reason: 'supplier_missing' };
  return { ok: true, companyInfo: companyInfoFromProfile(profile), supplierInfo };
}
