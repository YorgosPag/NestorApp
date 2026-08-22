/**
 * =============================================================================
 * SUPER ADMIN IDENTITY RESOLVER — ADR-145
 * =============================================================================
 *
 * Resolves whether an incoming message sender is a super admin.
 * Uses in-memory cache (5 min TTL) to avoid Firestore reads on every message.
 *
 * @module services/ai-pipeline/shared/super-admin-resolver
 * @see ADR-145 (Super Admin AI Assistant)
 * @see src/types/super-admin.ts (Type definitions)
 */

import 'server-only';

import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { decideMembership } from '@/lib/auth/workspace-membership';
import { isAllowed, orgWorkspace } from '@/types/workspace-membership';
import type {
  SuperAdminIdentity,
  SuperAdminRegistryDoc,
  SuperAdminResolution,
} from '@/types/super-admin';

const logger = createModuleLogger('SUPER_ADMIN_RESOLVER');

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

/** Cache TTL: 5 minutes (avoid Firestore read on every message) */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface RegistryCache {
  data: SuperAdminRegistryDoc | null;
  fetchedAt: number;
}

let registryCache: RegistryCache = {
  data: null,
  fetchedAt: 0,
};

/**
 * Fetch the super admin registry from Firestore (with cache)
 */
async function getRegistry(): Promise<SuperAdminRegistryDoc | null> {
  const now = Date.now();

  // Return cached if fresh
  if (registryCache.data && (now - registryCache.fetchedAt) < CACHE_TTL_MS) {
    return registryCache.data;
  }

  try {
    const adminDb = getAdminFirestore();
    const docRef = adminDb
      .collection(COLLECTIONS.SETTINGS)
      .doc(SYSTEM_DOCS.SUPER_ADMIN_REGISTRY);

    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      logger.warn('Super admin registry document not found', {
        path: `${COLLECTIONS.SETTINGS}/${SYSTEM_DOCS.SUPER_ADMIN_REGISTRY}`,
      });
      registryCache = { data: null, fetchedAt: now };
      return null;
    }

    const data = snapshot.data() as SuperAdminRegistryDoc;
    registryCache = { data, fetchedAt: now };

    logger.debug('Super admin registry loaded', {
      adminCount: data.admins?.length ?? 0,
      schemaVersion: data.schemaVersion,
    });

    return data;
  } catch (error) {
    logger.error('Failed to fetch super admin registry', { error: getErrorMessage(error) });
    // Return stale cache if available, otherwise null
    return registryCache.data;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Ο ΕΝΑΣ βρόχος αναγνώρισης — έξι κανάλια, μία υλοποίηση.
 *
 * 🔴 ΕΞΗΧΘΗ ΕΠΕΙΔΗ ΤΟ ΕΠΙΑΣΕ ΤΟ CHECK 3.28 (jscpd, N.18): οι έξι `isSuperAdmin*`
 * ήταν **token-ταυτόσημες** — 4 κλώνοι / 28 γραμμές, μετρημένοι και στο `7ccfc4fd`,
 * δηλαδή **προϋπήρχαν**. Το μοτίβο ήταν πάντα το ίδιο: «διάβασε το μητρώο · βρες
 * **ενεργό** διαχειριστή που ταιριάζει · κατάγραψε · επίστρεψε». Ό,τι διέφερε ήταν
 * **δεδομένα** (πώς ταιριάζει · πώς λέγεται · τι καταγράφεται), άρα παράμετροι.
 *
 * ⚠️ Το `if (!admin.isActive) continue` ζει **εδώ**, μία φορά: ήταν το είδος γραμμής
 * που, αντιγραμμένη έξι φορές, ξεχνιέται στην έβδομη — και τότε ένας **ανενεργός**
 * διαχειριστής θα αναγνωριζόταν κανονικά.
 *
 * @param matches   το κριτήριο του καναλιού
 * @param resolvedVia  πώς αναγνωρίστηκε (μέρος του συμβολαίου `SuperAdminResolution`)
 * @param channelLabel  ανθρώπινο όνομα καναλιού, μόνο για τα ίχνη
 * @param logFields  ό,τι επιπλέον θέλει να δει ο άνθρωπος στα ίχνη
 */
async function findActiveAdmin(
  matches: (admin: SuperAdminIdentity) => boolean,
  resolvedVia: SuperAdminResolution['resolvedVia'],
  channelLabel: string,
  logFields: Record<string, unknown>,
): Promise<SuperAdminResolution | null> {
  const registry = await getRegistry();
  if (!registry?.admins) return null;

  for (const admin of registry.admins) {
    if (!admin.isActive) continue;
    if (!matches(admin)) continue;
    logger.info(`Super admin identified via ${channelLabel}`, {
      displayName: admin.displayName,
      ...logFields,
    });
    return { identity: admin, resolvedVia };
  }

  return null;
}

/**
 * Check if a Telegram user is a super admin.
 *
 * @param telegramUserId - Telegram user ID (from webhook)
 * @returns SuperAdminResolution if admin, null otherwise
 */
export async function isSuperAdminTelegram(
  telegramUserId: string
): Promise<SuperAdminResolution | null> {
  return findActiveAdmin(
    (admin) => admin.channels.telegram?.userId === telegramUserId,
    'telegram_user_id',
    'Telegram',
    { telegramUserId },
  );
}

/**
 * Check if an email sender is a super admin.
 *
 * @param emailAddress - Sender email address (from Mailgun webhook)
 * @returns SuperAdminResolution if admin, null otherwise
 */
export async function isSuperAdminEmail(
  emailAddress: string
): Promise<SuperAdminResolution | null> {
  // ⚠️ ΜΟΝΟ αυτό το κανάλι κανονικοποιεί — τα email συγκρίνονται case-insensitive.
  const normalizedEmail = emailAddress.toLowerCase().trim();
  return findActiveAdmin(
    (admin) => (admin.channels.email?.addresses ?? [])
      .some((addr) => addr.toLowerCase().trim() === normalizedEmail),
    'email_address',
    'Email',
    { email: normalizedEmail },
  );
}

/**
 * Check if a WhatsApp user is a super admin.
 *
 * @param phoneNumber - WhatsApp phone number (wa_id from webhook)
 * @returns SuperAdminResolution if admin, null otherwise
 */
export async function isSuperAdminWhatsApp(
  phoneNumber: string
): Promise<SuperAdminResolution | null> {
  return findActiveAdmin(
    (admin) => admin.channels.whatsapp?.phoneNumber === phoneNumber,
    'whatsapp_phone',
    'WhatsApp',
    { phoneNumber },
  );
}

/**
 * Check if a Messenger user is a super admin.
 *
 * @param psid - Page-Scoped ID (from Messenger webhook)
 * @returns SuperAdminResolution if admin, null otherwise
 */
export async function isSuperAdminMessenger(
  psid: string
): Promise<SuperAdminResolution | null> {
  return findActiveAdmin(
    (admin) => admin.channels.messenger?.psid === psid,
    'messenger_psid',
    'Messenger',
    { psid },
  );
}

/**
 * Check if an Instagram user is a super admin.
 *
 * @param igsid - Instagram-Scoped ID (from Instagram webhook)
 * @returns SuperAdminResolution if admin, null otherwise
 */
export async function isSuperAdminInstagram(
  igsid: string
): Promise<SuperAdminResolution | null> {
  return findActiveAdmin(
    (admin) => admin.channels.instagram?.igsid === igsid,
    'instagram_igsid',
    'Instagram',
    { igsid },
  );
}

/**
 * Check if a Firebase Auth user is a super admin.
 *
 * @param firebaseUid - Firebase Auth UID (from session/JWT)
 * @returns SuperAdminResolution if admin, null otherwise
 */
export async function isSuperAdminFirebaseUid(
  firebaseUid: string
): Promise<SuperAdminResolution | null> {
  return findActiveAdmin(
    (admin) => admin.firebaseUid === firebaseUid,
    'firebase_uid',
    'Firebase UID',
    { firebaseUid },
  );
}

/**
 * Get the first active super admin's Telegram chatId for notifications.
 * SPEC-257D: Used by complaint triage to notify admin of urgent issues.
 * Benefits from the same 5-min cache as all other resolver functions.
 */
export async function getAdminTelegramChatId(): Promise<string | null> {
  const registry = await getRegistry();
  if (!registry?.admins) return null;

  const activeAdmin = registry.admins.find(
    a => a.isActive && a.channels.telegram?.chatId
  );
  return activeAdmin?.channels.telegram?.chatId ?? null;
}

/**
 * Ο χώρος που δήλωσε ο διαχειριστής στον επιλογέα — **αφού κριθεί** (ADR-787 §5.2 στ).
 *
 * Το `users/{uid}.activeCompanyId` είναι **κανάλι ελεγχόμενο από τον πελάτη**: το
 * γράφει ο φυλλομετρητής (`SuperAdminCompanyContext.tsx`, `setDoc`) και ο κανόνας
 * `firestore.rules` (`allow update: request.auth.uid == userId`) το επιτρέπει σε
 * **κάθε** χρήστη, **χωρίς field allowlist**.
 *
 * 🔴 ΓΙΑΤΙ ΑΛΛΑΞΕ. Μέχρι 2026-08-22 αυτή η συνάρτηση **επέστρεφε την τιμή ωμή**, και ο
 * Telegram adapter δρομολογούσε εκεί τις εντολές του bot. Ένα πρόγραμμα με **αυθεντία
 * διακομιστή** που εμπιστεύεται είσοδο γραμμένη από τον πελάτη είναι *confused deputy*
 * με την τεχνική σημασία του όρου — και ήταν η **ίδια** βλάβη που η Φάση 1 έκλεισε στην
 * κεφαλίδα HTTP (§2.8 #3), ζωντανή σε **δεύτερο** κανάλι.
 *
 * ⚠️ Ο ΚΡΙΤΗΣ ΖΕΙ ΕΔΩ, ΟΧΙ ΣΤΟΝ ΚΑΛΟΥΝΤΑ. Αν έμπαινε στον `telegram-channel-adapter`,
 * θα ήταν κανόνας που ο **επόμενος** καλών πρέπει να θυμάται — το σχήμα που έχει
 * αποτύχει μετρημένα (CHECK 3.34: **63** · 3.37: **18 vs 26**). Εδώ είναι **αδύνατο**
 * να επιστραφεί ακρίτητη τιμή.
 *
 * ⚠️ ΤΟ ΑΙΤΗΜΑ ΕΙΝΑΙ ΠΑΝΤΑ `orgWorkspace(...)`: το κανάλι κρατά `companyId`, άρα δεν
 * μπορεί να ζητήσει τον **ιδιωτικό** χώρο άλλου ανθρώπου (ADR-787 Ε-3 §3).
 *
 * @param firebaseUid - Firebase Auth UID του διαχειριστή
 * @returns Ο χώρος **αν** ο άνθρωπος επιτρέπεται εκεί· αλλιώς `null` (fail-closed)
 */
export async function resolveVerifiedActiveWorkspace(
  firebaseUid: string | null
): Promise<string | null> {
  if (!firebaseUid) return null;
  try {
    const adminDb = getAdminFirestore();
    const snap = await adminDb.collection(COLLECTIONS.USERS).doc(firebaseUid).get();
    if (!snap.exists) return null;
    const data = snap.data() as { activeCompanyId?: string };
    const requestedId = data.activeCompanyId;
    if (!requestedId) return null;

    // Η αυθεντία είναι τα **claims**, ποτέ το έγγραφο που μόλις διαβάσαμε.
    const user = await getAdminAuth().getUser(firebaseUid);
    const claims = (user.customClaims ?? {}) as { companyId?: string; globalRole?: string };
    if (!claims.companyId) return null;

    const decision = await decideMembership({
      uid: firebaseUid,
      claimCompanyId: claims.companyId,
      globalRole: claims.globalRole ?? '',
      requested: orgWorkspace(requestedId),
    });

    if (isAllowed(decision.verdict)) return requestedId;

    logger.warn('Ο δηλωμένος ενεργός χώρος απορρίφθηκε — δεν είναι μέλος', {
      firebaseUid,
      requested: requestedId,
      verdict: decision.verdict,
    });
    return null;
  } catch (error) {
    // ⛔ ΑΓΝΩΣΤΟ ≠ ΕΠΙΤΡΕΠΤΟ (N.12): αποτυχία ανάγνωσης ⇒ **καμία** παράκαμψη
    //    δρομολόγησης· ο καλών πέφτει πίσω στον χώρο του ίδιου του μηνύματος.
    logger.warn('Failed to resolve verified active workspace', {
      firebaseUid,
      error: getErrorMessage(error),
    });
    return null;
  }
}

/**
 * Force-refresh the registry cache.
 * Useful after updating the registry document.
 */
export function invalidateRegistryCache(): void {
  registryCache = { data: null, fetchedAt: 0 };
  logger.info('Super admin registry cache invalidated');
}
