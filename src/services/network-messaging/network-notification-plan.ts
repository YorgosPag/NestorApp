/**
 * @fileoverview **ΠΟΙΟΣ ΕΙΔΟΠΟΙΕΙΤΑΙ — ΚΑΘΑΡΟΣ ΠΥΡΗΝΑΣ, ΜΗΔΕΝ I/O** (ADR-867 Β6).
 * @related ADR-834 §5 Β (α) ② (σίγαση) · (ε) 🏆 (απουσία) · network-away.ts (`isAwayActive`) ·
 *   network-notifier.ts (ο εκτελεστής) · thread-audience.ts (`isLiveAudience`)
 * @module services/network-messaging/network-notification-plan
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🌐 Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ — «ΕΝΑΣ ΥΠΕΥΘΥΝΟΣ ΕΙΔΟΠΟΙΕΙΤΑΙ, ΟΙ ΑΛΛΟΙ ΟΤΑΝ ΧΡΕΙΑΣΤΕΙ»
 * ─────────────────────────────────────────────────────────────────────────────
 * | Πλατφόρμα | Ποιος ειδοποιείται για εισερχόμενο |
 * |---|---|
 * | Follow Up Boss (Zillow) | **ο assigned agent** — *«collaborators do not receive notifications when there is communication from the lead»* |
 * | HubSpot | ο **owner** (ακολουθεί αυτόματα την εγγραφή του)· οι άλλοι μόνο με «follow» / @mention |
 * | Front | ο **assignee**· η ανάθεση *«tells the rest of the team to leave it alone»* |
 *
 * ⇒ **Κύριο πρόσωπο κάθε πλευράς** (υπεύθυνος · αντισυμβαλλόμενος · πρόσωπο) ειδοποιείται **πάντα**.
 * Οι **συνεργάτες** ειδοποιούνται **μόνο όταν αναπληρώνουν**: 🏆 όταν το κύριο πρόσωπο της πλευράς
 * τους **λείπει** (ADR-834 (ε): *«τα ΝΕΑ μηνύματα ειδοποιούν τα υπόλοιπα μέλη»*). Κανείς από τους
 * τρεις δεν το κάνει: στο Follow Up Boss ο πελάτης γράφει σε agent σε διακοπές και **κανείς** δεν
 * χτυπά καμπανάκι — ακριβώς το «ορφανό νήμα» που το (ε) απαγορεύει.
 *
 * 🔑 **ΜΟΝΟ ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ**: ό,τι γράφει η **δική μου** πλευρά δεν με ειδοποιεί (Follow Up Boss —
 * το εξερχόμενο του συναδέλφου δεν είναι «νέο» για το γραφείο). Η **πλευρά** είναι το `side`· στο
 * νήμα **σχέσης** (Β8) κάθε πρόσωπο είναι πλευρά μόνο του.
 *
 * 🔑 **ΜΙΑ ΕΙΔΟΠΟΙΗΣΗ ΑΝΑ «ΔΙΑΣΤΗΜΑ ΑΔΙΑΒΑΣΤΩΝ»** (Slack/Teams: ένα σήμα ανά συνομιλία): η ταυτότητα
 * του γεγονότος είναι το `lastReadAt` του **παραλήπτη**. Δέκα μηνύματα πριν ανοίξει το νήμα ⇒ ίδιο
 * κλειδί ⇒ ο orchestrator κρατά **μία** (ατομικό `create`). Διαβάζει ⇒ νέο κλειδί ⇒ το επόμενο μήνυμα
 * ξαναχτυπά. **Κανένα ρολόι, κανένα debounce, κανένας νέος μηχανισμός.**
 *
 * ⛔ **Αποκλεισμοί = λίστα κανόνων** ({@link RecipientVeto}): σήμερα η **σίγαση**· η **φραγή** του Β8
 * μπαίνει ως **μία** γραμμή, **χωρίς** αλλαγή του πυρήνα.
 */

import type {
  NetworkActTeam,
  NetworkAudienceEntry,
  NetworkAudienceRole,
} from '@/types/network-thread';

import { isAwayActive, type NetworkAway } from './network-away';
import { isLiveAudience } from './thread-audience';

// =============================================================================
// ΝΕΟ ΜΗΝΥΜΑ
// =============================================================================

/**
 * Οι ρόλοι που ειδοποιούνται **πάντα** — το **κύριο πρόσωπο** κάθε πλευράς. Ο `collaborator`
 * λείπει **επίτηδες**: ειδοποιείται μόνο ως αναπληρωτής.
 */
export const PRIMARY_NOTIFY_ROLES: ReadonlySet<NetworkAudienceRole> = new Set<NetworkAudienceRole>([
  'responsible',
  'counterpart',
  'person',
]);

/** Γιατί ειδοποιείται — κλειστό σύνολο: αλλάζει τον τίτλο που διαβάζει ο άνθρωπος. */
export type MessageNotifyReason = 'direct' | 'covering';

export interface MessageRecipient {
  readonly uid: string;
  readonly side: NetworkAudienceEntry['side'];
  readonly reason: MessageNotifyReason;
  /**
   * 🔑 **Η ταυτότητα του γεγονότος** — το `lastReadAt` του παραλήπτη τη στιγμή της αποστολής
   * (`never` αν δεν άνοιξε ποτέ). Βλ. κεφαλίδα: μία ειδοποίηση ανά διάστημα αδιάβαστων.
   */
  readonly episode: string;
  /** Μόνο στο `covering`: **ποιον** αναπληρώνει (το κύριο πρόσωπο που λείπει). */
  readonly coversUid: string | null;
}

/** Ένας κανόνας αποκλεισμού: `true` ⇒ **καμία** ειδοποίηση σε αυτή τη γραμμή. */
export type RecipientVeto = (entry: NetworkAudienceEntry) => boolean;

/** ADR-834 (α) ② — **σίγαση**: τα μηνύματα φτάνουν, το καμπανάκι όχι. */
export const mutedVeto: RecipientVeto = (entry) => entry.muted === true;

/** Οι αποκλεισμοί που ισχύουν σήμερα. ⚠️ Β8: + `blockedVeto` — εδώ, μία γραμμή. */
export const MESSAGE_VETOES: readonly RecipientVeto[] = [mutedVeto];

export interface MessagePlanInput {
  /** **Όλο** το ακροατήριο (και σφραγισμένα — φιλτράρονται εδώ). */
  readonly audience: readonly NetworkAudienceEntry[];
  readonly senderUid: string;
  /** Οι δηλώσεις απουσίας των μελών (όσες υπάρχουν). */
  readonly aways: ReadonlyMap<string, NetworkAway>;
  readonly nowISO: string;
}

/** Η «πλευρά» για το «εισερχόμενο;» — στο νήμα σχέσης κάθε πρόσωπο είναι πλευρά μόνο του. */
function partyOf(entry: Pick<NetworkAudienceEntry, 'side' | 'uid'>): string {
  return entry.side === 'person' ? `person:${entry.uid}` : entry.side;
}

/** Το κλειδί του διαστήματος αδιάβαστων — ένα σημείο, και για τον σχεδιαστή και για τις άγκυρες. */
export function unreadEpisodeOf(entry: Pick<NetworkAudienceEntry, 'lastReadAt'>): string {
  return entry.lastReadAt ?? 'never';
}

/** Η ειδοποίηση μιας πλευράς: κύρια πρόσωπα πάντα· συνεργάτες όσο λείπει κύριο πρόσωπο. */
function planForParty(
  rows: readonly NetworkAudienceEntry[],
  isAway: (uid: string) => boolean,
): MessageRecipient[] {
  const primaries = rows.filter((row) => PRIMARY_NOTIFY_ROLES.has(row.role));
  const direct = primaries.map((row) => recipient(row, 'direct', null));
  const absent = primaries.find((row) => isAway(row.uid)) ?? null;
  if (absent === null) return direct;
  const covering = rows
    .filter((row) => !PRIMARY_NOTIFY_ROLES.has(row.role) && !isAway(row.uid))
    .map((row) => recipient(row, 'covering', absent.uid));
  return [...direct, ...covering];
}

function recipient(
  row: NetworkAudienceEntry,
  reason: MessageNotifyReason,
  coversUid: string | null,
): MessageRecipient {
  return { uid: row.uid, side: row.side, reason, episode: unreadEpisodeOf(row), coversUid };
}

/**
 * 🔑 **Ποιοι ειδοποιούνται για ένα νέο μήνυμα** — και γιατί.
 *
 * ⚠️ Το κύριο πρόσωπο που **λείπει** ειδοποιείται **κι αυτό** στο καμπανάκι: είναι τα εισερχόμενά
 * του όταν γυρίσει (Outlook: η απουσία δεν σταματά την παράδοση). Το **email** του όμως το κόβει η
 * πύλη αποστολής, αν λείπει ακόμη τη στιγμή που θα έφευγε (`network-unread-email.ts`).
 */
export function planMessageNotifications(
  input: MessagePlanInput,
  vetoes: readonly RecipientVeto[] = MESSAGE_VETOES,
): readonly MessageRecipient[] {
  const live = input.audience.filter((entry) => isLiveAudience(entry));
  const sender = live.find((entry) => entry.uid === input.senderUid);
  if (sender === undefined) return [];
  const senderParty = partyOf(sender);
  const isAway = (uid: string) => isAwayActive(input.aways.get(uid) ?? null, input.nowISO);

  const byParty = new Map<string, NetworkAudienceEntry[]>();
  for (const entry of live) {
    if (entry.uid === input.senderUid || partyOf(entry) === senderParty) continue;
    if (vetoes.some((veto) => veto(entry))) continue;
    byParty.set(partyOf(entry), [...(byParty.get(partyOf(entry)) ?? []), entry]);
  }
  return [...byParty.values()].flatMap((rows) => planForParty(rows, isAway));
}

// =============================================================================
// ΕΙΣΟΔΟΣ ΣΤΗΝ ΟΜΑΔΑ ΤΗΣ ΠΡΑΞΗΣ
// =============================================================================

/**
 * Πώς μπήκε κάποιος — κλειστό σύνολο, ένας τίτλος ανά τιμή.
 * `failover` = **μεταβίβαση στην αποχώρηση** (το email του Microsoft 365 στον manager).
 */
export type TeamArrivalKind = 'assigned' | 'failover' | 'added';

export interface TeamArrival {
  readonly uid: string;
  readonly kind: TeamArrivalKind;
}

/**
 * 🔑 **Ποιοι μπήκαν στην ομάδα** ανάμεσα σε δύο εκδόσεις — νέος υπεύθυνος ή νέο μέλος.
 *
 * ⚠️ **Ποτέ ο ίδιος ο δρων**: ο διαχειριστής που αναθέτει στον εαυτό του δεν χρειάζεται να
 * μάθει τι έκανε (Salesforce «Send Notification Email» — προς τον **άλλον**).
 * ⚠️ Νέος υπεύθυνος που **ήταν ήδη** μέλος ειδοποιείται κι αυτός: άλλαξε η **ευθύνη** του.
 */
export function teamArrivals(
  before: Pick<NetworkActTeam, 'responsibleUid' | 'memberUids'>,
  after: Pick<NetworkActTeam, 'responsibleUid' | 'memberUids'>,
  context: { readonly actorUid: string; readonly departure: boolean },
): readonly TeamArrival[] {
  const arrivals: TeamArrival[] = [];
  if (after.responsibleUid !== before.responsibleUid) {
    arrivals.push({ uid: after.responsibleUid, kind: context.departure ? 'failover' : 'assigned' });
  }
  for (const uid of after.memberUids) {
    if (uid !== after.responsibleUid && !before.memberUids.includes(uid)) arrivals.push({ uid, kind: 'added' });
  }
  return arrivals.filter((arrival) => arrival.uid !== context.actorUid);
}
