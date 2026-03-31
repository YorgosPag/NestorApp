/**
 * Unit hierarchy resolver and contact data extractors
 * for the professional-assigned notification route.
 *
 * Extracted from route.ts per Google SRP / ADR-N.7.1 file-size rules.
 *
 * @module api/notifications/professional-assigned/hierarchy-resolver
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// TYPES
// ============================================================================

export interface UnitHierarchy {
  unitName: string;
  unitCode: string | null;
  unitFloor: number | null;
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
 * Extract primary email from contact document.
 * Checks: contact.email → contact.emails[].isPrimary → contact.emails[0].
 */
export function extractPrimaryEmail(contactData: Record<string, unknown>): string | null {
  const directEmail = contactData.email as string | undefined;
  if (directEmail) return directEmail;

  const emails = contactData.emails as Array<{ email?: string; isPrimary?: boolean }> | undefined;
  if (!emails || emails.length === 0) return null;

  const primary = emails.find(e => e.isPrimary && e.email);
  if (primary?.email) return primary.email;

  return emails[0]?.email ?? null;
}

/** Extract primary phone from phones[] array */
export function extractPrimaryPhone(contactData: Record<string, unknown>): string | null {
  const phones = contactData.phones as Array<{ number?: string; isPrimary?: boolean }> | undefined;
  if (!phones || phones.length === 0) return null;

  const primary = phones.find(p => p.isPrimary && p.number);
  return primary?.number ?? phones[0]?.number ?? null;
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

  const addr = addresses.find(a => a.isPrimary) ?? addresses[0];
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
 * Resolve unit → building → project → company hierarchy via Admin SDK.
 * Same pattern as sales-accounting-bridge.ts resolveHierarchy().
 */
export async function resolveUnitHierarchy(unitId: string): Promise<UnitHierarchy | null> {
  const db = getAdminFirestore();

  // 1. Unit
  const unitSnap = await db.collection(COLLECTIONS.UNITS).doc(unitId).get();
  if (!unitSnap.exists) return null;
  const unitData = unitSnap.data() as Record<string, unknown>;

  const result: UnitHierarchy = {
    unitName: (unitData.name as string) ?? unitId,
    unitCode: (unitData.code as string) ?? null,
    unitFloor: (unitData.floor as number) ?? null,
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
  const buildingId = unitData.buildingId as string | undefined;
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

  // 5. Buyer — from unit.commercial.owners[] (ADR-244 SSoT)
  //    Fallback: unit.soldTo (deprecated)
  const commercial = unitData.commercial as Record<string, unknown> | undefined;
  const ownersArr = commercial?.owners as ReadonlyArray<{ contactId: string }> | null ?? null;
  const buyerContactId = ownersArr?.[0]?.contactId
    ?? (unitData.soldTo as string)
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
