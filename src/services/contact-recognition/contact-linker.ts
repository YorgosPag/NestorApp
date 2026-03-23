/**
 * =============================================================================
 * CONTACT LINKER — Resolve Telegram User → Contact + Personas
 * =============================================================================
 *
 * Bridges external identities (Telegram userId) to contacts and their personas.
 * Pattern follows super-admin-resolver.ts (5-min cache + Firestore lookup).
 *
 * Flow:
 * 1. Check external_identities for linked contactId (cached)
 * 2. If not linked, search contacts by name/phone (heuristic)
 * 3. If match found, update external_identity.contactId
 * 4. Return contact + personas (or null if unknown)
 *
 * @module services/contact-recognition/contact-linker
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { PersonaType } from '@/types/contacts/personas';
import { greekToLatin } from '@/services/ai-pipeline/shared/greek-nlp';
import { getCompanyId } from '@/config/tenant';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ContactLinker');

// ============================================================================
// TYPES
// ============================================================================

/** Project/entity role from contact_links */
export interface ProjectRoleLink {
  projectId: string;
  role: string;
  entityType: string;
  entityId: string;
}

export interface ResolvedContact {
  /** Firestore contact document ID */
  contactId: string;
  /** Display name (first + last) */
  displayName: string;
  /** First name (for friendly greeting) */
  firstName: string;
  /** Active persona types */
  activePersonas: PersonaType[];
  /** Primary persona (first active) */
  primaryPersona: PersonaType | null;
  /** Phone number (if available) */
  phone: string | null;
  /** Email (if available) */
  email: string | null;
  /** Project/entity roles from contact_links (RBAC) */
  projectRoles: ProjectRoleLink[];
  /** Unit IDs from contact_links where targetEntityType='unit' (SPEC-257B) */
  linkedUnitIds: string[];
}

// ============================================================================
// CACHE — 5-min TTL (same pattern as super-admin-resolver)
// ============================================================================

interface CacheEntry {
  result: ResolvedContact | null;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function getCached(key: string): ResolvedContact | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined; // not in cache
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined; // expired
  }
  return entry.result; // may be null (= looked up, not found)
}

function setCache(key: string, result: ResolvedContact | null): void {
  cache.set(key, { result, timestamp: Date.now() });
  // Prune old entries
  if (cache.size > 200) {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [k, v] of cache) {
      if (v.timestamp < cutoff) cache.delete(k);
    }
  }
}

// ============================================================================
// MAIN RESOLVER
// ============================================================================

/**
 * Resolve a Telegram user to a known contact with personas.
 *
 * @param telegramUserId - Telegram user ID
 * @param displayName - Telegram display name (for heuristic matching)
 * @returns Resolved contact with personas, or null if unknown
 */
export async function resolveContactFromTelegram(
  telegramUserId: string,
  displayName?: string,
): Promise<ResolvedContact | null> {
  const cacheKey = `telegram_${telegramUserId}`;

  // Check cache first
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const db = getAdminFirestore();

    // Step 1: Check external_identities for linked contactId
    const identitySnap = await db
      .collection(COLLECTIONS.EXTERNAL_IDENTITIES)
      .where('provider', '==', 'telegram')
      .where('externalUserId', '==', telegramUserId)
      .limit(1)
      .get();

    let contactId: string | null = null;

    if (!identitySnap.empty) {
      const identityData = identitySnap.docs[0].data();
      contactId = identityData.contactId as string | null ?? null;
    }

    // Step 2: If no linked contactId, try heuristic matching by name
    if (!contactId && displayName) {
      contactId = await findContactByName(db, displayName);

      // Link for next time
      if (contactId && !identitySnap.empty) {
        await identitySnap.docs[0].ref.update({ contactId }).catch(() => {});
        logger.info('Linked external identity to contact', {
          telegramUserId,
          contactId,
          matchedBy: 'displayName',
        });
      }
    }

    // Step 3: If still no match, return null
    if (!contactId) {
      setCache(cacheKey, null);
      return null;
    }

    // Step 4: Fetch contact with personas
    const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
    if (!contactDoc.exists) {
      setCache(cacheKey, null);
      return null;
    }

    const contact = contactDoc.data() as Record<string, unknown>;
    const personas = Array.isArray(contact.personas) ? contact.personas : [];
    const activePersonas = personas
      .filter((p: Record<string, unknown>) => p.status === 'active')
      .map((p: Record<string, unknown>) => p.personaType as PersonaType);

    const firstName = String(contact.firstName ?? contact.displayName ?? displayName ?? '');
    const emails = Array.isArray(contact.emails) ? contact.emails as Array<{ email?: string; isPrimary?: boolean }> : [];
    const phones = Array.isArray(contact.phones) ? contact.phones as Array<{ number?: string; isPrimary?: boolean }> : [];

    // Step 5: Fetch project roles from contact_links (RBAC)
    let projectRoles: ProjectRoleLink[] = [];
    try {
      const linksSnap = await db
        .collection(COLLECTIONS.CONTACT_LINKS)
        .where('sourceContactId', '==', contactId)
        .where('status', '==', 'active')
        .limit(20)
        .get();

      projectRoles = linksSnap.docs.map(doc => {
        const data = doc.data();
        return {
          projectId: data.targetEntityType === 'project'
            ? String(data.targetEntityId ?? '')
            : '',
          role: String(data.role ?? 'unknown'),
          entityType: String(data.targetEntityType ?? 'project'),
          entityId: String(data.targetEntityId ?? ''),
        };
      });
    } catch {
      // Non-fatal: if contact_links query fails, proceed without roles
    }

    // SPEC-257B: Derive linked unit IDs from contact_links
    const linkedUnitIds = [...new Set(
      projectRoles
        .filter(r => r.entityType === 'unit')
        .map(r => r.entityId)
        .filter(Boolean),
    )];

    const result: ResolvedContact = {
      contactId,
      displayName: String(contact.displayName ?? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()),
      firstName,
      activePersonas,
      primaryPersona: activePersonas.length > 0 ? activePersonas[0] : null,
      phone: phones.find(p => p.isPrimary)?.number ?? phones[0]?.number ?? null,
      email: emails.find(e => e.isPrimary)?.email ?? emails[0]?.email ?? null,
      projectRoles,
      linkedUnitIds,
    };

    setCache(cacheKey, result);
    logger.info('Contact resolved from Telegram', {
      telegramUserId,
      contactId,
      displayName: result.displayName,
      personas: activePersonas,
    });

    return result;
  } catch (error) {
    // Non-fatal: if resolution fails, treat as unknown
    logger.warn('Contact resolution failed', { telegramUserId, error: String(error) });
    setCache(cacheKey, null);
    return null;
  }
}

// ============================================================================
// HEURISTIC MATCHING
// ============================================================================

/**
 * Find contact by display name (fuzzy matching).
 * Tries both Greek and Latin versions.
 */
async function findContactByName(
  db: FirebaseFirestore.Firestore,
  displayName: string,
): Promise<string | null> {
  const words = displayName.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return null;

  const latinWords = words.map(w => greekToLatin(w)).filter(Boolean);
  const stems = [...words, ...latinWords]
    .filter(w => w.length >= 3)
    .map(w => w.substring(0, Math.min(w.length, 4)));
  const allTerms = [...new Set([...words, ...latinWords, ...stems])];

  // 🔒 SPEC-259B: Tenant-scoped — only search contacts within current company
  const companyId = getCompanyId();
  const contactsSnap = await db
    .collection(COLLECTIONS.CONTACTS)
    .where('companyId', '==', companyId)
    .limit(50)
    .get();

  for (const doc of contactsSnap.docs) {
    const data = doc.data();
    const nameFields = [data.displayName, data.firstName, data.lastName, data.name]
      .filter(Boolean)
      .map(v => String(v).toLowerCase());
    const searchText = nameFields.join(' ');
    const latinText = nameFields.map(n => greekToLatin(n)).filter(Boolean).join(' ');
    const fullText = `${searchText} ${latinText}`;

    if (allTerms.some(term => fullText.includes(term))) {
      return doc.id;
    }
  }

  return null;
}
