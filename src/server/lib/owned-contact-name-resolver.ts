/**
 * 🏢 SSoT — ο επιλυτής **«επαφή του μισθωτή → όνομα»** για τα ξένα κλειδιά του ιστορικού (ADR-195).
 *
 * Το ιστορικό κρατά **id στην τιμή + στιγμιότυπο ονόματος στην ετικέτα** (`diffFieldsWithResolution`): το id για
 * σύνδεσμο/ερώτημα, το όνομα ώστε η γραμμή να διαβάζεται **και** όταν η επαφή μετονομαστεί ή διαγραφεί — η πρακτική
 * του Salesforce Field History και του Procore/Ariba audit log. Εδώ ζει **μόνο** το «ποιο όνομα έχει τώρα».
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-29, ADR-327 §8.5 Γ)**: η αλλαγή προμηθευτή προσφοράς δεν έφτανε στο ιστορικό· και ο
 * μόνος υπάρχων επιλυτής επαφής (`linkedCompanyId` του έργου) ήταν χειρόγραφος, διάβαζε επαφή **χωρίς κριτή μισθωτή**
 * και ήξερε μόνο το `companyName`. Ένας επιλυτής, ένας κριτής, ένας κανόνας ονόματος.
 *
 * 🔑 Ξένη ή ανύπαρκτη επαφή ⇒ `null` (ADR-742: ξένη ≡ ανύπαρκτη) ⇒ ο αναγνώστης πέφτει στην ωμή τιμή — ποτέ
 * όνομα άλλου μισθωτή μέσα στο ιστορικό μας. Κενό όνομα ⇒ `null`, όχι `''`.
 *
 * @module server/lib/owned-contact-name-resolver
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';

/** Η μορφή που δέχεται το `diffFieldsWithResolution` / `recordEntityUpdate` ανά πεδίο. */
export type AuditNameResolver = (value: unknown) => Promise<string | null>;

/** Επιλυτής ονόματος επαφής **του δοσμένου μισθωτή** — για τα `resolvers` του ιστορικού. */
export function ownedContactNameResolver(db: Firestore, companyId: string): AuditNameResolver {
  return async (value) => {
    if (typeof value !== 'string' || value === '') return null;
    const contact = (await readOwnedContactDocs(db, companyId, [value])).get(value);
    if (!contact) return null;
    const name = extractContactDisplayName(contact).trim();
    return name === '' ? null : name;
  };
}
