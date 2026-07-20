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
 * | Tier       | Retention | Delivery | Dedup παράθυρο | Γιατί                             |
 * |------------|-----------|----------|----------------|-----------------------------------|
 * | security   | 24 μήνες  | blocking | — (0)          | forensics· πρέπει να επιβιώνει    |
 * | compliance | 12 μήνες  | blocking | — (0)          | business record· ADR-438 status quo|
 * | access     | 1 μήνας   | async    | 5 min          | τηλεμετρία· όγκος >> αξία/γραμμή  |
 *
 * ⚠️ Το tier ορίζει **πόσο μεγάλο** είναι το dedup παράθυρο — ΟΧΙ **αν** εφαρμόζεται.
 * Το «αν» το δηλώνει το call site (`dedupable: true`). Βλ. `resolveDedupWindowMs`.
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
  /**
   * Παράθυρο καταστολής διπλοεγγραφών σε ms — **εφόσον** το call site το ζητήσει
   * (`dedupable: true`). `0` = το tier απαγορεύει καταστολή ακόμη κι αν ζητηθεί.
   */
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
 * Το πραγματικό dedup παράθυρο μιας κλήσης — **ο μοναδικός τόπος** όπου συναντιούνται
 * η δήλωση του call site και η πολιτική του tier.
 *
 * Κανόνας: **dedup = opt-in**. Χωρίς `dedupable: true` δεν καταστέλλεται τίποτα ποτέ.
 *
 * ΓΙΑΤΙ opt-in κι όχι καθολικό ανά tier (η ρίζα του ADR-438 v3):
 * το κλειδί dedup είναι `companyId|actorId|action|targetId|path` — συστατικά που σε
 * endpoints όπως το `/api/search` είναι **σταθερά ανά χρήστη**. Η διακριτική πληροφορία
 * (query, resultCount) ζει στο `newValue`/`reason`, **εκτός κλειδιού**. Άρα καθολικό
 * dedup σήμαινε: 20 διαφορετικές αναζητήσεις σε 5 λεπτά → **1 γραμμή**. Αυτό είναι
 * απώλεια τηλεμετρίας, όχι καταστολή διπλότυπων.
 *
 * ⚠️ ΜΗΝ «λύσεις» το ίδιο πρόβλημα βάζοντας το `reason` μέσα στο κλειδί: περιέχει
 * `duration ms` ⇒ πάντα μοναδικό ⇒ το dedup γίνεται νεκρό παντού, σιωπηλά.
 *
 * Δύο φρουροί, όχι ένας: ακόμη κι αν κάποιος γράψει `dedupable: true` σε security ή
 * compliance action, το `dedupWindowMs: 0` του tier το ακυρώνει. Μια γραμμή forensics
 * **δεν μπορεί** να καταπιεί από λάθος σε call site.
 */
export function resolveDedupWindowMs(action: AuditAction, dedupable: boolean | undefined): number {
  if (dedupable !== true) {
    return 0;
  }
  return resolveAuditPolicy(action).dedupWindowMs;
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

/**
 * Πετάει ό,τι έχει ήδη λήξει· αν **παρ' όλα αυτά** παραμένει υπερμεγέθης, καθαρίζει τελείως.
 *
 * Το ολικό `clear()` σβήνει και **φρέσκα, έγκυρα** κλειδιά — δεν είναι παράβλεψη, είναι
 * συνειδητή επιλογή. Η συνέπεια μιας λανθασμένης εκκαθάρισης εδώ είναι «γράφονται μερικές
 * επιπλέον γραμμές audit», δηλαδή ακριβώς η κατεύθυνση αστοχίας που θέλουμε παντού σε αυτό
 * το module (ΠΟΤΕ «χάνω σιωπηλά»). Το εναλλακτικό — πραγματικό LRU — θα απαιτούσε
 * παρακολούθηση χρόνου τελευταίας χρήσης· η `Map` κρατά σειρά **πρώτης** εισαγωγής, όχι
 * τελευταίας, οπότε το «σβήσε τα παλιότερα» θα ήταν λάθος με τη μορφή που έχει σήμερα.
 * Δεν αξίζει η πολυπλοκότητα για μια cache καταστολής τηλεμετρίας.
 */
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
 * `false` ⇒ γράψε — και το κλειδί σφραγίζεται **αισιόδοξα**, ως «γράφεται τώρα».
 *
 * `windowMs === 0` επιστρέφει ΠΑΝΤΑ `false`: τα blocking tiers δεν καταστέλλονται ποτέ.
 *
 * ⚠️ Η σφράγιση γίνεται **σύγχρονα, πριν** επιχειρηθεί το write — και αυτό είναι σκόπιμο:
 * είναι ο μόνος τρόπος να μη γλιστρήσουν δύο ταυτόχρονα requests και τα δύο μέσα από τον
 * έλεγχο στο ίδιο tick. Το τίμημα είναι ότι ένα write που τελικά **αποτυγχάνει** θα άφηνε
 * το κλειδί σφραγισμένο για όλο το παράθυρο — τυφλώνοντας πραγματικές επόμενες προσβάσεις
 * ενώ τίποτα δεν γράφτηκε. Γι' αυτό υπάρχει η `releaseDedupKey`: ο caller **οφείλει** να
 * την καλέσει όταν το write δεν πετύχει (βλ. `logAuditEvent`).
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

/**
 * Ακύρωσε την αισιόδοξη σφράγιση ενός κλειδιού, επειδή το write **δεν** έγινε τελικά.
 *
 * Χωρίς αυτό, μια αποτυχία γραφής (Firestore σφάλμα, cold shutdown με το fire-and-forget
 * in-flight) θα κρατούσε το κλειδί «πρόσφατα γραμμένο» για ολόκληρο το παράθυρο, ενώ στη
 * βάση δεν υπάρχει τίποτα. Δηλαδή: μία χαμένη γραμμή θα γινόταν **πέντε λεπτά τυφλότητας**.
 *
 * Idempotent — ασφαλές να κληθεί για κλειδί που δεν υπάρχει (π.χ. blocking tier, όπου
 * ποτέ δεν σφραγίστηκε τίποτα).
 *
 * ⚠️ Γνωστό, αποδεκτό όριο: αν το παράθυρο έχει ήδη λήξει και μια **νεότερη** κλήση έχει
 * ξανασφραγίσει το ίδιο κλειδί, το release μιας παλιάς αποτυχίας σβήνει εκείνη τη φρέσκια
 * σφραγίδα. Αποτέλεσμα: μία επιπλέον γραμμή audit. Η αστοχία δηλαδή γέρνει προς «γράφω
 * παραπάνω», ποτέ προς «χάνω σιωπηλά» — η ίδια κατεύθυνση με το opt-in dedup.
 */
export function releaseDedupKey(key: string): void {
  dedupSeen.delete(key);
}
