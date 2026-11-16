import 'server-only';

/**
 * @fileoverview ADR-942 Φ1 — η ενότητα «Έγγραφα για την έκδοση» μιας ανάθεσης: **τι** ζητείται, τι **έχει ήδη** ο φάκελος
 *   του κατόχου, **σε ποιον** θα πήγαινε κάθε αίτημα και **τι** ζητήθηκε — μία φορά, για τον μηχανικό **και** το γραφείο.
 * @related issuance-request-policy.ts (ο κριτής) · issuance-request-files.server.ts (το δοχείο) · request-core.ts (Α31)
 * @module services/document-registry/issuance-document-request-panel.server
 *
 * 🔑 Το «εκκρεμεί» **δεν** αποθηκεύεται: παράγεται από το ιστορικό + το νεότερο αρχείο (ADR-901 Α31).
 * 🔑 «Δεν ξέρω» ≠ «λείπουν όλα»: αποτυχία ανάγνωσης αρχείων ή αιτημάτων ⇒ `'unknown'`, ποτέ μισή λίστα που μοιάζει πλήρης.
 * 🔑 Φ2 — «δόθηκε» = ζωντανό δόσιμο **και** ζωντανό αρχείο στο σημερινό δοχείο (παράγεται, όπως η πόρτα ανοίγματος). Ο
 *    μηχανικός τα βλέπει **μόνο** με ανοιχτό παράθυρο (Ε4)· το μητρώο διαβάζεται **μόνο** όταν υπάρχει κάτι δοσμένο.
 */

import type { Firestore } from 'firebase-admin/firestore';

import {
  ISSUANCE_REQUEST_TIERS_VERIFIED,
  ISSUANCE_RETENTION_BASIS,
  issuanceRequestItemsOf,
} from '@/config/document-requests/issuance-request-catalog';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { isLiveProvision } from '@/lib/document-requests/document-provision-schema';
import { issuanceFileAccessWindow } from '@/lib/document-requests/issuance-file-access-window';
import { issuanceRequestTargetOf } from '@/lib/document-requests/issuance-request-policy';
import { documentRequestViewsFor, type RequestParty } from '@/lib/document-requests/request-core';
import { issuanceStageOf, type IssuanceStage } from '@/lib/document-validity/issuance-stage';
import { readSubjectProvisions } from '@/server/document-requests/document-provision-store.server';
import { readSubjectDocumentRequests } from '@/server/document-requests/document-request-store.server';
import { issuanceOfficeRecipients } from '@/server/issuance-invitations/issuance-office-recipients';
import type { StoredDocumentProvision } from '@/types/document-request';
import type {
  IssuanceDocumentRequest,
  IssuanceDocumentRequests,
  IssuanceFolderFile,
  IssuanceGivenFile,
  IssuanceRequestItemView,
  IssuanceRequestRole,
} from '@/types/issuance-document-request';
import type { DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { issuanceLatestIssuedOn } from './issuance-latest-issued.server';
import { issuanceRequestContainerOf, readIssuanceFolder, type IssuanceRequestContainer } from './issuance-request-files.server';

/** Ό,τι χρειάζονται και η όψη και ο γραφέας — διαβασμένο **μία** φορά ανά κλήση. */
export interface IssuanceRequestContext {
  readonly stage: IssuanceStage;
  /** `null` ⇒ το γραφείο δεν κατέχει πια το ακίνητο: τίποτα δεν ζητείται (κανένα αίτημα σε λάθος φάκελο). */
  readonly container: IssuanceRequestContainer | null;
  /** Ουδέτερα ως προς τον θεατή: `given`/`candidates` κενά — τα γεμίζει η ενότητα **ανά θεατή** (`panelOf`). */
  readonly items: readonly IssuanceRequestItemView[];
  /** Τα ζωντανά αρχεία του φακέλου ανά στοιχείο, νεότερο πρώτο. */
  readonly folder: Readonly<Record<string, readonly IssuanceFolderFile[]>>;
  readonly officeRecipients: readonly string[];
}

/** Ο κατάλογος του είδους + «το έχει ήδη;» από τον φάκελο του κατόχου. `'unknown'` ⇒ τα αρχεία δεν διαβάστηκαν. */
export async function issuanceRequestContextOf(db: Firestore, assignment: DocumentIssuanceAssignment): Promise<IssuanceRequestContext | 'unknown'> {
  const catalog = issuanceRequestItemsOf(assignment.documentKind);
  const container = catalog.length === 0 ? null : await issuanceRequestContainerOf(db, assignment);
  const folder = container === null ? {} : await readIssuanceFolder(db, container, catalog);
  if (folder === null) return 'unknown';
  return {
    stage: issuanceStageOf(assignment),
    container,
    items: catalog.map((item) => ({
      itemId: item.itemId,
      tier: item.tier,
      providedAt: folder[item.itemId]?.[0]?.createdAt ?? null,
      given: [],
      candidates: [],
    })),
    folder,
    officeRecipients: issuanceOfficeRecipients(assignment),
  };
}

/** Τα δοσμένα ενός στοιχείου: ζωντανό δόσιμο **και** ζωντανό αρχείο στον φάκελο (αλλιώς δεν υπάρχει τίποτα να ανοίξει). */
function givenFilesOf(folderFiles: readonly IssuanceFolderFile[], provisions: readonly StoredDocumentProvision[], itemId: string): IssuanceGivenFile[] {
  const byId = new Map(folderFiles.map((file) => [file.fileId, file]));
  return provisions.flatMap((provision) => {
    const file = provision.itemId === itemId && isLiveProvision(provision) ? byId.get(provision.fileId) : undefined;
    return file ? [{ provisionId: provision.id, fileId: file.fileId, fileName: file.fileName, givenAt: provision.givenAt, via: provision.via }] : [];
  });
}

/** Ποιος βλέπει τι (Φ2): το γραφείο όλα + υποψήφια · ο μηχανικός μόνο τα δοσμένα, και μόνο με ανοιχτό παράθυρο. */
interface ItemDisclosure {
  readonly host: boolean;
  readonly showGiven: boolean;
  readonly provisions: readonly StoredDocumentProvision[];
}

function disclosedItems(context: IssuanceRequestContext, disclosure: ItemDisclosure): IssuanceRequestItemView[] {
  return context.items.map((item) => {
    const folderFiles = context.folder[item.itemId] ?? [];
    const given = givenFilesOf(folderFiles, disclosure.provisions, item.itemId);
    const givenIds = new Set(given.map((file) => file.fileId));
    return {
      ...item,
      given: disclosure.showGiven ? given : [],
      candidates: disclosure.host ? folderFiles.filter((file) => !givenIds.has(file.fileId)) : [],
    };
  });
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

/** Ό,τι διαβάστηκε για την ενότητα — μία φορά ανά κλήση. */
interface PanelReads {
  readonly context: IssuanceRequestContext;
  readonly requests: readonly IssuanceDocumentRequest[];
  readonly provisions: readonly StoredDocumentProvision[];
}

/**
 * Ε4 — το παράθυρο του **μηχανικού**: `null` όταν δεν χρειάζεται κρίση (γραφείο · κανένα ζωντανό δόσιμο), ώστε το μητρώο
 * να διαβάζεται **μόνο** όταν υπάρχει κάτι να ανοίξει.
 */
async function engagedAccessOf(db: Firestore, reads: PanelReads, question: IssuancePanelQuestion): Promise<IssuanceDocumentRequests['access']> {
  if (question.viewer.role === 'host' || !reads.provisions.some(isLiveProvision)) return null;
  const now = new Date(question.nowMs);
  const latestIssuedOn = await issuanceLatestIssuedOn(db, question.assignment, now);
  return latestIssuedOn === 'unknown' ? 'unknown' : issuanceFileAccessWindow(question.assignment, latestIssuedOn, conveyanceToday(now));
}

/** Η ενότητα από ό,τι διαβάστηκε — ίδια συναρμολόγηση για μηχανικό και γραφείο. */
async function panelOf(db: Firestore, reads: PanelReads, question: IssuancePanelQuestion): Promise<IssuanceDocumentRequests> {
  const host = question.viewer.role === 'host';
  const access = await engagedAccessOf(db, reads, question);
  const showGiven = host || (access !== null && access !== 'unknown' && access.open);
  return {
    today: conveyanceToday(new Date(question.nowMs)),
    targets: targetsOf(reads.context, question.viewer),
    log: documentRequestViewsFor(reads.requests, question.viewer),
    items: disclosedItems(reads.context, { host, showGiven, provisions: reads.provisions }),
    tiersVerified: ISSUANCE_REQUEST_TIERS_VERIFIED,
    access,
    retentionBasis: ISSUANCE_RETENTION_BASIS[question.assignment.documentKind],
  };
}

/** Τα δοσίματα της ανάθεσης, ή `null` αν η ανάγνωση απέτυχε. */
function readIssuanceProvisions(db: Firestore, assignment: Pick<DocumentIssuanceAssignment, 'id' | 'companyId'>): Promise<StoredDocumentProvision[] | null> {
  return readSubjectProvisions(db, { companyId: assignment.companyId, subject: { kind: 'document_issuance', id: assignment.id } });
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
  const [context, requests, provisions] = await Promise.all([
    issuanceRequestContextOf(db, question.assignment),
    readIssuanceRequests(db, question.assignment),
    readIssuanceProvisions(db, question.assignment),
  ]);
  if (context === 'unknown' || requests === null || provisions === null) return 'unknown';
  if (context.container === null) return null;
  return { panel: await panelOf(db, { context, requests, provisions }, question), container: context.container };
}

/** Μόνο η ενότητα — η όψη του μηχανικού (το δοχείο δεν τον αφορά: δεν ανεβάζει στον φάκελο του κατόχου). */
export async function issuanceDocumentRequestPanel(db: Firestore, question: IssuancePanelQuestion): Promise<IssuanceDocumentRequests | null | 'unknown'> {
  const result = await issuanceRequestPanelWithContainer(db, question);
  return result === null || result === 'unknown' ? result : result.panel;
}
