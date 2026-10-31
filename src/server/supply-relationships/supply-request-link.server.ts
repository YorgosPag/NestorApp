import 'server-only';

/**
 * **Πόρτα β: ο ανακλητός σύνδεσμος/QR του προμηθευτή** (ADR-923 §5.12 Σ2).
 *
 * Ο σύνδεσμος **δεν** είναι πρόσκληση: δεν απευθύνεται σε κανέναν και δεν καταναλώνεται, άρα δεν περνά από τη μηχανή
 * ADR-853. Παίρνει από τον κοινό πυρήνα την υπογραφή (`signed-token`) και την ανάγνωση αποτυχίας, και δίνει **μόνο το
 * δικαίωμα να ζητήσεις**. Τίποτα δεν ανοίγει χωρίς έγκριση του προμηθευτή.
 *
 * 🔑 Token = υπογεγραμμένο `[id, γενιά]`. Κανένα μυστικό στη βάση, και ίδιο κείμενο σε κάθε ανάγνωση: το QR ενός έντυπου
 *    καταλόγου είναι σταθερό, ενώ η ανάκληση ανεβάζει γενιά και σκοτώνει κάθε τυπωμένο αντίγραφο. Η επανενεργοποίηση
 *    δίνει **πάντα** νέα γενιά: ό,τι ανακλήθηκε δεν ξαναζωντανεύει.
 * @module server/supply-relationships/supply-request-link.server
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { decodeSignedToken, encodeSignedToken, requireTokenSecret } from '@/lib/tokens/signed-token';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { signalPricingViewsInTx } from '@/server/catalog/pricing-view-signal.server';
import { invitationRefusalOfToken } from '@/server/invitations/invitation-guards';
import { SUPPLY_REQUEST_LINK_TRACKED_FIELDS } from '@/config/audit-tracked-fields-catalog';
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
import { generateDeterministicSupplyRequestLinkId } from '@/services/enterprise-id.service';
import { revisionAfterWrite } from '@/subapps/catalog/aggregate/aggregate-members';
import { judgeAccessRequest } from '@/subapps/catalog/pricing/supply-relationship-judge';
import type { SupplyAccessPreview, SupplyBuyerRefusal, SupplyRequestLink } from '@/subapps/catalog/types/supply-invitation';
import type { InvitationCoreRefusal } from '@/types/invitation-core';

import { announceSupplyChange } from './supply-relationship-notifier.server';
import { resolveBuyerOffice, type SupplyBuyerActing } from './supply-buyer-office.server';
import { readSupplyRelationshipInTx, recordSupplyRelationshipChange, stageSupplyRelationship, supplyRelationshipId, type StagedSupplyChange } from './supply-relationship-store.server';

const logger = createModuleLogger('supply-request-link');

/** ⚠️ Δικό του μυστικό: η υπογραφή δεν ξέρει σε ποια πύλη ανήκει. Αλλαγή του ⇒ κάθε τυπωμένος σύνδεσμος λέει `link-foreign`. */
export const SUPPLY_REQUEST_LINK_SECRET_ENV = 'SUPPLY_REQUEST_LINK_SECRET';

const TOKEN_FIELD_COUNT = 2;

const links = (db: Firestore) => db.collection(COLLECTIONS.SUPPLY_REQUEST_LINKS);

function linkFromDocument(data: unknown): SupplyRequestLink | null {
  const link = data as Partial<SupplyRequestLink> | undefined;
  const readable = typeof link?.companyId === 'string' && Number.isInteger(link.generation) && (link.state === 'live' || link.state === 'revoked');
  return readable ? (link as SupplyRequestLink) : null;
}

const tokenOf = (link: SupplyRequestLink): string =>
  encodeSignedToken(requireTokenSecret(SUPPLY_REQUEST_LINK_SECRET_ENV), [link.id, String(link.generation)]);

/** Ό,τι δείχνει η οθόνη του προμηθευτή: το token **μόνο** όσο ο σύνδεσμος ζει. */
export interface SupplyRequestLinkView {
  readonly state: SupplyRequestLink['state'] | 'none';
  readonly token: string | null;
}

export const supplyRequestLinkViewOf = (link: SupplyRequestLink | null): SupplyRequestLinkView =>
  (link === null ? { state: 'none', token: null } : { state: link.state, token: link.state === 'live' ? tokenOf(link) : null });

export async function readSupplyRequestLinkInTx(tx: Transaction, db: Firestore, companyId: string): Promise<SupplyRequestLink | null> {
  return linkFromDocument((await tx.get(links(db).doc(generateDeterministicSupplyRequestLinkId(companyId)))).data());
}

type LinkAct = 'publish' | 'revoke';

/** Δημοσίευση ή ανανέωση (νέα γενιά) · ανάκληση (ιδεμποτής). Κάθε δημοσίευση ακυρώνει ό,τι είχε τυπωθεί. */
function nextLink(current: SupplyRequestLink | null, act: LinkAct, ctx: AuthContext, now: string): SupplyRequestLink | null {
  if (act === 'revoke' && current?.state !== 'live') return null;
  const envelope = { revision: revisionAfterWrite(current?.revision ?? 0), updatedAt: now, updatedBy: ctx.uid };
  if (act === 'revoke' && current !== null) return { ...current, ...envelope, state: 'revoked' };
  return {
    id: generateDeterministicSupplyRequestLinkId(ctx.companyId),
    companyId: ctx.companyId,
    generation: (current?.generation ?? 0) + 1,
    state: 'live',
    createdAt: current?.createdAt ?? now,
    ...envelope,
  };
}

async function changeLink(ctx: AuthContext, act: LinkAct): Promise<SupplyRequestLinkView> {
  const db = getAdminFirestore();
  const [before, after] = await db.runTransaction(async (tx) => {
    const current = await readSupplyRequestLinkInTx(tx, db, ctx.companyId);
    const next = nextLink(current, act, ctx, nowISO());
    if (next === null) return [current, current] as const;
    tx.set(links(db).doc(next.id), next);
    signalPricingViewsInTx(tx, db, ctx.companyId, [{ kind: 'supply' }]);
    return [current, next] as const;
  });
  if (after !== null && after !== before) {
    await recordTrackedEntityWrite({
      entityType: 'supply_request_link',
      entityId: after.id,
      entityName: null,
      trackedFields: SUPPLY_REQUEST_LINK_TRACKED_FIELDS,
      before: before === null ? null : { ...before },
      after: { ...after },
      performedBy: ctx.uid,
      ledger: { companyId: ctx.companyId },
    });
  }
  return supplyRequestLinkViewOf(after);
}

export const publishSupplyRequestLink = (ctx: AuthContext): Promise<SupplyRequestLinkView> => changeLink(ctx, 'publish');
export const revokeSupplyRequestLink = (ctx: AuthContext): Promise<SupplyRequestLinkView> => changeLink(ctx, 'revoke');

type LinkByToken =
  | { readonly kind: 'read'; readonly id: string; readonly generation: number }
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal }
  | { readonly kind: 'unavailable' };

/** Υπογραφή **πριν** από κάθε ανάγνωση: πλαστός σύνδεσμος δεν μας κοστίζει ούτε ένα αίτημα Firestore. */
function readToken(token: string): LinkByToken {
  let secret: string;
  try {
    secret = requireTokenSecret(SUPPLY_REQUEST_LINK_SECRET_ENV);
  } catch {
    logger.error('Λείπει το μυστικό των συνδέσμων προμήθειας');
    return { kind: 'unavailable' };
  }
  const verdict = decodeSignedToken(secret, token, TOKEN_FIELD_COUNT);
  if (!verdict.ok) return { kind: 'refused', reason: invitationRefusalOfToken(verdict.reason) };
  const [id, generation] = verdict.fields;
  const parsed = Number(generation);
  return verdict.fields.length === TOKEN_FIELD_COUNT && Number.isInteger(parsed) ? { kind: 'read', id, generation: parsed } : { kind: 'refused', reason: 'link-invalid' };
}

/** Ο σύνδεσμος ζει, και σε **αυτή** τη γενιά; Ανακλημένος και παλιάς γενιάς: ίδια απάντηση. */
const isLive = (link: SupplyRequestLink | null, generation: number): link is SupplyRequestLink =>
  link !== null && link.state === 'live' && link.generation === generation;

export type SupplyRequestPreviewOutcome =
  | { readonly kind: 'preview'; readonly preview: SupplyAccessPreview }
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal }
  | { readonly kind: 'unavailable' };

/** Η όψη, χωρίς ταυτότητα: ποιος προμηθευτής. */
export async function previewSupplyRequestLink(db: Firestore, token: string): Promise<SupplyRequestPreviewOutcome> {
  const read = readToken(token);
  if (read.kind !== 'read') return read;
  const link = linkFromDocument((await links(db).doc(read.id).get()).data());
  if (!isLive(link, read.generation)) return { kind: 'refused', reason: 'revoked' };
  const name = (await readWorkspaceName(link.companyId).catch(() => '')).trim();
  return { kind: 'preview', preview: { supplierName: name === '' ? null : name } };
}

export type SupplyAccessRequestOutcome =
  /** Το ίδιο αίτημα δύο φορές δίνει την ίδια απάντηση. */
  | { readonly kind: 'requested' }
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal | SupplyBuyerRefusal }
  | { readonly kind: 'unavailable' };

interface SupplyAccessRequest {
  readonly token: string;
  readonly customerRef: string | null;
  readonly acting: SupplyBuyerActing;
}

type TxVerdict = {
  readonly outcome: SupplyAccessRequestOutcome;
  readonly change: StagedSupplyChange | null;
  /** Ποιος δημοσίευσε τον σύνδεσμο: αυτός μαθαίνει ότι ήρθε αίτημα. */
  readonly publisherUid?: string;
};

async function requestInTx(db: Firestore, tx: Transaction, read: { readonly id: string; readonly generation: number }, buyerCompanyId: string, input: SupplyAccessRequest): Promise<TxVerdict> {
  const link = linkFromDocument((await tx.get(links(db).doc(read.id))).data());
  if (!isLive(link, read.generation)) return { outcome: { kind: 'refused', reason: 'revoked' }, change: null };
  if (link.companyId === buyerCompanyId) return { outcome: { kind: 'refused', reason: 'same-workspace' }, change: null };
  const ends = { supplierCompanyId: link.companyId, buyerCompanyId };
  const current = await readSupplyRelationshipInTx(tx, db, supplyRelationshipId(ends));
  const act = { uid: input.acting.uid, now: nowISO() };
  const transition = judgeAccessRequest(current, { ends, customerRef: input.customerRef, act });
  if (transition.kind === 'refused') return { outcome: transition, change: null };
  const change = transition.kind === 'write' ? stageSupplyRelationship(tx, db, { before: current, next: transition.next, ...act }) : null;
  return { outcome: { kind: 'requested' }, change, publisherUid: link.updatedBy };
}

/** Το αίτημα του αγοραστή. Ο σύνδεσμος ξαναρωτιέται **μέσα** στη συναλλαγή: η ανάκληση κερδίζει κάθε αγώνα. */
export async function requestSupplyAccess(db: Firestore, input: SupplyAccessRequest): Promise<SupplyAccessRequestOutcome> {
  const read = readToken(input.token);
  if (read.kind !== 'read') return read;
  const office = await resolveBuyerOffice(input.acting);
  if (office.kind === 'unknown') return { kind: 'unavailable' };
  if (office.kind === 'refused') return office;
  const { outcome, change, publisherUid } = await db.runTransaction((tx) => requestInTx(db, tx, read, office.companyId, input));
  if (change === null) return outcome;
  await recordSupplyRelationshipChange(change, input.acting.uid);
  // Αλλαγή αριθμού πελάτη σε αίτημα που ήδη περιμένει δεν είναι νέο αίτημα.
  if (publisherUid && change.before?.state !== 'requested') await announceSupplyChange(change.after, 'requested', publisherUid);
  return outcome;
}
