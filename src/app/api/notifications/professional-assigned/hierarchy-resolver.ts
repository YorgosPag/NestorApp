/**
 * Property hierarchy resolver and contact data extractors
 * for the professional-assigned notification route.
 *
 * Extracted from route.ts per Google SRP / ADR-N.7.1 file-size rules.
 *
 * @module api/notifications/professional-assigned/hierarchy-resolver
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { primaryEmailOf, type EmailLike } from '@/lib/contacts/primary-email';
import { primaryOrFirst } from '@/lib/primary-entry';

// ============================================================================
// TYPES
// ============================================================================

export interface PropertyHierarchy {
  propertyName: string;
  propertyCode: string | null;
  propertyFloor: number | null;
  buildingName: string | null;
  projectName: string | null;
  projectAddress: string | null;
  companyName: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyAddress: string | null;
  companyWebsite: string | null;
  /** Buyer info (from unit.commercial.owners[] — ADR-244 SSoT) */
  buyerName: string | null;
  buyerPhone: string | null;
  buyerEmail: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Role labels — Greek translations for email subject & body */
export const ROLE_LABELS: Record<string, string> = {
  seller_lawyer: 'Δικηγόρος Πωλητή',
  buyer_lawyer: 'Δικηγόρος Αγοραστή',
  notary: 'Συμβολαιογράφος',
};

// ============================================================================
// CONTACT DATA EXTRACTORS
// ============================================================================

/**
 * **Πού στέλνουμε σε αυτή την επαφή** — `contact.email` (παλαιό σχήμα), αλλιώς η λίστα.
 *
 * 🔴 **ΔΙΟΡΘΩΘΗΚΕ ΣΦΑΛΜΑ 05/09 (ADR-332 D24), ΔΕΝ ΕΓΙΝΕ ΜΟΝΟ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ**: η
 * προηγούμενη γραφή τελείωνε σε `emails[0]?.email ?? null` — **χωρίς έλεγχο κενού**.
 * Μια επαφή με `{ email: '' }` *(συνηθισμένη· μισοσυμπληρωμένη φόρμα)* επέστρεφε `''`,
 * που **δεν είναι `null`** ⇒ περνούσε κάθε έλεγχο «υπάρχει;» και έφτανε στον πάροχο.
 * Και αυτή είναι διαδρομή **ειδοποιήσεων**: το σφάλμα φαινόταν μόνο ως ειδοποίηση που
 * δεν έφτασε ποτέ. Η παγίδα ήταν **ήδη ονομασμένη** στο `primaryEmailOf` (ADR-777
 * §8.33) — απλώς κανείς δεν είχε συνδέσει τα δύο σημεία.
 *
 * ⚠️ **Το `contact.email` προηγείται και ΜΕΝΕΙ**: είναι το παλαιό, μονό πεδίο. Η σειρά
 * δεν αντιστρέφεται — μια επαφή που έχει **και** τα δύο έχει το μονό ως αυθεντία.
 */
export function extractPrimaryEmail(contactData: Record<string, unknown>): string | null {
  const directEmail = contactData.email as string | undefined;
  if (directEmail) return directEmail;

  return primaryEmailOf(contactData.emails as EmailLike[] | undefined);
}

/**
 * **Σε ποιο νούμερο καλούμε αυτή την επαφή** — ίδιο σχήμα με το email, ίδια διόρθωση.
 *
 * 🔴 **Είχε ΤΟ ΙΔΙΟ σφάλμα κενού** (`phones[0]?.number` χωρίς έλεγχο) και διορθώθηκε
 * μαζί: **φιλτράρισμα πρώτα, επιλογή μετά**. Δεν υπάρχει `primaryPhoneOf` αδελφός του
 * `primaryEmailOf` — και **δεν φτιάχτηκε εδώ επίτηδες**: θα ήταν αυθεντία γεννημένη σε
 * αρχείο ειδοποιήσεων, με **έναν** καλόντα. Η σύνθεση είναι ρητή και τοπική.
 */
export function extractPrimaryPhone(contactData: Record<string, unknown>): string | null {
  const phones = contactData.phones as Array<{ number?: string; isPrimary?: boolean }> | undefined;
  if (!Array.isArray(phones)) return null;

  const usable = phones.filter((entry) => typeof entry.number === 'string' && entry.number.trim() !== '');
  return primaryOrFirst(usable)?.number?.trim() ?? null;
}

/** Extract formatted primary address from addresses[] array */
export function extractPrimaryAddress(contactData: Record<string, unknown>): string | null {
  const addresses = contactData.addresses as Array<{
    street?: string;
    number?: string;
    city?: string;
    postalCode?: string;
    isPrimary?: boolean;
  }> | undefined;
  if (!addresses || addresses.length === 0) return null;

  const addr = primaryOrFirst(addresses);
  if (addr === undefined) return null;

  const parts = [
    [addr.street, addr.number].filter(Boolean).join(' '),
    addr.postalCode,
    addr.city,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

/** Extract primary website from websites[] array */
export function extractPrimaryWebsite(contactData: Record<string, unknown>): string | null {
  const websites = contactData.websites as Array<{ url?: string }> | undefined;
  if (!websites || websites.length === 0) return null;
  return websites[0]?.url ?? null;
}

// ============================================================================
// HIERARCHY RESOLVER
// ============================================================================

/**
 * Resolve property → building → project → company hierarchy via Admin SDK.
 * Same pattern as sales-accounting-bridge.ts resolveHierarchy().
 */
export async function resolvePropertyHierarchy(propertyId: string): Promise<PropertyHierarchy | null> {
  const db = getAdminFirestore();

  // 1. Property
  const propertySnap = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  if (!propertySnap.exists) return null;
  const propertyData = propertySnap.data() as Record<string, unknown>;

  const result: PropertyHierarchy = {
    propertyName: (propertyData.name as string) ?? propertyId,
    propertyCode: (propertyData.code as string) ?? null,
    propertyFloor: (propertyData.floor as number) ?? null,
    buildingName: null,
    projectName: null,
    projectAddress: null,
    companyName: null,
    companyPhone: null,
    companyEmail: null,
    companyAddress: null,
    companyWebsite: null,
    buyerName: null,
    buyerPhone: null,
    buyerEmail: null,
  };

  // 2. Building
  const buildingId = propertyData.buildingId as string | undefined;
  if (buildingId) {
    const buildingSnap = await db.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
    if (buildingSnap.exists) {
      const buildingData = buildingSnap.data() as Record<string, unknown>;
      result.buildingName = (buildingData.name as string) ?? null;

      // 3. Project
      const projectId = buildingData.projectId as string | undefined;
      if (projectId) {
        const projectSnap = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
        if (projectSnap.exists) {
          const projectData = projectSnap.data() as Record<string, unknown>;
          result.projectName = (projectData.name as string) ?? null;
          const addr = (projectData.address as string) ?? '';
          const city = (projectData.city as string) ?? '';
          result.projectAddress = [addr, city].filter(Boolean).join(', ') || null;

          // 4. Company contact — ADR-232: linkedCompanyId is the contact doc ID
          //    project.companyId = tenant ID (comp_xxx), NOT a contact document
          //    project.linkedCompanyId = actual contact ID (cont_xxx) in contacts collection
          const linkedCompanyId = projectData.linkedCompanyId as string | undefined;
          if (linkedCompanyId) {
            const companySnap = await db.collection(COLLECTIONS.CONTACTS).doc(linkedCompanyId).get();
            if (companySnap.exists) {
              const companyData = companySnap.data() as Record<string, unknown>;
              result.companyName = (companyData.companyName as string)
                ?? (companyData.displayName as string)
                ?? null;
              result.companyPhone = extractPrimaryPhone(companyData);
              result.companyEmail = extractPrimaryEmail(companyData);
              result.companyAddress = extractPrimaryAddress(companyData);
              result.companyWebsite = extractPrimaryWebsite(companyData);
            }
          } else {
            // Fallback: use denormalized company name from project
            result.companyName = (projectData.linkedCompanyName as string)
              ?? (projectData.company as string)
              ?? null;
          }
        }
      }
    }
  }

  // 5. Buyer — from property.commercial.owners[] (ADR-244 SSoT)
  //    Fallback: property.soldTo (deprecated)
  const commercial = propertyData.commercial as Record<string, unknown> | undefined;
  const ownersArr = commercial?.owners as ReadonlyArray<{ contactId: string }> | null ?? null;
  const buyerContactId = ownersArr?.[0]?.contactId
    ?? (propertyData.soldTo as string)
    ?? null;

  if (buyerContactId) {
    const buyerSnap = await db.collection(COLLECTIONS.CONTACTS).doc(buyerContactId).get();
    if (buyerSnap.exists) {
      const buyerData = buyerSnap.data() as Record<string, unknown>;
      result.buyerName = (buyerData.displayName as string)
        ?? ([buyerData.firstName, buyerData.lastName].filter(Boolean).join(' ')
        || null);
      result.buyerPhone = extractPrimaryPhone(buyerData);
      result.buyerEmail = extractPrimaryEmail(buyerData);
    }
  }

  return result;
}
