/**
 * @fileoverview **Η ΠΗΓΗ ΤΗΣ ΕΙΣΑΓΩΓΗΣ** — δήλωση του οργανισμού + απάντηση του μητρώου, σε ΜΙΑ ελαχιστοποιημένη
 *   πρόταση (ADR-841 §7 Α21.19).
 * @related services/company/company-legal-identity (ADR-439) · services/company-registry/company-registry-record.service (Α23)
 * @module services/mandate/showcase-card-import-source
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΟΙΑ ΠΗΓΗ ΓΙΑ ΤΙ — ΜΙΑ ΣΕΙΡΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ, ΓΡΑΜΜΕΝΗ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Πεδίο | Πρώτη | Εφεδρεία |
 * |---|---|---|
 * | διεύθυνση έδρας | **ΓΕΜΗ** — δομημένη, απάντηση αρχής (όπως το Stripe προτιμά το επαληθευμένο) | προφίλ, αναλυμένο με `splitStreetAndNumber` |
 * | τηλέφωνα · email · ιστοσελίδα | **προφίλ** — το μητρώο δεν τα κρατά | — |
 *
 * ⚠️ **Το μητρώο ΔΕΝ ρίχνει ποτέ την εισαγωγή**: αν δεν διαβαστεί, η διεύθυνση έρχεται από το προφίλ. Είναι
 * **βελτίωση** της πρότασης, όχι προϋπόθεσή της. Αντίθετα, προφίλ που **δεν διαβάστηκε** ⇒ `unavailable` —
 * ποτέ «δεν έχεις στοιχεία» (N.12).
 *
 * ⛔ **Διαγραμμένη επιχείρηση** (`activity: 'inactive'`): η έδρα της **δεν** προτείνεται — δεν είναι πια έδρα.
 *
 * **Layering**: service — Admin SDK, δύο αναγνώσεις κατά ταυτότητα, καμία σάρωση.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import {
  readCompanyContactDeclaration,
  type CompanyContactDeclaration,
} from '@/services/company/company-legal-identity';
import { readRegistryCheck } from '@/services/company-registry/company-registry-record.service';
import type { RegistryCheck } from '@/types/company-registry';
import type { CompanyContactSource, ImportedAddress } from '@/types/showcase-card-import';
import { splitStreetAndNumber } from '@/utils/address/address-parse';
import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';

export type CompanyContactSourceRead =
  | { readonly kind: 'present'; readonly source: CompanyContactSource }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unavailable' };

/** Η έδρα του μητρώου — μόνο ενεργής επιχείρησης, και μόνο με οδό **και** Τ.Κ. */
function registryAddress({ record, checkedAt }: RegistryCheck): ImportedAddress | null {
  const { seat, status } = record;
  if (status.activity === 'inactive' || seat.street === null || seat.postalCode === null) return null;
  return {
    street: seat.street.trim(),
    number: seat.streetNumber?.trim() ?? '',
    postalCode: toCanonicalGreekPostalCode(seat.postalCode),
    locality: seat.city?.trim() ?? seat.municipality?.label ?? '',
    origin: 'business-registry',
    checkedAt,
  };
}

/** Η γραμμή του προφίλ — ελεύθερο κείμενο, με άγκυρα αριθμού ή ολόκληρη ως οδός. */
function profileAddress(declaration: CompanyContactDeclaration): ImportedAddress | null {
  if (declaration.address === null) return null;
  const { street, number } = splitStreetAndNumber(declaration.address);
  return {
    street,
    number: number ?? '',
    postalCode: toCanonicalGreekPostalCode(declaration.postalCode),
    locality: declaration.city ?? '',
    origin: 'company-profile',
    checkedAt: null,
  };
}

async function readRegistryAddress(adminDb: AdminFirestore, companyId: string): Promise<ImportedAddress | null> {
  const check = await readRegistryCheck(adminDb, companyId);
  return check.kind === 'present' ? registryAddress(check.check) : null;
}

/**
 * **Τι μπορεί να προταθεί στην κάρτα** — ή ρητά «τίποτα» / «δεν μάθαμε».
 *
 * 🔑 Οι δύο αναγνώσεις τρέχουν **παράλληλα**: και οι δύο χρειάζονται σε κάθε κλήση (σε αντίθεση με τον
 * `readPublicAgencyIdentity`, όπου η δεύτερη χρειάζεται μόνο όταν λείπει η πρώτη).
 */
export async function readCompanyContactSource(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<CompanyContactSourceRead> {
  const [profile, registry] = await Promise.all([
    readCompanyContactDeclaration(companyId),
    readRegistryAddress(adminDb, companyId),
  ]);
  if (profile.kind === 'unavailable') return profile;

  const declaration = profile.kind === 'present' ? profile.declaration : null;
  const address = registry ?? (declaration === null ? null : profileAddress(declaration));
  const phones = declaration === null ? [] : [declaration.phone, declaration.mobile].filter((p): p is string => p !== null);
  const source: CompanyContactSource = {
    address,
    phones,
    email: declaration?.email ?? null,
    website: declaration?.website ?? null,
  };
  const empty = address === null && phones.length === 0 && source.email === null && source.website === null;
  return empty ? { kind: 'absent' } : { kind: 'present', source };
}
