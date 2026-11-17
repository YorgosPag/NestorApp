import 'server-only';

/**
 * @fileoverview **ΤΟ ΜΗΤΡΩΟ ΠΡΟΣΑΡΜΟΓΕΩΝ «Ζήτησε έγγραφο»** — ένας προσαρμογέας ανά είδος υπόθεσης, ολικός πίνακας (ADR-942 Δ1).
 * @related engagement-hosts.ts (το ίδιο σχήμα για τους οικοδεσπότες) · request-pipeline.server.ts (η ΜΙΑ ροή)
 * @module server/document-requests/request-adapters
 *
 * 🔑 Τρίτο είδος υπόθεσης **δεν μεταγλωττίζεται** μέχρι να δηλώσει εδώ πώς ζητά έγγραφα ο επαγγελματίας του. Η πόρτα
 *    `api/engagements/[id]/document-requests` ρωτά **μόνο** αυτό το αρχείο — καμία διακλάδωση «αν είναι μεταβίβαση…».
 * 🔑 Η μεταβίβαση περνά **αυτούσια** (`resolveEngagedCase` + `requestCaseDocuments`): η μηχανή της δεν αλλάζει.
 * ⚠️ **Συνάρτηση, όχι σταθερά module** (CHECK 3.80) — ίδια στάση με το `engagementHosts()`.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { listEngagementsOfUser } from '@/lib/auth/engagement-read';
import { requestCaseDocuments, type RequestDocumentsOutcome } from '@/services/conveyance/conveyance-document-request.service';
import { resolveEngagedCase, type EngagedCaseResolution } from '@/services/conveyance/conveyance-engagement-access.service';
import { requestIssuanceDocuments, type IssuanceRequestResult } from '@/services/document-registry/issuance-document-request.service';
import {
  isConveyanceEngagement,
  isDossierEngagement,
  isIssuanceEngagement,
  type Engagement,
  type EngagementSubjectKind,
} from '@/types/engagement';

/** Ό,τι απαντά η πόρτα του επαγγελματία — η ένωση των ειδών (ίδιο λεξιλόγιο, ίδιοι κωδικοί HTTP). */
export type EngagedDocumentRequestOutcome =
  | RequestDocumentsOutcome
  | Extract<EngagedCaseResolution, { ok: false }>
  | IssuanceRequestResult;

export interface EngagedRequestInput {
  readonly uid: string;
  readonly engagementId: string;
  readonly itemIds: readonly string[];
  readonly nowMs: number;
}

type EngagementOf<K extends EngagementSubjectKind> = Extract<Engagement, { readonly subject: { readonly kind: K } }>;
type EngagedRequester<K extends EngagementSubjectKind> = (db: Firestore, engagement: EngagementOf<K>, input: EngagedRequestInput) => Promise<EngagedDocumentRequestOutcome>;

/** Μεταβίβαση: ακριβώς η διαδρομή πριν το ADR-942 Φ1 (η υπόθεση ξαναλύνεται από τη δική της πόρτα πρόσβασης). */
async function requestAsConveyance(db: Firestore, _engagement: EngagementOf<'conveyance_case'>, input: EngagedRequestInput): Promise<EngagedDocumentRequestOutcome> {
  const resolution = await resolveEngagedCase(db, input.uid, input.engagementId, input.nowMs);
  if (!resolution.ok) return resolution;
  const { engagement, record, context } = resolution.access;
  return requestCaseDocuments(db, { requester: { kind: 'engaged', engagement }, record, context, itemIds: input.itemIds, nowMs: input.nowMs });
}

function requestAsIssuer(db: Firestore, engagement: EngagementOf<'document_issuance'>, input: EngagedRequestInput): Promise<EngagedDocumentRequestOutcome> {
  return requestIssuanceDocuments(db, { engagement, uid: input.uid, itemIds: input.itemIds, nowMs: input.nowMs });
}

/**
 * ADR-916 Φ-Ε1 — **δηλωμένο όριο, όχι stub**: στον φάκελο ιδιώτη ο επαγγελματίας **βλέπει** ό,τι του δόθηκε· δεν ζητά
 * έγγραφα από τον κάτοχο (δεν υπάρχει ακόμη κατάλογος ζητούμενων για φάκελο). Η πόρτα απαντά «δεν υπάρχει» (404),
 * όπως για συμμετοχή που δεν έχει αυτή τη δυνατότητα — ποτέ σιωπηλή «επιτυχία».
 */
async function requestAsDossierProfessional(): Promise<EngagedDocumentRequestOutcome> {
  return { ok: false, rejection: 'not-found' };
}

/** Ολικός: κάθε είδος υπόθεσης δηλώνει πώς ζητά έγγραφα ο επαγγελματίας του. */
function requestAdapters(): { readonly [K in EngagementSubjectKind]: EngagedRequester<K> } {
  return { conveyance_case: requestAsConveyance, document_issuance: requestAsIssuer, property_dossier: requestAsDossierProfessional };
}

/** Ο επαγγελματίας ζητά έγγραφα **μέσω της δικής του** συμμετοχής — δρομολόγηση από το είδος της, ποτέ από το αίτημα. */
export async function requestDocumentsAsEngaged(db: Firestore, input: EngagedRequestInput): Promise<EngagedDocumentRequestOutcome> {
  const list = await listEngagementsOfUser(db, input.uid);
  if (list.outcome === 'unknown') return { ok: false, rejection: 'unknown' };
  const engagement = list.engagements.find((e) => e.id === input.engagementId);
  if (engagement === undefined) return { ok: false, rejection: 'not-found' };
  const adapters = requestAdapters();
  if (isIssuanceEngagement(engagement)) return adapters.document_issuance(db, engagement, input);
  if (isDossierEngagement(engagement)) return adapters.property_dossier(db, engagement, input);
  if (isConveyanceEngagement(engagement)) return adapters.conveyance_case(db, engagement, input);
  return { ok: false, rejection: 'not-found' };
}
