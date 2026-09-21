/**
 * @fileoverview **ΤΑ ΚΛΕΙΔΙΑ ΤΗΣ ΟΘΟΝΗΣ ΤΟΥ ΝΗΜΑΤΟΣ** — ένας πίνακας, ορατός στον γεννήτορα των slices.
 * @related ADR-867 Β7 · N.11 · ADR-744 / ADR-777 §8.39 (πίνακες κλειδιών) · CHECK 3.8 · 3.34
 * @module components/network-messaging/network-messaging-keys
 *
 * 🔴 **ΠΟΤΕ ``t(`…${role}`)``**: ένα δυναμικό κλειδί είναι **αόρατο** στον γεννήτορα των route slices, που
 * **αρνείται** να εκπέμψει όσο υπάρχει ανεπίλυτη κλήση — και στο SSR θα ζωγραφιζόταν ωμό κλειδί (CHECK 3.51).
 * Κάθε κλειστό σύνολο (ρόλος · λόγος · άρνηση) έχει εδώ **πίνακα** πάνω στο κλειστό του σύνολο: νέα τιμή
 * χωρίς γραμμή **δεν μεταγλωττίζεται**, και ο γεννήτορας διαβάζει το `TABLE[x]` ως «όλα τα φύλλα».
 */

import type { NetworkFailure } from '@/services/network-messaging/network-thread.client';
import type {
  NetworkAudienceReason,
  NetworkAudienceRole,
  NetworkAudienceSide,
  NetworkHostRole,
} from '@/types/network-thread';

export const NETWORK_NS = 'network-messaging';
const K = 'network-messaging:';

export const THREAD_KEYS = {
  withAgency: `${K}thread.withAgency`,
  withAgencyUnnamed: `${K}thread.withAgencyUnnamed`,
  withOwner: `${K}thread.withOwner`,
  externalNotice: `${K}thread.externalNotice`,
  personalNotice: `${K}thread.personalNotice`,
  loading: `${K}thread.loading`,
  absent: `${K}thread.absent`,
  absentHint: `${K}thread.absentHint`,
  absentOfficeHint: `${K}thread.absentOfficeHint`,
  failed: `${K}thread.failed`,
  closed: `${K}thread.closed`,
  empty: `${K}thread.empty`,
  emptyLabel: `${K}thread.emptyLabel`,
  messagesLabel: `${K}thread.messagesLabel`,
  loadEarlier: `${K}thread.loadEarlier`,
  paginationLabel: `${K}thread.paginationLabel`,
  newMessages: `${K}thread.newMessages`,
  today: `${K}thread.today`,
  yesterday: `${K}thread.yesterday`,
} as const;

export const MESSAGE_KEYS = {
  you: `${K}message.you`,
  edited: `${K}message.edited`,
  editedAfterRead: `${K}message.editedAfterRead`,
  editedAt: `${K}message.editedAt`,
  retractedRead: `${K}message.retractedRead`,
  retractedUnread: `${K}message.retractedUnread`,
  retractedUnknown: `${K}message.retractedUnknown`,
  sending: `${K}message.sending`,
  failed: `${K}message.failed`,
  retry: `${K}message.retry`,
  discard: `${K}message.discard`,
  actions: `${K}message.actions`,
  edit: `${K}message.edit`,
  retract: `${K}message.retract`,
  retractWindow: `${K}message.retractWindow`,
  retractConfirmTitle: `${K}message.retractConfirmTitle`,
  retractConfirmBody: `${K}message.retractConfirmBody`,
  retractConfirm: `${K}message.retractConfirm`,
  cancel: `${K}message.cancel`,
  retractDoneRead: `${K}message.retractDoneRead`,
  retractDoneUnread: `${K}message.retractDoneUnread`,
  editLabel: `${K}message.editLabel`,
  editSave: `${K}message.editSave`,
  editNotice: `${K}message.editNotice`,
  editDoneAfterRead: `${K}message.editDoneAfterRead`,
} as const;

/** Όνομα που λείπει ⇒ ο **ρόλος**, ποτέ `uid`. */
export const FALLBACK_NAME_KEYS: { readonly [R in NetworkAudienceRole]: string } = {
  responsible: `${K}message.fallbackName.responsible`,
  collaborator: `${K}message.fallbackName.collaborator`,
  counterpart: `${K}message.fallbackName.counterpart`,
  person: `${K}message.fallbackName.person`,
};

export const COMPOSER_KEYS = {
  label: `${K}composer.label`,
  placeholder: `${K}composer.placeholder`,
  send: `${K}composer.send`,
  hint: `${K}composer.hint`,
  counter: `${K}composer.counter`,
  tooLong: `${K}composer.tooLong`,
} as const;

export const ROSTER_KEYS = {
  title: `${K}roster.title`,
  theirs: `${K}roster.theirs`,
  mine: `${K}roster.mine`,
  you: `${K}roster.you`,
  since: `${K}roster.since`,
  until: `${K}roster.until`,
  past: `${K}roster.past`,
  personal: `${K}roster.personal`,
  mirror: `${K}roster.mirror`,
  solo: `${K}roster.solo`,
} as const;

/** ADR-867 Β9 — η **δεύτερη** ιδιότητα του ιδιοκτήτη που είναι και μέλος του γραφείου (NAR Άρθρο 4). */
export const ALSO_HOST_KEYS: { readonly [R in NetworkHostRole]: string } = {
  responsible: `${K}roster.alsoHost.responsible`,
  collaborator: `${K}roster.alsoHost.collaborator`,
};

export const ROLE_KEYS: { readonly [R in NetworkAudienceRole]: string } = {
  responsible: `${K}roster.role.responsible`,
  collaborator: `${K}roster.role.collaborator`,
  counterpart: `${K}roster.role.counterpart`,
  person: `${K}roster.role.person`,
};

export const REASON_KEYS: { readonly [R in NetworkAudienceReason]: string } = {
  creator: `${K}roster.reason.creator`,
  assigned: `${K}roster.reason.assigned`,
  added: `${K}roster.reason.added`,
  failover: `${K}roster.reason.failover`,
  'admin-self': `${K}roster.reason.admin-self`,
  counterpart: `${K}roster.reason.counterpart`,
  relationship: `${K}roster.reason.relationship`,
};

export const AWAY_KEYS = {
  absent: `${K}away.absent`,
  covering: `${K}away.covering`,
  nobody: `${K}away.nobody`,
  you: `${K}away.you`,
  mineTitle: `${K}away.mine.title`,
  mineNone: `${K}away.mine.none`,
  mineActive: `${K}away.mine.active`,
  mineScheduled: `${K}away.mine.scheduled`,
  mineSet: `${K}away.mine.set`,
  mineEnd: `${K}away.mine.end`,
  mineFrom: `${K}away.mine.from`,
  mineTo: `${K}away.mine.to`,
  mineSave: `${K}away.mine.save`,
  mineHint: `${K}away.mine.hint`,
  mineInvalid: `${K}away.mine.invalid`,
} as const;

export const SEAT_KEYS = {
  mute: `${K}seat.mute`,
  muteHint: `${K}seat.muteHint`,
  follow: `${K}seat.follow`,
  followHint: `${K}seat.followHint`,
} as const;

export const TEAM_KEYS = {
  title: `${K}team.title`,
  visibleNotice: `${K}team.visibleNotice`,
  responsible: `${K}team.responsible`,
  collaborators: `${K}team.collaborators`,
  none: `${K}team.none`,
  assign: `${K}team.assign`,
  add: `${K}team.add`,
  remove: `${K}team.remove`,
  choose: `${K}team.choose`,
  addSelfNotice: `${K}team.addSelfNotice`,
  loading: `${K}team.loading`,
  applied: `${K}team.outcome.applied`,
  unchanged: `${K}team.outcome.unchanged`,
  conflict: `${K}team.outcome.conflict`,
} as const;

/** Κάθε αποτυχία (κλειστό σύνολο του client) ⇒ ανθρώπινο κείμενο. Νέος κωδικός χωρίς γραμμή ⇒ δεν μεταγλωττίζεται. */
export const FAILURE_KEYS: { readonly [F in NetworkFailure]: string } = {
  'thread-absent': `${K}failure.thread-absent`,
  'not-audience': `${K}failure.not-audience`,
  'team-absent': `${K}failure.team-absent`,
  'message-absent': `${K}failure.message-absent`,
  'thread-closed': `${K}failure.thread-closed`,
  'already-retracted': `${K}failure.already-retracted`,
  'stale-version': `${K}failure.stale-version`,
  'window-expired': `${K}failure.window-expired`,
  'not-sender': `${K}failure.not-sender`,
  'not-permitted': `${K}failure.not-permitted`,
  'empty-text': `${K}failure.empty-text`,
  'too-long': `${K}failure.too-long`,
  'target-not-in-workspace': `${K}failure.target-not-in-workspace`,
  'target-is-counterpart': `${K}failure.target-is-counterpart`,
  'responsible-not-removable': `${K}failure.responsible-not-removable`,
  'invalid-request': `${K}failure.invalid-request`,
  'internal-error': `${K}failure.internal-error`,
  unreachable: `${K}failure.unreachable`,
};

/**
 * **Ο ΚΑΤΑΛΟΓΟΣ «ΤΑ ΜΗΝΥΜΑΤΑ ΜΟΥ»** (ADR-867 Β9β).
 *
 * ⚠️ Ο **ρόλος** και η **δεύτερη ιδιότητα** της γραμμής διαβάζονται από τα `ROLE_KEYS`/`ALSO_HOST_KEYS`
 * παραπάνω — **όχι** από δικά τους αντίγραφα εδώ. Μία λέξη για τον «υπεύθυνο», όπου κι αν φαίνεται.
 */
export const DIRECTORY_KEYS = {
  title: `${K}directory.title`,
  subtitle: `${K}directory.subtitle`,
  loading: `${K}directory.loading`,
  empty: `${K}directory.empty`,
  emptyHint: `${K}directory.emptyHint`,
  listLabel: `${K}directory.listLabel`,
  loadMore: `${K}directory.loadMore`,
  unread: `${K}directory.unread`,
  muted: `${K}directory.muted`,
  retry: `${K}directory.retry`,
} as const;

/**
 * **ΠΩΣ ΛΕΓΕΤΑΙ ΜΙΑ ΓΡΑΜΜΗ ΤΟΥ ΚΑΤΑΛΟΓΟΥ** — από την **πλευρά** μου, όχι από το όνομα του άλλου.
 *
 * 🔑 **Γιατί η πλευρά και όχι το όνομα**: το όνομα του γραφείου ζει στη διαδρομή `…/people`, **ανά
 * νήμα**. Μια λίστα 30 γραμμών θα έκανε 30 κλήσεις για έναν τίτλο — το κλασικό N+1. Η `side`
 * ταξιδεύει **ήδη** μέσα στη γραμμή και απαντά το ίδιο ερώτημα που απαντά το `variant` της
 * ανοιχτής οθόνης. 📌 Δηλωμένο όριο: η γραμμή λέει «με το γραφείο», όχι «με το γραφείο Χ».
 *
 * ⚠️ Το `person` **δεν είναι μελλοντικό**: είναι το νήμα σχέσης του Β8. Ο πίνακας το έχει **από
 * τώρα**, ώστε το Β8 να μη χρειαστεί να αγγίξει τον κατάλογο.
 */
export const DIRECTORY_TITLE_KEYS: { readonly [S in NetworkAudienceSide]: string } = {
  host: THREAD_KEYS.withOwner,
  counterpart: THREAD_KEYS.withAgencyUnnamed,
  person: `${K}directory.withPerson`,
};
