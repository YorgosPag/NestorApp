import 'server-only';

/**
 * @fileoverview ADR-942 Φ1 — η ενότητα «Έγγραφα για την έκδοση» μιας ανάθεσης: **τι** ζητείται, τι **έχει ήδη** ο φάκελος
 *   του κατόχου, **σε ποιον** θα πήγαινε κάθε αίτημα και **τι** ζητήθηκε — μία φορά, για τον μηχανικό **και** το γραφείο.
 * @related issuance-request-policy.ts (ο κριτής) · issuance-request-files.server.ts (το δοχείο) · request-core.ts (Α31)
 * @module services/document-registry/issuance-document-request-panel.server
 *
 * 🔑 Το «εκκρεμεί» **δεν** αποθηκεύεται: παράγεται από το ιστορικό + το νεότερο αρχείο (ADR-901 Α31).
 * 🔑 «Δεν ξέρω» ≠ «λείπουν όλα»: αποτυχία ανάγνωσης αρχείων ή αιτημάτων ⇒ `'unknown'`, ποτέ μισή λίστα που μοιάζει πλήρης.
 */

import type { Firestore } from 'firebase-admin/firestore';

import {
  ISSUANCE_REQUEST_TIERS_VERIFIED,
  issuanceRequestItemsOf,
} from '@/config/document-requests/issuance-request-catalog';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { issuanceRequestTargetOf } from '@/lib/document-requests/issuance-request-policy';
import { documentRequestViewsFor, type RequestParty } from '@/lib/document-requests/request-core';
import { issuanceStageOf, type IssuanceStage } from '@/lib/document-validity/issuance-stage';
import { readSubjectDocumentRequests } from '@/server/document-requests/document-request-store.server';
import { issuanceOfficeRecipients } from '@/server/issuance-invitations/issuance-office-recipients';
import type {
  IssuanceDocumentRequest,
  IssuanceDocumentRequests,
  IssuanceRequestItemView,
  IssuanceRequestRole,
} from '@/types/issuance-document-request';
import type { DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { issuanceRequestContainerOf, readIssuanceProvided, type IssuanceRequestContainer } from './issuance-request-files.server';

/** Ό,τι χρειάζονται και η όψη και ο γραφέας — διαβασμένο **μία** φορά ανά κλήση. */
export interface IssuanceRequestContext {
  readonly stage: IssuanceStage;
  /** `null` ⇒ το γραφείο δεν κατέχει πια το ακίνητο: τίποτα δεν ζητείται (κανένα αίτημα σε λάθος φάκελο). */
  readonly container: IssuanceRequestContainer | null;
  readonly items: readonly IssuanceRequestItemView[];
  readonly officeRecipients: readonly string[];
}

/** Ο κατάλογος του είδους + «το έχει ήδη;» από τον φάκελο του κατόχου. `'unknown'` ⇒ τα αρχεία δεν διαβάστηκαν. */
export async function issuanceRequestContextOf(db: Firestore, assignment: DocumentIssuanceAssignment): Promise<IssuanceRequestContext | 'unknown'> {
  const catalog = issuanceRequestItemsOf(assignment.documentKind);
  const container = catalog.length === 0 ? null : await issuanceRequestContainerOf(db, assignment);
  const provided = container === null ? {} : await readIssuanceProvided(db, container, catalog);
  if (provided === null) return 'unknown';
  return {
    stage: issuanceStageOf(assignment),
    container,
    items: catalog.map((item) => ({ itemId: item.itemId, tier: item.tier, providedAt: provided[item.itemId] ?? null })),
    officeRecipients: issuanceOfficeRecipients(assignment),
  };
}

/** Τα αιτήματα της ανάθεσης, ή `null` αν η ανάγνωση απέτυχε. */
export function readIssuanceRequests(db: Firestore, assignment: Pick<DocumentIssuanceAssignment, 'id' | 'companyId'>): Promise<IssuanceDocumentRequest[] | null> {
  return readSubjectDocumentRequests(db, { companyId: assignment.companyId, subject: { kind: 'document_issuance', id: assignment.id } });
}

/** «Σε ποιον θα πήγαινε» — μόνο για τον αιτούντα· ο οικοδεσπότης δεν ζητά στη Φ1 (είναι ο παραλήπτης). */
function targetsOf(context: IssuanceRequestContext, viewer: RequestParty<IssuanceRequestRole>): IssuanceDocumentRequests['targets'] {
  if (viewer.role === 'host' || context.container === null) return {};
  const hasOfficeRecipient = context.officeRecipients.some((uid) => uid !== viewer.uid);
  return Object.fromEntries(context.items.map((item) => [item.itemId, issuanceRequestTargetOf({ stage: context.stage, item, hasOfficeRecipient })]));
}

export interface IssuancePanelQuestion {
  readonly assignment: DocumentIssuanceAssignment;
  readonly viewer: RequestParty<IssuanceRequestRole>;
  readonly nowMs: number;
}

/** Η ενότητα από ό,τι διαβάστηκε — ίδια συναρμολόγηση για μηχανικό και γραφείο. */
function panelOf(context: IssuanceRequestContext, requests: readonly IssuanceDocumentRequest[], question: IssuancePanelQuestion): IssuanceDocumentRequests {
  return {
    today: conveyanceToday(new Date(question.nowMs)),
    targets: targetsOf(context, question.viewer),
    log: documentRequestViewsFor(requests, question.viewer),
    items: context.items,
    tiersVerified: ISSUANCE_REQUEST_TIERS_VERIFIED,
  };
}

/** Ενότητα + το δοχείο του κατόχου (εκεί ανεβάζει το γραφείο) — ή `null`/`'unknown'` όπως παρακάτω. */
export interface IssuanceRequestPanelWithContainer {
  readonly panel: IssuanceDocumentRequests;
  readonly container: IssuanceRequestContainer;
}

/**
 * Η ενότητα για **αυτόν** τον θεατή, μαζί με το δοχείο — `null` όταν το είδος δεν έχει κατάλογο ή το γραφείο δεν
 * κατέχει πια το ακίνητο (η ενότητα δεν εμφανίζεται)· `'unknown'` όταν κάτι δεν διαβάστηκε.
 */
export async function issuanceRequestPanelWithContainer(db: Firestore, question: IssuancePanelQuestion): Promise<IssuanceRequestPanelWithContainer | null | 'unknown'> {
  const [context, requests] = await Promise.all([
    issuanceRequestContextOf(db, question.assignment),
    readIssuanceRequests(db, question.assignment),
  ]);
  if (context === 'unknown' || requests === null) return 'unknown';
  if (context.container === null) return null;
  return { panel: panelOf(context, requests, question), container: context.container };
}

/** Μόνο η ενότητα — η όψη του μηχανικού (το δοχείο δεν τον αφορά: δεν ανεβάζει στον φάκελο του κατόχου). */
export async function issuanceDocumentRequestPanel(db: Firestore, question: IssuancePanelQuestion): Promise<IssuanceDocumentRequests | null | 'unknown'> {
  const result = await issuanceRequestPanelWithContainer(db, question);
  return result === null || result === 'unknown' ? result : result.panel;
}
