/**
 * =============================================================================
 * LINK CHANNEL — Manually Link External Channel Identity to Contact
 * =============================================================================
 *
 * Creates an external_identity document linking a channel (Telegram, WhatsApp,
 * etc.) to a CRM contact. Used when the contact hasn't sent a message via
 * that channel yet (no automatic webhook-based linking).
 *
 * @route POST /api/contacts/[contactId]/link-channel
 * @route DELETE /api/contacts/[contactId]/link-channel
 * @security Admin SDK + withAuth + Tenant Isolation
 * @enterprise Phase 2 — Multi-Channel Sharing
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { loadOwnedContact } from '../../_shared/contact-owned-doc';
import type { ContactAccessCaller } from '../../_shared/contact-ownership';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { generateExternalIdentityId } from '@/server/lib/id-generation';
import { IDENTITY_PROVIDER } from '@/types/conversations';
import type { IdentityProvider } from '@/types/conversations';
import {
  FieldValue,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
} from 'firebase-admin/firestore';

const logger = createModuleLogger('LinkChannelRoute');

// ============================================================================
// TYPES
// ============================================================================

interface LinkChannelRequest {
  provider: IdentityProvider;
  externalUserId: string;
  displayName?: string;
}

interface LinkChannelResponse {
  success: boolean;
  identityId: string;
}

interface UnlinkChannelRequest {
  provider: IdentityProvider;
  externalUserId: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

const LINKABLE_PROVIDERS = new Set<string>([
  IDENTITY_PROVIDER.TELEGRAM,
  IDENTITY_PROVIDER.WHATSAPP,
  IDENTITY_PROVIDER.MESSENGER,
  IDENTITY_PROVIDER.INSTAGRAM,
]);

/**
 * Ο κοινός πυρήνας: **ποιο κανάλι, ποιος χρήστης**. Και το link και το unlink
 * ζητούν ακριβώς αυτό το ζεύγος — το unlink ΤΙΠΟΤΑ παραπάνω.
 *
 * ⚠️ Ήταν γραμμένο δύο φορές (CHECK 3.28: 8 γραμμές / 62 tokens) και τα δύο
 * αντίγραφα **είχαν ήδη αποκλίνει**: το unlink έλεγε σκέτο «Invalid provider»
 * ενώ το link απαριθμούσε τα αποδεκτά. Ίδιος έλεγχος, δύο απαντήσεις στον
 * πελάτη, ανάλογα με ποιο ρήμα HTTP τον χτύπησε. Το πληρέστερο μήνυμα κρατιέται.
 */
function validateChannelIdentity(body: unknown): UnlinkChannelRequest {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'Invalid request body', 'VALIDATION_ERROR');
  }
  const b = body as Record<string, unknown>;

  if (typeof b.provider !== 'string' || !LINKABLE_PROVIDERS.has(b.provider)) {
    throw new ApiError(400, 'Invalid provider. Use: telegram, whatsapp, messenger, instagram', 'VALIDATION_ERROR');
  }
  if (typeof b.externalUserId !== 'string' || b.externalUserId.trim().length === 0) {
    throw new ApiError(400, 'Invalid externalUserId', 'VALIDATION_ERROR');
  }

  return {
    provider: b.provider as IdentityProvider,
    externalUserId: b.externalUserId.trim(),
  };
}

/** Ο πυρήνας + το προαιρετικό εμφανιζόμενο όνομα (μόνο το link το δέχεται). */
function validateLinkRequest(body: unknown): LinkChannelRequest {
  const identity = validateChannelIdentity(body);
  const { displayName } = body as Record<string, unknown>;

  if (displayName !== undefined && typeof displayName !== 'string') {
    throw new ApiError(400, 'Invalid displayName', 'VALIDATION_ERROR');
  }

  return {
    ...identity,
    displayName: typeof displayName === 'string' ? displayName.trim() : undefined,
  };
}

// ============================================================================
// SHARED STEPS — ό,τι κάνουν ΚΑΙ ΤΑ ΔΥΟ ρήματα πριν αγγίξουν το έγγραφο
// ============================================================================

/**
 * Απαγορεύει την πρόσβαση σε επαφή που δεν ανήκει στον ενεργό tenant.
 *
 * ⚠️ **Αλλαγή συμπεριφοράς στο POST (2026-07-28):** έλεγε 404 «Contact not
 * found» για ανύπαρκτη επαφή και 403 για επαφή άλλης εταιρείας. Αυτή η διάκριση
 * είναι **απαρίθμηση cross-tenant**: ο καλών μάθαινε ότι το `contactId` ΥΠΑΡΧΕΙ,
 * απλώς δεν είναι δικό του. Το DELETE απαντούσε ήδη 403 και στις δύο περιπτώσεις
 * — κρατήθηκε η αυστηρότερη από τις δύο συμπεριφορές, όχι η πιο ομιλητική.
 *
 * 🔄 **ADR-742 §7octies (2026-08-01) — η ίδια απόφαση, ένα επίπεδο βαθύτερα.**
 * Η παραπάνω ενοποίηση ήταν σωστή αλλά **τοπική**: έκανε τις δύο απαντήσεις
 * *αυτής* της διαδρομής ίδιες μεταξύ τους, και τις άφησε **διαφορετικές από τον
 * υπόλοιπο πόρο** — οι αδελφικές διαδρομές απαντούσαν `404 'Contact not found'`
 * για το ίδιο id. Το μαντείο ύπαρξης είναι ιδιότητα του **πόρου**, όχι της
 * διαδρομής (§7septies): μία που αποκλίνει τις ακυρώνει όλες.
 *
 * 🔴 **Και το grep της Ομάδας 4 δεν το είχε μετρήσει**: η σύγκριση ήταν γραμμένη
 * `[FIELDS.COMPANY_ID] !== companyId`, δηλαδή με **σταθερά** αντί για
 * κυριολεκτικό `.companyId`. Το μοτίβο `\.companyId !== ctx\.companyId` είναι
 * τυφλό σε αυτή τη μορφή — και θα ήταν τυφλό και το κλείδωμα του Βήματος 7.
 *
 * Ο {@link loadOwnedContact} κρατά τη **σειρά** δομικά (φόρτωσε→υπάρχει;→δικό
 * μου;) και ρίχνει το **ίδιο** «δεν βρέθηκε» με κάθε άλλη διαδρομή του πόρου.
 */
async function assertContactInTenant(
  db: Firestore,
  contactId: string,
  caller: ContactAccessCaller,
): Promise<void> {
  await loadOwnedContact({ contactId, caller, action: 'link-channel', db });
}

/**
 * **Ολόκληρο το άνοιγμα** που κάνουν και τα δύο ρήματα πριν γράψουν: σύνδεση,
 * φύλακας tenant, και ο ντετερμινιστικός δείκτης της ταυτότητας καναλιού μαζί με
 * το τρέχον στιγμιότυπό της.
 *
 * Επιστρέφει **και** το `ref` **και** το `existing`: το link χρειάζεται το
 * στιγμιότυπο για να διαλέξει update vs set και να κρατήσει το προηγούμενο
 * `displayName`· το unlink το χρειάζεται για να μη γράψει σε ανύπαρκτο έγγραφο.
 *
 * Το `identityId` βγαίνει από το ίδιο `generateExternalIdentityId` που καλούν τα
 * webhooks, ώστε χειροκίνητη και αυτόματη σύνδεση να καταλήγουν στο ΙΔΙΟ έγγραφο
 * — εκεί είναι όλη η ουσία του ντετερμινιστικού id.
 *
 * ⚠️ Είναι μία συνάρτηση και όχι τρεις κλήσεις στη σειρά επειδή η ΣΕΙΡΑ είναι το
 * ουσιώδες: ο φύλακας tenant τρέχει **πριν** διαβαστεί οτιδήποτε άλλο. Ως τρεις
 * γραμμές αντιγραμμένες σε δύο handlers, ο επόμενος που θα προσθέσει τρίτο ρήμα
 * μπορεί να τις γράψει με άλλη σειρά — ή να παραλείψει τη μεσαία.
 */
async function openChannelIdentity(
  contactId: string,
  caller: ContactAccessCaller,
  identity: UnlinkChannelRequest,
): Promise<{ identityId: string; ref: DocumentReference; existing: DocumentSnapshot }> {
  const db = requireAdminFirestore();
  await assertContactInTenant(db, contactId, caller);

  const identityId = generateExternalIdentityId(identity.provider, identity.externalUserId);
  const ref = db.collection(COLLECTIONS.EXTERNAL_IDENTITIES).doc(identityId);
  return { identityId, ref, existing: await ref.get() };
}

// ============================================================================
// POST — Link Channel to Contact
// ============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ contactId: string }> }
): Promise<NextResponse> {
  const { contactId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<LinkChannelResponse>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const body = await req.json().catch(() => null);
      const data = validateLinkRequest(body);

      if (!contactId || contactId.length < 3) {
        throw new ApiError(400, 'Invalid contactId', 'VALIDATION_ERROR');
      }

      const { identityId, ref: identityRef, existing } =
        await openChannelIdentity(contactId, ctx, data);

      if (existing.exists) {
        // Update contactId link if not already linked
        await identityRef.update({
          contactId,
          displayName: data.displayName ?? existing.data()?.displayName ?? '',
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        // Create new external identity with contact link
        await identityRef.set({
          id: identityId,
          companyId: ctx.companyId,
          provider: data.provider,
          externalUserId: data.externalUserId,
          contactId,
          displayName: data.displayName ?? '',
          verified: false,
          consent: { marketing: false, transactional: true },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
        });
      }

      logger.info('Channel linked to contact', {
        contactId,
        provider: data.provider,
        identityId,
        isUpdate: existing.exists,
        tenant: ctx.companyId,
      });

      return apiSuccess<LinkChannelResponse>({ success: true, identityId });
    },
    { permissions: 'crm:contacts:update' }
  );

  return handler(request);
}

// ============================================================================
// DELETE — Unlink Channel from Contact
// ============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ contactId: string }> }
): Promise<NextResponse> {
  const { contactId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<{ success: boolean }>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const body = await req.json().catch(() => null);
      const data = validateChannelIdentity(body);

      const { identityId, ref: identityRef, existing } =
        await openChannelIdentity(contactId, ctx, data);

      // Remove contactId link (keep identity for future auto-link)
      if (existing.exists) {
        await identityRef.update({
          contactId: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      logger.info('Channel unlinked from contact', {
        contactId, provider: data.provider, identityId, tenant: ctx.companyId,
      });

      return apiSuccess({ success: true });
    },
    { permissions: 'crm:contacts:update' }
  );

  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
export const DELETE = withSensitiveRateLimit(handleDelete);
