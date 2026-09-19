/**
 * @fileoverview **ΠΟΥ ΑΝΟΙΓΕΙ Η ΕΙΔΟΠΟΙΗΣΗ ΤΟΥ ΔΙΚΤΥΟΥ** — καθαρός πυρήνας, **μηδέν** I/O.
 * @related ADR-867 Β7 · §8 #9 · ADR-849 Β1 (προορισμός **με** χώρο) · Β2 (ανιχνευτής απόκλισης)
 * @module services/network-messaging/network-destination
 *
 * 🔑 **ΕΝΑΣ τόπος, ΔΥΟ καταναλωτές**: ο αποστολέας (`network-notifier.ts`) τον ρωτά όταν γράφει την
 * ειδοποίηση· ο ανιχνευτής (`notification-destination-rules.ts`) τον ρωτά όταν ελέγχει τι **θα** έγραφε
 * σήμερα. Δεύτερο αντίγραφο θα απέκλινε την ημέρα που μετακομίσει μια σελίδα (ADR-749).
 *
 * | Ποιος | Πού |
 * |---|---|
 * | γραφείο (`host`) | η **εντολή**, ανοιχτή στο νήμα — στον χώρο του **γραφείου** |
 * | ιδιοκτήτης (`counterpart`) | η **αγγελία του**, ανοιχτή στο νήμα με **αυτό** το γραφείο — στον **ιδιωτικό** του χώρο |
 * | νήμα σχέσης | **κανένας** ακόμη: δεν έχει οθόνη (Β8) — ένα «Άνοιγμα» προς το πουθενά θα ήταν ψέμα (ADR-848) |
 *
 * ⚠️ Ο πυρήνας **δεν ξέρει** τι είναι «εντολή» (ADR-867 §3): ρωτά το **αντικείμενο** της πράξης από το
 * μητρώο πηγών ακμής (`actSubjectOf`)· εδώ ζει **μόνο** «αντικείμενο → σελίδα» ανά πλευρά.
 */

import { mandateThreadHref } from '@/lib/mandate/mandate-routes';
import { actSubjectOf, type ActSubject } from '@/lib/network-edge/edge-sources';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { offerThreadHref } from '@/lib/owner-property/owner-property-routes';
import type { NetworkActKind, NetworkThreadTopic } from '@/types/network-thread';
import { orgWorkspace, personalWorkspace } from '@/types/workspace-membership';

/**
 * «Αντικείμενο → προορισμός» ανά πλευρά. Νέο είδος αντικειμένου χωρίς γραμμή ⇒ δεν μεταγλωττίζεται.
 * ⚠️ Το `viewDestination` καλείται **με τον βοηθό `…Href` απευθείας** (Κ2 της `notification-destination-custody`).
 */
const SURFACES: {
  readonly [K in ActSubject['kind']]: {
    readonly host: (subject: Extract<ActSubject, { kind: K }>, threadId: string, companyId: string) => NotificationDestination;
    readonly counterpart: (subject: Extract<ActSubject, { kind: K }>, threadId: string, uid: string) => NotificationDestination;
  };
} = {
  listing: {
    host: (subject, threadId, companyId) =>
      viewDestination(mandateThreadHref(subject.ownerPropertyId, threadId), orgWorkspace(companyId)),
    counterpart: (subject, threadId, uid) =>
      viewDestination(offerThreadHref(subject.ownerPropertyId, threadId), personalWorkspace(uid)),
  },
};

/** Ο προορισμός της πλευράς του **γραφείου** για μια πράξη — `null` αν ο σπόρος δεν διαβάζεται. */
export function actHostDestination(
  act: { readonly actKind: NetworkActKind; readonly actSeed: string; readonly hostCompanyId: string },
  threadId: string,
): NotificationDestination | null {
  const subject = actSubjectOf(act.actKind, act.actSeed);
  return subject === null ? null : SURFACES[subject.kind].host(subject, threadId, act.hostCompanyId);
}

/**
 * **Νέο μήνυμα → πού ανοίγει για ΑΥΤΟΝ τον παραλήπτη.** Η πλευρά κρίνεται από το **θέμα** του νήματος
 * (ο αντισυμβαλλόμενος είναι γραμμένος εκεί), ποτέ από τον ρόλο του παραλήπτη — ο ρόλος αλλάζει με την
 * ομάδα, η πλευρά όχι.
 */
export function threadMessageDestination(
  topic: NetworkThreadTopic,
  threadId: string,
  recipientUid: string,
): NotificationDestination | null {
  if (topic.kind !== 'act') return null;
  if (recipientUid !== topic.counterpartUid) return actHostDestination(topic, threadId);
  const subject = actSubjectOf(topic.actKind, topic.actSeed);
  return subject === null ? null : SURFACES[subject.kind].counterpart(subject, threadId, recipientUid);
}
