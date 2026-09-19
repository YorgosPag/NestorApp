import 'server-only';

/**
 * @fileoverview **«ΝΕΟ ΜΗΝΥΜΑ» · «ΣΟΥ ΑΝΑΤΕΘΗΚΕ»** — οι ειδοποιήσεις των νημάτων συνεργατών (ADR-867 Β6).
 * @related network-notification-plan.ts (ΠΟΙΟΣ — καθαρό) · server/notifications/notification-orchestrator.ts
 *   (καμπανάκι + email) · network-unread-email.ts (η ερώτηση της πύλης email) · lib/network-edge/edge-sources.ts
 *   (`actSubjectOf` — το μόνο σημείο που ξέρει τι είναι «εντολή»)
 * @module services/network-messaging/network-notifier
 *
 * 🔑 **ΟΙ ΤΡΕΙΣ ΙΔΙΟΤΗΤΕΣ ΤΟΥ ΠΡΟΤΥΠΟΥ** (`stay-booking-notifier` · `mandate-request-notifier`):
 * 1. **ΜΕΤΑ τη γραφή** — ο γραφέας καλεί εδώ **μόνο** για δεσμευμένη συναλλαγή (N.7.2 #6).
 * 2. **Ιδεμποτησία από ταυτότητα, ποτέ από ώρα**: μήνυμα ⇒ το **διάστημα αδιάβαστων** του παραλήπτη·
 *    ομάδα ⇒ η **έκδοσή** της. Δεύτερη κλήση ⇒ ίδιο κλειδί ⇒ κανένα δεύτερο καμπανάκι.
 * 3. **ΠΟΤΕ δεν πετά** — αποτυχία ειδοποίησης δεν αναιρεί μήνυμα ή ανάθεση που **έγινε**.
 *
 * 🔒 **ΚΑΝΕΝΑ ΚΕΙΜΕΝΟ ΜΗΝΥΜΑΤΟΣ** στην ειδοποίηση ή στο email: μόνο «από ποιον, για ποιο πράγμα». Η ανάκληση
 * (60′, Β4β) δεν επιτρέπεται να προλαβαίνεται από εισερχόμενα email· και ο πελάτης διαβάζει το μήνυμα
 * **εκεί όπου ισχύουν οι κανόνες** — στο νήμα. Κανένα κείμενο απουσίας (ΓΚΠΔ — ούτε «γιατί»).
 *
 * 📧 **Email μόνο για ό,τι μένει αδιάβαστο** ({@link NETWORK_UNREAD_EMAIL_GRACE_MS}): το missed-activity
 * email του Teams (από 10′) · το «when I'm not active» του Slack (ανά 15′). Ισχύουν **και** η συχνότητα
 * και οι ώρες ησυχίας του ανθρώπου· η πύλη αποστολής ξαναρωτά «διαβάστηκε;» τη στιγμή που θα έφευγε.
 *
 * 🔶 **Δηλωμένο όριο — καμία διεύθυνση προορισμού ακόμη**: η οθόνη νήματος είναι το **Β7**. Ειδοποίηση με
 * κουμπί που οδηγεί στο «δεν είναι διαθέσιμη» θα ήταν υπόσχεση που δεν τηρείται (ADR-848). Το Β7 προσθέτει
 * τον προορισμό **και** τον κανόνα του στο `notification-destination-rules.ts`.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { listingNoticeTitle } from '@/lib/listings/listing-notice-title';
import { actSubjectOf } from '@/lib/network-edge/edge-sources';
import { createModuleLogger } from '@/lib/telemetry';
import { generateDeterministicNetworkActThreadId } from '@/services/enterprise-id.service';
import { resolveUserDisplayName } from '@/services/entity-audit.service';
import { dispatchNotification, type DispatchDestination } from '@/server/notifications/notification-orchestrator';
import { resolveRecipientEmail } from '@/server/notifications/notification-email-leg';
import type {
  NetworkActKind,
  NetworkActTeam,
  NetworkAudienceEntry,
  NetworkThreadTopic,
} from '@/types/network-thread';
import {
  orgWorkspace,
  personalWorkspace,
  workspaceTenantId,
  type WorkspaceRef,
} from '@/types/workspace-membership';

import { readAwaysOf } from './network-away';
import { actHostDestination, threadMessageDestination } from './network-destination';
import {
  planMessageNotifications,
  type MessageRecipient,
  type TeamArrival,
  type TeamArrivalKind,
} from './network-notification-plan';

const logger = createModuleLogger('network-notifier');

/**
 * **Πόσο περιμένει το email** πριν φύγει — και φεύγει **μόνο** αν το μήνυμα είναι ακόμη αδιάβαστο.
 * Slack: ομαδοποίηση ανά **15′** ή ανά ώρα· Teams: από **10′** ως μία φορά τη μέρα. Το 15′ είναι το
 * κατώφλι του Slack: αρκετό για να προλάβει ο άνθρωπος να απαντήσει από την εφαρμογή, αρκετά μικρό ώστε
 * ο πελάτης να μην περιμένει.
 */
export const NETWORK_UNREAD_EMAIL_GRACE_MS = 15 * 60_000;

// =============================================================================
// ΛΕΞΕΙΣ — κλειδιά για την οθόνη, θέμα email στον διακομιστή
// =============================================================================

/**
 * ⚠️ **Στατικά κλειδιά, ποτέ ``t(`…${reason}`)``** (CHECK 3.8). Χωρίς πρόθεμα namespace: ο
 * `NotificationDrawer` αποδίδει με `common-shared`.
 */
const MESSAGE_TITLE_KEYS = {
  direct: 'networkMessage.directTitle',
  covering: 'networkMessage.coveringTitle',
  personal: 'networkMessage.personalTitle',
} as const;

const ARRIVAL_TITLE_KEYS: Readonly<Record<TeamArrivalKind, string>> = {
  assigned: 'networkTeamJoined.assignedTitle',
  failover: 'networkTeamJoined.failoverTitle',
  added: 'networkTeamJoined.addedTitle',
};

/**
 * **Το θέμα του email**, ελληνικά, στον διακομιστή — το `titleKey` είναι η αλήθεια της οθόνης. 🔶 Ο
 * αποδότης i18n διακομιστή είναι το **κοινό, ονομασμένο** κενό όλων των αγωγών (ADR-777 §8.22 #2).
 */
type Params = Readonly<Record<string, string>>;
const MESSAGE_SUBJECTS: Readonly<Record<keyof typeof MESSAGE_TITLE_KEYS, (p: Params) => string>> = {
  direct: (p) => `Νέο μήνυμα από ${p.sender} για «${p.subject}»`,
  covering: (p) => `Νέο μήνυμα από ${p.sender} για «${p.subject}» · ${p.absent}: εκτός γραφείου, διαβάζετε εσείς`,
  personal: (p) => `Νέο μήνυμα από ${p.sender}`,
};
const ARRIVAL_SUBJECTS: Readonly<Record<TeamArrivalKind, (p: Params) => string>> = {
  assigned: (p) => `Σας ανατέθηκε η ευθύνη για «${p.subject}»`,
  failover: (p) => `Αναλάβατε την ευθύνη για «${p.subject}» — ${p.previous} αποχώρησε από το γραφείο`,
  added: (p) => `Προστεθήκατε στην ομάδα για «${p.subject}»`,
};

// =============================================================================
// ΚΟΙΝΑ ΚΟΜΜΑΤΙΑ
// =============================================================================

/** Το όνομα ενός ανθρώπου για μήνυμα — όνομα, αλλιώς διεύθυνση, **ποτέ** κενό. */
async function personLabelOf(uid: string): Promise<string> {
  return (await resolveUserDisplayName(uid, null)) ?? (await resolveRecipientEmail(uid)) ?? uid;
}

async function personLabelsOf(uids: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const unique = [...new Set(uids)];
  const labels = await Promise.all(unique.map(personLabelOf));
  return new Map(unique.map((uid, index) => [uid, labels[index] ?? uid]));
}

/** «Για ΠΟΙΟ πράγμα;» — ο τίτλος της αγγελίας της πράξης (το μητρώο πηγών λέει ποια). */
async function actSubjectLabel(adminDb: AdminFirestore, actKind: NetworkActKind, actSeed: string): Promise<string | null> {
  const subject = actSubjectOf(actKind, actSeed);
  return subject === null ? null : listingNoticeTitle(adminDb, subject.ownerPropertyId);
}

/** Ο χώρος του παραλήπτη: το γραφείο για την πλευρά του, ο **ιδιωτικός** χώρος για κάθε πρόσωπο. */
function recipientWorkspace(topic: NetworkThreadTopic, recipient: Pick<MessageRecipient, 'uid' | 'side'>): WorkspaceRef {
  return topic.kind === 'act' && recipient.side === 'host'
    ? orgWorkspace(topic.hostCompanyId)
    : personalWorkspace(recipient.uid);
}

/** Μία ειδοποίηση — η αποτυχία της **ονομάζεται** και **δεν** αγγίζει τις υπόλοιπες. */
async function settle(tasks: readonly Promise<unknown>[], context: Readonly<Record<string, string>>): Promise<void> {
  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      logger.error('Ειδοποίηση δικτύου δεν στάλθηκε', {
        data: context,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });
}

// =============================================================================
// ΝΕΟ ΜΗΝΥΜΑ
// =============================================================================

/** Ό,τι είχε ήδη στα χέρια της η συναλλαγή της αποστολής — **καμία** δεύτερη ανάγνωση ακροατηρίου. */
export interface NetworkMessageNotice {
  readonly threadId: string;
  readonly topic: NetworkThreadTopic;
  /** Το ακροατήριο **όπως το διάβασε** η συναλλαγή (πριν από τις δικές της γραφές). */
  readonly audience: readonly NetworkAudienceEntry[];
  readonly senderUid: string;
  readonly sentAt: string;
}

/** Τίτλος + παράμετροι ενός παραλήπτη — καθαρό, πάνω σε ήδη λυμένα ονόματα. */
function messageWording(
  recipient: MessageRecipient,
  subject: string | null,
  labels: ReadonlyMap<string, string>,
  senderUid: string,
): { readonly key: keyof typeof MESSAGE_TITLE_KEYS; readonly params: Params } {
  const sender = labels.get(senderUid) ?? senderUid;
  if (subject === null) return { key: 'personal', params: { sender } };
  if (recipient.reason === 'covering' && recipient.coversUid !== null) {
    return { key: 'covering', params: { sender, subject, absent: labels.get(recipient.coversUid) ?? '' } };
  }
  return { key: 'direct', params: { sender, subject } };
}

/**
 * 🔗 ADR-867 Β7 · §8 #9 — «Άνοιγμα» προς το νήμα, **με τον χώρο του** (ADR-849 Β1). Νήμα σχέσης ⇒ κανένας
 * προορισμός ακόμη (δεν έχει οθόνη, Β8): μόνο ο χώρος, ποτέ κουμπί προς το πουθενά (ADR-848).
 */
function messageDispatchDestination(
  notice: NetworkMessageNotice,
  recipientUid: string,
  workspace: WorkspaceRef,
): DispatchDestination {
  return threadMessageDestination(notice.topic, notice.threadId, recipientUid) ?? { workspace };
}

/**
 * 🔗 ADR-867 Β7 · §8 #9 — ο νέος υπεύθυνος/συνεργάτης ανοίγει την **εντολή, στο νήμα της** (εκεί ζει και η
 * ομάδα). Το νήμα μπορεί να μην υπάρχει ακόμη (ιδιοκτήτης χωρίς λογαριασμό, §8 #1): η σελίδα ανοίγει
 * κανονικά και η άγκυρα απλώς δεν βρίσκει τίποτα να αποκαλύψει.
 */
function arrivalDispatchDestination(notice: TeamArrivalNotice, workspace: WorkspaceRef): DispatchDestination {
  const threadId = generateDeterministicNetworkActThreadId(notice.team.actSeed);
  return actHostDestination(notice.team, threadId) ?? { workspace };
}

function dispatchMessage(
  notice: NetworkMessageNotice,
  recipient: MessageRecipient,
  wording: ReturnType<typeof messageWording>,
): Promise<unknown> {
  const workspace = recipientWorkspace(notice.topic, recipient);
  return dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.NETWORK_THREAD_MESSAGE,
    recipientId: recipient.uid,
    tenantId: workspaceTenantId(workspace),
    ...messageDispatchDestination(notice, recipient.uid, workspace),
    title: MESSAGE_SUBJECTS[wording.key](wording.params),
    titleKey: MESSAGE_TITLE_KEYS[wording.key],
    titleParams: { ...wording.params },
    // 🔑 Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ ΤΟ ΔΙΑΣΤΗΜΑ ΑΔΙΑΒΑΣΤΩΝ — δες `network-notification-plan.ts`.
    eventId: `network-thread:${notice.threadId}:${recipient.episode}`,
    entityId: notice.threadId,
    entityType: NOTIFICATION_ENTITY_TYPES.NETWORK_THREAD,
    source: { service: SOURCE_SERVICES.NETWORK, feature: 'thread-message', env: getCurrentEnvironment() },
    emailFacts: { kind: 'network-thread-unread', threadId: notice.threadId, since: notice.sentAt },
    emailNotBefore: new Date(Date.parse(notice.sentAt) + NETWORK_UNREAD_EMAIL_GRACE_MS),
  });
}

/**
 * **Λέει «νέο μήνυμα» σε όσους αφορά** — κύρια πρόσωπα της άλλης πλευράς, και αναπληρωτές όσο εκείνα
 * λείπουν. Καλείται **μόνο** μετά από δεσμευμένη αποστολή. **Κανένα πέταγμα.**
 */
export async function announceNetworkMessage(adminDb: AdminFirestore, notice: NetworkMessageNotice): Promise<void> {
  try {
    const others = notice.audience.filter((entry) => entry.uid !== notice.senderUid).map((entry) => entry.uid);
    const aways = await readAwaysOf(adminDb, others);
    const recipients = planMessageNotifications({ ...notice, aways, nowISO: notice.sentAt });
    if (recipients.length === 0) return;

    const [labels, subject] = await Promise.all([
      personLabelsOf([notice.senderUid, ...recipients.flatMap((r) => (r.coversUid === null ? [] : [r.coversUid]))]),
      notice.topic.kind === 'act' ? actSubjectLabel(adminDb, notice.topic.actKind, notice.topic.actSeed) : null,
    ]);
    await settle(
      recipients.map((recipient) =>
        dispatchMessage(notice, recipient, messageWording(recipient, subject, labels, notice.senderUid))),
      { threadId: notice.threadId },
    );
  } catch (error) {
    logger.error('Οι ειδοποιήσεις νέου μηνύματος δεν στάλθηκαν', {
      data: { threadId: notice.threadId },
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// =============================================================================
// ΕΙΣΟΔΟΣ ΣΤΗΝ ΟΜΑΔΑ
// =============================================================================

export interface TeamArrivalNotice {
  /** Η ομάδα **μετά** την αλλαγή — με την **έκδοση** που ταυτίζει το γεγονός. */
  readonly team: Pick<NetworkActTeam, 'id' | 'actKind' | 'actSeed' | 'hostCompanyId' | 'version'>;
  readonly arrivals: readonly TeamArrival[];
  /** Μόνο στη μεταβίβαση: **ποιος έφυγε** — ο κληρονόμος πρέπει να ξέρει ποιον αντικαθιστά. */
  readonly departingUid?: string;
}

function dispatchArrival(
  notice: TeamArrivalNotice,
  arrival: TeamArrival,
  params: Params,
): Promise<unknown> {
  const workspace = orgWorkspace(notice.team.hostCompanyId);
  return dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.NETWORK_TEAM_JOINED,
    recipientId: arrival.uid,
    tenantId: workspaceTenantId(workspace),
    ...arrivalDispatchDestination(notice, workspace),
    title: ARRIVAL_SUBJECTS[arrival.kind](params),
    titleKey: ARRIVAL_TITLE_KEYS[arrival.kind],
    titleParams: { ...params },
    // 🔑 Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ Η ΕΚΔΟΣΗ — μία αλλαγή ομάδας, μία ειδοποίηση ανά νεοεισερχόμενο.
    eventId: `network-team:${notice.team.id}:v${notice.team.version}`,
    entityId: notice.team.id,
    entityType: NOTIFICATION_ENTITY_TYPES.NETWORK_ACT_TEAM,
    source: { service: SOURCE_SERVICES.NETWORK, feature: 'team-joined', env: getCurrentEnvironment() },
  });
}

/**
 * **Λέει «σου ανατέθηκε» σε όποιον μπήκε** — ανάθεση, **μεταβίβαση στην αποχώρηση** (το email του
 * Microsoft 365 στον manager: ο κληρονόμος **μαθαίνει**, δεν ανακαλύπτει), προσθήκη. **Κανένα πέταγμα.**
 */
export async function announceTeamArrivals(adminDb: AdminFirestore, notice: TeamArrivalNotice): Promise<void> {
  if (notice.arrivals.length === 0) return;
  try {
    const [subject, previous] = await Promise.all([
      actSubjectLabel(adminDb, notice.team.actKind, notice.team.actSeed),
      notice.departingUid === undefined ? null : personLabelOf(notice.departingUid),
    ]);
    const params: Params = { subject: subject ?? notice.team.id, previous: previous ?? '' };
    await settle(notice.arrivals.map((arrival) => dispatchArrival(notice, arrival, params)), { teamId: notice.team.id });
  } catch (error) {
    logger.error('Οι ειδοποιήσεις εισόδου στην ομάδα δεν στάλθηκαν', {
      data: { teamId: notice.team.id },
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
