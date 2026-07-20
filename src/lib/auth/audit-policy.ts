/**
 * @fileoverview Audit Policy — three-tier retention / delivery / dedup SSoT
 *
 * Το ADR-438 έγραφε ΕΝΑ flat retention (12 μήνες) για κάθε audit γραμμή και έκανε
 * `await` σε κάθε write. Το `data_accessed` όμως πυροδοτείται σε read paths (ακόμη και
 * σε cache hits) ⇒ το `companies/{id}/audit_logs` μεγαλώνει χωρίς όριο, και κάθε read
 * πληρώνει ένα Firestore round-trip.
 *
 * Η λύση είναι ο διαχωρισμός που κάνουν Figma / Atlassian / Google Workspace:
 * το «security-compliance audit» (ποιος άλλαξε δικαιώματα) ΔΕΝ είναι το ίδιο πράγμα
 * με το «access telemetry» (ποιος διάβασε τι). Διαφορετική αξία ⇒ διαφορετικό
 * retention, διαφορετικό delivery, διαφορετικό dedup.
 *
 * | Tier       | Retention | Delivery | Dedup  | Γιατί                                    |
 * |------------|-----------|----------|--------|------------------------------------------|
 * | security   | 24 μήνες  | blocking | —      | forensics· πρέπει να επιβιώνει audit     |
 * | compliance | 12 μήνες  | blocking | —      | business record· ADR-438 status quo      |
 * | access     | 1 μήνας   | async    | 5 min  | τηλεμετρία· όγκος >> αξία ανά γραμμή     |
 *
 * ⚠️ Το `AUDIT_ACTION_TIER` είναι `Record<AuditAction, AuditTier>` — ΟΧΙ `Partial<>`,
 * ΟΧΙ index signature. Νέο action στο `AUDIT_ACTIONS` χωρίς tier = **compile error**.
 * Αυτό ΕΙΝΑΙ ο σκοπός: type-driven anchor, ώστε το «τι κρατάμε και για πόσο» να μην
 * μπορεί να ξεχαστεί σιωπηλά.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-438-audit-log-retention-ttl.md
 */

import type { AuditAction } from './types';

// =============================================================================
// TIER CONTRACT
// =============================================================================

/** Οι τρεις κατηγορίες audit γεγονότων. */
export type AuditTier = 'security' | 'compliance' | 'access';

/** Πολιτική ανά tier: πόσο ζει, πώς γράφεται, πόσο σφιχτά αποδιπλασιάζεται. */
export interface AuditTierConfig {
  /** Παράθυρο διατήρησης σε μήνες — τροφοδοτεί το `expiresAt` (Firestore TTL). */
  retentionMonths: number;
  /** `blocking` = ο caller περιμένει το write· `async` = fire-and-forget. */
  delivery: 'blocking' | 'async';
  /** Παράθυρο καταστολής διπλοεγγραφών σε ms. `0` = ποτέ καταστολή. */
  dedupWindowMs: number;
}

/** SSoT της πολιτικής ανά tier. */
export const AUDIT_TIER_CONFIG: Record<AuditTier, AuditTierConfig> = {
  security: { retentionMonths: 24, delivery: 'blocking', dedupWindowMs: 0 },
  compliance: { retentionMonths: 12, delivery: 'blocking', dedupWindowMs: 0 },
  access: { retentionMonths: 1, delivery: 'async', dedupWindowMs: 300_000 },
};

// =============================================================================
// ACTION → TIER (exhaustive over AUDIT_ACTIONS)
// =============================================================================

/**
 * Κάθε κλειδί του `AUDIT_ACTIONS` πρέπει να εμφανίζεται εδώ.
 * Ο τύπος `Record<AuditAction, AuditTier>` το επιβάλλει στον compiler.
 */
export const AUDIT_ACTION_TIER: Record<AuditAction, AuditTier> = {
  // --- security: αλλαγές εξουσίας, ταυτότητας, ή κατάστασης συστήματος ---------
  access_denied: 'security',
  claims_updated: 'security',
  role_changed: 'security',
  permission_granted: 'security',
  permission_revoked: 'security',
  permission_set_granted: 'security',
  permission_set_revoked: 'security',
  grant_created: 'security',
  grant_revoked: 'security',
  ownership_changed: 'security',
  user_suspended: 'security',
  user_activated: 'security',
  member_added: 'security',
  member_removed: 'security',
  member_updated: 'security',
  system_bootstrap: 'security',
  migration_executed: 'security',
  system_configured: 'security',
  data_fix_executed: 'security',
  direct_operation_executed: 'security',
  'asset_pack.access_denied': 'security',

  // --- access: τηλεμετρία ανάγνωσης — υψηλός όγκος, χαμηλή αξία ανά γραμμή -----
  data_accessed: 'access',

  // --- compliance: business record — τι δημιουργήθηκε/άλλαξε/στάλθηκε ---------
  data_created: 'compliance',
  data_updated: 'compliance',
  data_deleted: 'compliance',
  soft_deleted: 'compliance',
  restored: 'compliance',
  email_sent: 'compliance',
  message_sent: 'compliance',
  communication_created: 'compliance',
  communication_approved: 'compliance',
  communication_rejected: 'compliance',
  webhook_received: 'compliance',
  financial_transition: 'compliance',
  'procurement.po.created': 'compliance',
  'procurement.po.approved': 'compliance',
  'procurement.po.ordered': 'compliance',
  'procurement.po.status_changed': 'compliance',
  'procurement.po.items_edited': 'compliance',
  'procurement.po.cancelled': 'compliance',
  'procurement.po.deleted': 'compliance',
  'procurement.po.delivery_recorded': 'compliance',
  'procurement.po.invoice_linked': 'compliance',
};

// =============================================================================
// RESOLUTION
// =============================================================================

/** Το tier ενός action. */
export function resolveAuditTier(action: AuditAction): AuditTier {
  return AUDIT_ACTION_TIER[action];
}

/** Η πλήρης πολιτική ενός action (retention + delivery + dedup). */
export function resolveAuditPolicy(action: AuditAction): AuditTierConfig {
  return AUDIT_TIER_CONFIG[resolveAuditTier(action)];
}

/**
 * TTL expiry instant για νέα audit εγγραφή: `now` + retention του tier του action.
 *
 * Επιστρέφεται ως JS `Date` — το Firebase Admin SDK το γράφει ως Firestore
 * `Timestamp`, που είναι ο τύπος που απαιτεί το TTL policy.
 *
 * Το προαιρετικό `now` υπάρχει ώστε τα tests να είναι ντετερμινιστικά.
 */
export function computeAuditExpiry(action: AuditAction, now: Date = new Date()): Date {
  const expiry = new Date(now.getTime());
  expiry.setMonth(expiry.getMonth() + resolveAuditPolicy(action).retentionMonths);
  return expiry;
}

// =============================================================================
// IN-MEMORY DEDUP (access tier)
// =============================================================================

/**
 * Κλειδί ταυτότητας για dedup: «ο ίδιος δράστης ξαναδιάβασε τον ίδιο στόχο από την
 * ίδια διαδρομή». Το `path` συμμετέχει γιατί δύο διαφορετικά endpoints πάνω στην ίδια
 * οντότητα είναι διαφορετική πληροφορία πρόσβασης.
 */
export function buildAuditDedupKey(parts: {
  companyId: string;
  actorId: string;
  action: AuditAction;
  targetId: string;
  path?: string;
}): string {
  return [parts.companyId, parts.actorId, parts.action, parts.targetId, parts.path ?? ''].join('|');
}

/** key → epoch ms της τελευταίας εγγραφής που ΔΕΝ κατασταλήθηκε. */
const dedupSeen = new Map<string, number>();

/**
 * Πάνω από αυτό το μέγεθος κάνουμε eviction. Μια διπλή audit γραμμή δεν είναι bug
 * ορθότητας — το ΜΟΝΟ πραγματικό ρίσκο εδώ είναι ένα map που μεγαλώνει για πάντα.
 */
const DEDUP_MAP_MAX_ENTRIES = 5000;

/** Πετάει ό,τι έχει ήδη λήξει· αν παραμένει υπερμεγέθης, καθαρίζει τελείως. */
function evictStaleDedupEntries(windowMs: number, now: number): void {
  for (const [key, seenAt] of dedupSeen) {
    if (now - seenAt >= windowMs) {
      dedupSeen.delete(key);
    }
  }
  if (dedupSeen.size > DEDUP_MAP_MAX_ENTRIES) {
    dedupSeen.clear();
  }
}

/**
 * `true` ⇒ κατάστειλε την εγγραφή (το ίδιο κλειδί γράφτηκε μέσα στο `windowMs`).
 * `false` ⇒ γράψε — και το κλειδί καταγράφεται ως «τελευταία εγγραφή τώρα».
 *
 * `windowMs === 0` επιστρέφει ΠΑΝΤΑ `false`: τα blocking tiers δεν καταστέλλονται ποτέ.
 */
export function shouldSuppressDuplicate(key: string, windowMs: number, now: number): boolean {
  if (windowMs <= 0) {
    return false;
  }

  const seenAt = dedupSeen.get(key);
  if (seenAt !== undefined && now - seenAt < windowMs) {
    return true;
  }

  if (dedupSeen.size >= DEDUP_MAP_MAX_ENTRIES) {
    evictStaleDedupEntries(windowMs, now);
  }

  dedupSeen.set(key, now);
  return false;
}
