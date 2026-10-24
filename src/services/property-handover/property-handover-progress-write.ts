import 'server-only';

/**
 * @fileoverview **ΟΙ ΓΡΑΦΕΣ ΠΡΟΟΔΟΥ ΤΗΣ ΠΑΡΑΔΟΣΗΣ** — CAS πάνω σε μία παράδοση, από τις μηχανές που τρέχουν **μετά** τη
 *   συμφιλίωση: έκβαση email πρόσκλησης · πρόοδος αντιγραφής · δείκτης Πρωτοκόλλου · έκβαση ειδοποίησης ανάκλησης
 *   (ADR-916 Φ-Β · Φ-Γ1 · Φ-Γ2 Σ4 · Φ-Δ.5).
 * @related property-handover-write.service.ts (ο γραφέας της συμφιλίωσης — κύκλος ζωής, πρόσκληση, ανάκληση, ίχνος)
 * @module services/property-handover/property-handover-progress-write
 *
 * Εξήχθη από τον γραφέα (N.7.1 — 468/500 γραμμές) **πριν** μπει η ανάκληση (Φ-Δ.5), **χωρίς** αλλαγή συμπεριφοράς.
 * 🔑 **Κοινό σχήμα**: κάθε γραφή ξαναδιαβάζει την παράδοση **μέσα** σε συναλλαγή και γράφει **μόνο** αν ισχύει ακόμη η
 *    υπόθεση του καλούντα (ίδια πρόσκληση · ίδιος παραλήπτης · ίδιο αποτύπωμα · ακόμη οφείλεται) — μια ανάκληση, μια
 *    αλλαγή χεριών ή μια νεότερη έκδοση στο μεταξύ **δεν** κληρονομεί πρόοδο που δεν της ανήκει.
 * 📜 **Κανένα ίχνος οντότητας εδώ** — τεχνική τηλεμετρία, όχι πράξη ανθρώπου (τα παρακολουθούμενα πεδία τα γράφει ο
 *    γραφέας της συμφιλίωσης)· εξαίρεση ο δείκτης Πρωτοκόλλου, του οποίου το ίχνος γράφει ο καλών με το `write` που παίρνει.
 */

import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { fileDeliveryStateOf } from '@/lib/property-handover/handover-delivery-plan';
import type { PropertyHandoverWrite } from '@/lib/property-handover/handover-plan';
import { withdrawalNoticeDueOf } from '@/lib/property-handover/handover-withdrawal-plan';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { stagePropertyDossierHandoverProjection } from '@/services/property-dossier/property-dossier-write.service';
import type {
  PropertyHandover,
  PropertyHandoverFileDelivery,
  PropertyHandoverInvitationDelivery,
  PropertyHandoverWithdrawalNoticeDelivery,
} from '@/types/property-handover';
import type { PropertyHandoverProtocolPointer } from '@/types/property-handover-protocol';

export function handoverDocRef(adminDb: AdminFirestore, handoverId: string) {
  return adminDb.collection(COLLECTIONS.PROPERTY_HANDOVERS).doc(handoverId);
}

/**
 * **Το παράγωγο της ειδοποίησης ανάκλησης** (Φ-Δ.5) — υπάρχει **μόνο** για το ερώτημα ισότητας του διχτυού, όπως το
 * `fileDeliveryState`· ποτέ χειρόγραφο, άρα δεν μπορεί να διαφωνήσει με την παράδοση.
 */
export function withdrawalNoticeStateOf(handover: Pick<PropertyHandover, 'lifecycle' | 'withdrawal'>): 'due' | null {
  return withdrawalNoticeDueOf(handover) ? 'due' : null;
}

type HandoverRef = ReturnType<typeof handoverDocRef>;

/**
 * **Το ΕΝΑ σχήμα CAS**: η παράδοση ξαναδιαβάζεται **μέσα** στη συναλλαγή και το σώμα αποφασίζει αν ισχύει ακόμη η υπόθεση
 * του καλούντα. Έγγραφο που δεν είναι παράδοση ⇒ καμία γραφή.
 */
function withHandoverInTransaction(
  adminDb: AdminFirestore,
  handoverId: string,
  body: (tx: Transaction, current: PropertyHandover, ref: HandoverRef) => Promise<void> | void,
): Promise<void> {
  const ref = handoverDocRef(adminDb, handoverId);
  return adminDb.runTransaction(async (tx) => {
    const current = propertyHandoverFromDocument((await tx.get(ref)).data(), ref.id);
    if (current !== null) await body(tx, current, ref);
  });
}

/**
 * **Η έκβαση ενός email πρόσκλησης στο κάτοπτρο** — CAS: γράφει **μόνο** αν η παράδοση δείχνει ακόμη **αυτή** την
 * πρόσκληση (μια νεότερη έκδοση στο μεταξύ δεν κληρονομεί την έκβαση της παλιάς).
 */
export async function recordHandoverInvitationDelivery(
  adminDb: AdminFirestore,
  input: { readonly handoverId: string; readonly invitationId: string; readonly delivery: PropertyHandoverInvitationDelivery; readonly reminded: boolean },
): Promise<void> {
  await withHandoverInTransaction(adminDb, input.handoverId, (tx, current, ref) => {
    const link = current.invitation;
    if (link === null || link.status !== 'issued' || link.invitationId !== input.invitationId) return;
    const now = nowISO();
    tx.update(ref, {
      'invitation.delivery': input.delivery,
      'invitation.deliveryAttempts': link.deliveryAttempts + 1,
      ...(input.reminded && input.delivery === 'accepted' ? { 'invitation.remindedAt': now } : {}),
      updatedAt: now,
    });
  });
}

/**
 * **Φ-Γ1 — η πρόοδος της αντιγραφής**, στην παράδοση **και** (προβολή, Δ10) στον κύριο φάκελο του αγοραστή, ατομικά.
 * CAS: γράφει **μόνο** αν η παράδοση οφείλει ακόμη αντιγραφή στον **ίδιο** παραλήπτη — μια ανάκληση (Φ-Δ.5) ή αλλαγή χεριών
 * στο μεταξύ δεν κληρονομεί πρόοδο που δεν της ανήκει.
 */
export async function recordHandoverFileDelivery(
  adminDb: AdminFirestore,
  input: { readonly handoverId: string; readonly recipientUserId: string; readonly fileDelivery: PropertyHandoverFileDelivery },
): Promise<void> {
  await withHandoverInTransaction(adminDb, input.handoverId, async (tx, current, ref) => {
    const recipient = current.recipient;
    if (recipient === null || fileDeliveryStateOf(current) === null || recipient.userId !== input.recipientUserId) return;
    const { state, delivered, total } = input.fileDelivery;
    const projection = await stagePropertyDossierHandoverProjection(tx, adminDb, {
      dossierId: recipient.dossierId, userId: recipient.userId, handoverId: current.id,
      handoverLifecycle: current.lifecycle, fileDelivery: { state, delivered, total },
    });
    const after: PropertyHandover = { ...current, fileDelivery: input.fileDelivery, updatedAt: nowISO() };
    tx.update(ref, { fileDelivery: after.fileDelivery, fileDeliveryState: fileDeliveryStateOf(after), updatedAt: after.updatedAt });
    projection.commit();
  });
}

/**
 * **Φ-Δ.5 — η έκβαση της ειδοποίησης ανάκλησης.** CAS: γράφει **μόνο** αν η ειδοποίηση **οφείλεται ακόμη** — δύο
 * ταυτόχρονες αποστολές (πράξη + δίχτυ) μετρούν δύο προσπάθειες, και μια `accepted` δεν ξαναγίνεται ποτέ `failed`.
 */
export async function recordHandoverWithdrawalNotice(
  adminDb: AdminFirestore,
  input: { readonly handoverId: string; readonly delivery: Exclude<PropertyHandoverWithdrawalNoticeDelivery, 'pending'> },
): Promise<void> {
  await withHandoverInTransaction(adminDb, input.handoverId, (tx, current, ref) => {
    const notice = current.withdrawal?.notice ?? null;
    if (current.withdrawal === null || notice === null || !withdrawalNoticeDueOf(current)) return;
    const after: PropertyHandover = {
      ...current,
      withdrawal: { ...current.withdrawal, notice: { delivery: input.delivery, attempts: notice.attempts + 1 } },
      updatedAt: nowISO(),
    };
    tx.update(ref, {
      'withdrawal.notice': after.withdrawal?.notice ?? null,
      withdrawalNoticeState: withdrawalNoticeStateOf(after),
      updatedAt: after.updatedAt,
    });
  });
}

/** Τι περιμένει ο γραφέας του Πρωτοκόλλου να βρει — και τι γράφει αν το βρει (Φ-Γ2 Σ4). */
export interface HandoverProtocolPointerWrite {
  readonly handoverId: string;
  readonly recipientUserId: string;
  /** Το αποτύπωμα που σφραγίστηκε — πρέπει να είναι **ακόμη** το αποτύπωμα της παράδοσης. */
  readonly ledgerDigest: string;
  /** Το πρωτόκολλο που αντικαθίσταται — `null` στην πρώτη αναθεώρηση. Άλλος δείκτης ⇒ κάποιος πρόλαβε. */
  readonly previousProtocolId: string | null;
  readonly pointer: PropertyHandoverProtocolPointer;
}

/** Η γραφή του δείκτη, ετοιμασμένη: ανάγνωση **έγινε**, γραφή στο `commit()` (το Firestore θέλει αναγνώσεις πρώτα). */
export interface HandoverProtocolPointerStage {
  readonly write: PropertyHandoverWrite & { readonly kind: 'update' };
  commit(): void;
}

/**
 * **Φ-Γ2 Σ4 — ο δείκτης στο τελευταίο Πρωτόκολλο**, στην παράδοση **και** (προβολή, Δ10) στον κύριο φάκελο του αγοραστή,
 * μέσα στη συναλλαγή του γραφέα του πρωτοκόλλου. **CAS**: `null` (καμία γραφή) αν η παράδοση **δεν** είναι πια
 * `delivered` με **το ίδιο** αποτύπωμα, στον **ίδιο** παραλήπτη, με **τον ίδιο** προηγούμενο δείκτη — μια συμπλήρωση, μια
 * ανάκληση ή μια ταυτόχρονη έκδοση στο μεταξύ **δεν** κληρονομεί πρωτόκολλο που δεν περιγράφει την αλήθεια της.
 */
export async function stageHandoverProtocolPointer(
  tx: Transaction,
  adminDb: AdminFirestore,
  input: HandoverProtocolPointerWrite,
): Promise<HandoverProtocolPointerStage | null> {
  const ref = handoverDocRef(adminDb, input.handoverId);
  const before = propertyHandoverFromDocument((await tx.get(ref)).data(), ref.id);
  const recipient = before?.recipient ?? null;
  const delivery = before?.fileDelivery ?? null;
  if (before === null || recipient === null || recipient.userId !== input.recipientUserId) return null;
  // Ακυρωμένη ή ανακλημένη (ή πια μη οφειλόμενη) παράδοση **δεν** παίρνει Πρωτόκολλο, όσο «delivered» κι αν έμεινε η πρόοδός της.
  if (fileDeliveryStateOf(before) === null) return null;
  if (delivery?.state !== 'delivered' || delivery.digest !== input.ledgerDigest) return null;
  if ((before.protocol?.protocolId ?? null) !== input.previousProtocolId) return null;
  const { revision, issuedAt, recipientFileId } = input.pointer;
  const projection = await stagePropertyDossierHandoverProjection(tx, adminDb, {
    dossierId: recipient.dossierId, userId: recipient.userId, handoverId: before.id, handoverLifecycle: before.lifecycle,
    protocol: { revision, issuedAt, fileId: recipientFileId },
  });
  const after: PropertyHandover = { ...before, protocol: input.pointer, updatedAt: nowISO() };
  return {
    write: { kind: 'update', before, after },
    commit: () => {
      tx.update(ref, { protocol: after.protocol, updatedAt: after.updatedAt });
      projection.commit();
    },
  };
}
